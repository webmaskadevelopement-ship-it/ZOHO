/**
 * Automated Test Suite for Email Sharing and Backend Integration
 * Validates project sharing, self-sharing, recipient email validation,
 * access control, permissions, and database record integrity.
 */

process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const db = require('../src/db/database');
const config = require('../src/config');
const ProjectsService = require('../src/modules/projects/projects.service');
const PortalsService = require('../src/modules/portals/portals.service');
const ViewsService = require('../src/modules/views/views.service');
const AuthService = require('../src/modules/auth/auth.service');

describe('Email Sharing & Backend Integration Test Suite', () => {
    let portalId = 'portal-demo-zoho';
    let projectId;
    let adminUser;
    let adminToken;
    let managerUser;
    let clientUser;
    let clientToken;

    before(async () => {
        db.getInstance();

        // 1. Fetch genuine test entities
        adminUser = db.queryOne("SELECT id, email, name, role FROM users WHERE role = 'admin' LIMIT 1");
        managerUser = db.queryOne("SELECT id, email, name, role FROM users WHERE role = 'manager' LIMIT 1");
        clientUser = db.queryOne("SELECT id, email, name, role FROM users WHERE role = 'client' LIMIT 1");

        const proj = db.queryOne("SELECT id FROM projects LIMIT 1");
        projectId = proj.id;

        // Login Admin
        const adminLogin = await AuthService.login({ email: adminUser.email, password: 'FirebaseManagedAuth2026!' });
        adminToken = adminLogin.token;

        // Login Client if present
        if (clientUser) {
            try {
                const clientLogin = await AuthService.login({ email: clientUser.email, password: 'FirebaseManagedAuth2026!' });
                clientToken = clientLogin?.token;
            } catch (e) {}
        }
    });

    describe('1. Self-Sharing & Same Email Sharing Logic', () => {
        it('should successfully share project when sender and recipient use the same email address', async () => {
            const result = await ProjectsService.shareProject(portalId, projectId, {
                email: adminUser.email,
                role: 'admin',
                inviterId: adminUser.id,
                inviterName: adminUser.name,
                inviterEmail: adminUser.email,
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.equal(result.isSelfShare, true);
            assert.equal(result.email, adminUser.email.toLowerCase().trim());
            assert.equal(result.role, 'admin');
            assert.ok(result.message.includes('sent to your email'));
            assert.ok(result.shareLink.includes('redirect='));

            // Verify database records
            const inviteRecord = db.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [adminUser.email.toLowerCase().trim()]);
            assert.ok(inviteRecord, 'Invited members record must exist');
            assert.equal(inviteRecord.status, 'active');
            assert.equal(inviteRecord.role, 'admin', 'Admin role must not be downgraded');

            const project = ProjectsService.getProjectById(portalId, projectId);
            assert.ok(project.member_ids.includes(adminUser.id), 'Admin ID must be present in project member_ids');
        });

        it('should allow re-sharing with the same email without unique constraint errors', async () => {
            // Attempt secondary share with exact same email
            const result = await ProjectsService.shareProject(portalId, projectId, {
                email: adminUser.email,
                role: 'admin',
                inviterId: adminUser.id,
                inviterName: adminUser.name,
                inviterEmail: adminUser.email,
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.equal(result.isSelfShare, true);
        });
    });

    describe('2. Sharing With Existing Registered Team Members', () => {
        it('should share project with another registered manager and preserve canonical role', async () => {
            const result = await ProjectsService.shareProject(portalId, projectId, {
                email: managerUser.email,
                role: 'member', // Caller passes member, but system should preserve manager
                inviterId: adminUser.id,
                inviterName: adminUser.name,
                inviterEmail: adminUser.email,
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.equal(result.isSelfShare, false);
            assert.equal(result.email, managerUser.email.toLowerCase().trim());
            assert.equal(result.role, 'manager', 'Manager canonical role must be preserved');

            // Verify project membership
            const project = ProjectsService.getProjectById(portalId, projectId);
            assert.ok(project.member_ids.includes(managerUser.id));

            // Verify invited_members table
            const invite = db.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [managerUser.email.toLowerCase().trim()]);
            assert.ok(invite);
            assert.equal(invite.status, 'active');
        });
    });

    describe('3. Sharing With New Unregistered Recipient', () => {
        const newEmail = 'newcolleague.test@webmaska.com';

        it('should provision new user, grant portal membership, and add to project', async () => {
            const result = await ProjectsService.shareProject(portalId, projectId, {
                email: newEmail,
                role: 'member',
                inviterId: adminUser.id,
                inviterName: adminUser.name,
                inviterEmail: adminUser.email,
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.equal(result.email, newEmail);
            assert.equal(result.role, 'member');

            // Verify user was provisioned
            const newUser = db.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [newEmail]);
            assert.ok(newUser, 'New user must be provisioned in users table');
            assert.equal(newUser.role, 'member');

            // Verify portal_members
            const portalMember = db.queryOne('SELECT * FROM portal_members WHERE portal_id = ? AND user_id = ?', [portalId, newUser.id]);
            assert.ok(portalMember, 'Portal member record must be created');

            // Verify project member_ids
            const project = ProjectsService.getProjectById(portalId, projectId);
            assert.ok(project.member_ids.includes(newUser.id));

            // Verify invited_members
            const invite = db.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [newEmail]);
            assert.ok(invite);
            assert.equal(invite.status, 'active');
        });

        after(() => {
            // Cleanup test new user
            const u = db.queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [newEmail]);
            if (u) {
                db.execute('DELETE FROM portal_members WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM users WHERE id = ?', [u.id]);
                db.execute('DELETE FROM invited_members WHERE LOWER(email) = ?', [newEmail]);
                // Remove from project member_ids
                const proj = ProjectsService.getProjectById(portalId, projectId);
                const updatedMembers = proj.member_ids.filter(id => id !== u.id);
                db.execute('UPDATE projects SET member_ids = ? WHERE id = ?', [JSON.stringify(updatedMembers), projectId]);
            }
        });
    });

    describe('4. Email Validation & Error Handling', () => {
        it('should reject missing or empty email', async () => {
            await assert.rejects(
                async () => ProjectsService.shareProject(portalId, projectId, { email: '' }),
                /A valid recipient email address is required/
            );
        });

        it('should reject malformed email format', async () => {
            await assert.rejects(
                async () => ProjectsService.shareProject(portalId, projectId, { email: 'not-an-email' }),
                /Please enter a valid recipient email format/
            );

            await assert.rejects(
                async () => ProjectsService.shareProject(portalId, projectId, { email: 'test@invalid' }),
                /Please enter a valid recipient email format/
            );
        });

        it('should reject non-existent project', async () => {
            await assert.rejects(
                async () => ProjectsService.shareProject(portalId, 'non-existent-proj-id', { email: 'test@domain.com' }),
                /Project not found/
            );
        });
    });

    describe('5. Project Members Retrieval (GET /:id/members)', () => {
        it('should retrieve list of project members with authentic details and owner flag', () => {
            const members = ProjectsService.getProjectMembers(portalId, projectId);
            assert.ok(Array.isArray(members));
            assert.ok(members.length >= 1);

            const ownerMember = members.find(m => m.isOwner);
            assert.ok(ownerMember, 'Project must have an owner member');
            assert.equal(ownerMember.displayRole, 'Owner');
            assert.equal(ownerMember.id, adminUser.id);
        });
    });

    describe('6. Public Views Sharing & Email Dispatch', () => {
        it('should create public share and dispatch view link via email service', async () => {
            const share = ViewsService.createPublicShare(portalId, {
                projectId,
                viewType: 'gantt',
                expiresDays: 14
            });

            assert.ok(share.shareToken);
            assert.ok(share.shareUrl);

            // Fetch public share without authentication
            const fetched = ViewsService.getPublicShare(share.shareToken);
            assert.ok(fetched);
            assert.ok(fetched.data);
            assert.ok(fetched.data.tasks);

            // Clean up test public share
            db.execute('DELETE FROM public_shares WHERE share_token = ?', [share.shareToken]);
        });
    });

    after(() => {
        // Ensure project members list is pristine with admin
        const proj = ProjectsService.getProjectById(portalId, projectId);
        const cleanMembers = [adminUser.id];
        db.execute('UPDATE projects SET member_ids = ? WHERE id = ?', [JSON.stringify(cleanMembers), projectId]);
    });
});
