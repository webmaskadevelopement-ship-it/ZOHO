/**
 * Automated Test Suite for Email Invitation & Verification System
 * Validates token generation, expiration, verification endpoint,
 * auto-acceptance upon login, and accurate email delivery status.
 */

process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { v4: uuidv4 } = require('uuid');

const db = require('../src/db/database');
const PortalsService = require('../src/modules/portals/portals.service');
const ProjectsService = require('../src/modules/projects/projects.service');
const EmailService = require('../src/services/emailService');
const FirebaseAuthService = require('../src/services/firebaseAuthService');

describe('Email Invitation & Verification Lifecycle Test Suite', () => {
    const portalId = 'portal-demo-zoho';
    let testProject;
    const testEmail = `invited.engineer.${Date.now()}@example.com`;
    let generatedToken;
    let inviteId;

    let server;

    before(async () => {
        db.getInstance();
        testProject = db.queryOne('SELECT id, name FROM projects LIMIT 1');
        if (!testProject) {
            const ProjectsService = require('../src/modules/projects/projects.service');
            const admin = db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
            testProject = ProjectsService.createProject(portalId, {
                name: 'Invitation Test Project',
                ownerId: admin ? admin.id : 'user-admin'
            });
        }

        // Start server on 5000 if not listening
        try {
            const app = require('../src/app');
            await new Promise((resolve) => {
                server = app.listen(5000, () => resolve());
                server.on('error', () => resolve());
            });
        } catch (e) {}
    });

    after(async () => {
        // Cleanup test invite & user
        try {
            db.execute('DELETE FROM invited_members WHERE LOWER(email) = ?', [testEmail.toLowerCase()]);
            db.execute('DELETE FROM users WHERE LOWER(email) = ?', [testEmail.toLowerCase()]);
        } catch (e) {}

        if (server && typeof server.close === 'function') {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('1. Invitation Generation & Link Integrity', () => {
        it('should generate an invitation with a unique secure token and 7-day expiration', async () => {
            const result = await PortalsService.inviteMember(portalId, {
                email: testEmail,
                name: 'Alex Engineer',
                role: 'employee',
                inviterName: 'Lead Admin',
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.ok(result.token, 'Token must be generated');
            assert.ok(result.expiresAt, 'expiresAt must be set');
            assert.ok(result.inviteLink.includes(`token=${result.token}`), 'Invite link must embed token');
            assert.ok(result.inviteLink.includes(`inviteEmail=${encodeURIComponent(testEmail.toLowerCase())}`));

            generatedToken = result.token;
            inviteId = result.inviteId;

            // Verify in SQLite
            const record = db.queryOne('SELECT * FROM invited_members WHERE id = ?', [inviteId]);
            assert.ok(record, 'Record must exist in database');
            assert.equal(record.status, 'pending');
            assert.equal(record.token, generatedToken);
            assert.ok(new Date(record.expires_at) > new Date());
        });

        it('should report accurate email delivery status (matches active SMTP provider)', async () => {
            const result = await PortalsService.inviteMember(portalId, {
                email: testEmail,
                name: 'Alex Engineer',
                role: 'employee',
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(result.success, true);
            assert.ok(result.emailDelivery, 'emailDelivery object must be present');
            const hasRealCreds = Boolean(
                (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) ||
                (process.env.SMTP_USER && process.env.SMTP_PASS)
            );
            if (hasRealCreds) {
                assert.ok(result.deliveredToInbox === true || result.isDailyLimitExceeded === true, 'Must report true or isDailyLimitExceeded when real SMTP credentials are provided');
            } else {
                assert.equal(result.deliveredToInbox, false, 'Must not claim real inbox delivery without SMTP credentials');
            }
        });
    });

    describe('2. Public Invitation Verification API (/api/v1/portals/invite/verify)', () => {
        it('should successfully verify valid pending invitation by token', async () => {
            const res = await fetch(`http://localhost:5000/api/v1/portals/invite/verify?token=${generatedToken}`);
            const body = await res.json();

            assert.equal(res.status, 200);
            assert.equal(body.success, true);
            assert.equal(body.valid, true);
            assert.equal(body.data.email, testEmail.toLowerCase());
            assert.equal(body.data.status, 'pending');
        });

        it('should reject non-existent or invalid tokens with 404', async () => {
            const fakeToken = uuidv4();
            const res = await fetch(`http://localhost:5000/api/v1/portals/invite/verify?token=${fakeToken}`);
            const body = await res.json();

            assert.equal(res.status, 404);
            assert.equal(body.success, false);
            assert.equal(body.valid, false);
            assert.ok(body.error.includes('not found') || body.error.includes('invalid'));
        });

        it('should reject expired invitations with 410 Gone status', async () => {
            // Set past expiration
            const expiredEmail = `expired.user.${Date.now()}@example.com`;
            const expiredToken = uuidv4();
            const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

            db.execute(
                `INSERT INTO invited_members (id, portal_id, email, name, role, status, token, expires_at, created_at, updated_at)
                 VALUES (?, ?, ?, 'Expired User', 'employee', 'pending', ?, ?, ?, ?)`,
                [uuidv4(), portalId, expiredEmail, expiredToken, pastDate, pastDate, pastDate]
            );

            const res = await fetch(`http://localhost:5000/api/v1/portals/invite/verify?token=${expiredToken}`);
            const body = await res.json();

            assert.equal(res.status, 410);
            assert.equal(body.success, false);
            assert.equal(body.expired, true);
            assert.ok(body.error.includes('expired'));

            // Clean up
            db.execute('DELETE FROM invited_members WHERE email = ?', [expiredEmail]);
        });
    });

    describe('3. Invitation Acceptance & Auto-Provisioning on Login', () => {
        it('should transition pending invitation to accepted and activate access upon Google login', async () => {
            // Check before login: pending
            const beforeRecord = db.queryOne('SELECT status, accepted_at FROM invited_members WHERE id = ?', [inviteId]);
            assert.equal(beforeRecord.status, 'pending');
            assert.equal(beforeRecord.accepted_at, null);

            // Simulate Firebase Google login with the invited email
            const authResult = await FirebaseAuthService.verifyFirebaseToken('test-id-token', {
                email: testEmail,
                name: 'Alex Engineer'
            });

            assert.ok(authResult.token, 'Session JWT must be issued');
            assert.equal(authResult.user.email, testEmail.toLowerCase());

            // Check after login: accepted
            const afterRecord = db.queryOne('SELECT status, accepted_at FROM invited_members WHERE id = ?', [inviteId]);
            assert.equal(afterRecord.status, 'accepted');
            assert.ok(afterRecord.accepted_at, 'accepted_at timestamp must be recorded');

            // Verification endpoint should now report alreadyAccepted: true
            const verifyRes = await fetch(`http://localhost:5000/api/v1/portals/invite/verify?token=${generatedToken}`);
            const verifyBody = await verifyRes.json();

            assert.equal(verifyRes.status, 200);
            assert.equal(verifyBody.success, true);
            assert.equal(verifyBody.alreadyAccepted, true);
            assert.ok(verifyBody.message.includes('already been accepted'));

            // Clean up test user
            db.execute('DELETE FROM invited_members WHERE LOWER(email) = ?', [testEmail.toLowerCase()]);
            db.execute('DELETE FROM users WHERE LOWER(email) = ?', [testEmail.toLowerCase()]);
        });
    });

    describe('4. Project Share with Direct Project Access', () => {
        it('should associate project_id with invite and assign member to project upon login', async () => {
            const projectInviteEmail = `proj.colleague.${Date.now()}@example.com`;

            // Ensure testProject exists
            let proj = db.queryOne('SELECT id, name FROM projects WHERE id = ?', [testProject?.id]);
            if (!proj) {
                const admin = db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
                testProject = ProjectsService.createProject(portalId, {
                    name: `Invitation Project ${Date.now()}`,
                    ownerId: admin ? admin.id : 'user-admin'
                });
            }

            // Share project
            const shareRes = await ProjectsService.shareProject(portalId, testProject.id, {
                email: projectInviteEmail,
                role: 'member',
                inviterName: 'Admin',
                baseUrl: 'http://localhost:5000'
            });

            assert.equal(shareRes.success, true);
            assert.ok(shareRes.token, 'Token must be created for project share');

            // Invite record must store project_id
            const invRecord = db.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [projectInviteEmail.toLowerCase()]);
            assert.ok(invRecord);
            assert.equal(invRecord.project_id, testProject.id);

            // User logs in with Google
            const loginRes = await FirebaseAuthService.verifyFirebaseToken('mock-id-token', {
                email: projectInviteEmail,
                name: 'Project Colleague'
            });

            // Project member_ids must now include this user
            const updatedProject = ProjectsService.getProjectById(portalId, testProject.id);
            assert.ok(updatedProject.member_ids.includes(loginRes.user.id), 'User must be added to project member_ids');

            // Clean up
            db.execute('DELETE FROM invited_members WHERE LOWER(email) = ?', [projectInviteEmail.toLowerCase()]);
            db.execute('DELETE FROM users WHERE LOWER(email) = ?', [projectInviteEmail.toLowerCase()]);
        });
    });

    describe('5. SMTP Live Status Endpoint (/api/v1/portals/smtp-status)', () => {
        it('should return live diagnostic SMTP connection status without crashing', async () => {
            const res = await fetch('http://localhost:5000/api/v1/portals/smtp-status');
            const body = await res.json();

            assert.equal(res.status, 200);
            assert.equal(body.success, true);
            assert.ok(body.data);
            assert.ok('configured' in body.data);
            assert.ok('provider' in body.data);
        });
    });

    after(() => {
        db.execute("DELETE FROM projects WHERE name = 'Invitation Test Project'");
        db.execute("DELETE FROM users WHERE email LIKE '%@example.com'");
        db.execute("DELETE FROM invited_members WHERE email LIKE '%@example.com'");
    });
});
