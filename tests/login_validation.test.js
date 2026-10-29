/**
 * Google Auth & Canonical Role Validation Test Suite
 * Verifies Google Sign-In Role Mapping (Admin, Manager, Member),
 * Auto-Provisioning, Database Integrity, and Elimination of Dummy Data.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const AuthValidationService = require('../functions/src/modules/auth/authValidation');
const cloudFunctions = require('../functions/src/index');
const db = require('../src/db/database');
const { resolveAuthorizedRole } = require('../src/config/roles');

describe('Google Authentication & Canonical RBAC Role Mapping', () => {

    describe('1. Canonical Role Assignment Rules', () => {
        it('should resolve webmaskadevelopement@gmail.com strictly as admin', () => {
            const role = resolveAuthorizedRole('webmaskadevelopement@gmail.com');
            assert.equal(role, 'admin');
        });

        it('should resolve backend.webmaska@gmail.com strictly as manager', () => {
            const role = resolveAuthorizedRole('backend.webmaska@gmail.com');
            assert.equal(role, 'manager');
        });

        it('should resolve any other valid Google account as member by default', () => {
            const role1 = resolveAuthorizedRole('newuser@gmail.com');
            const role2 = resolveAuthorizedRole('contractor@external.org');
            assert.equal(role1, 'member');
            assert.equal(role2, 'member');
        });

        it('should preserve existing elevated DB role if previously promoted', () => {
            const role = resolveAuthorizedRole('promoted.user@gmail.com', 'admin');
            assert.equal(role, 'admin');
        });
    });

    describe('2. Google Sign-In Flow & Auto-Provisioning (No "Not Invited" Block)', () => {
        it('should authenticate Admin (webmaskadevelopement@gmail.com) with role admin', async () => {
            const res = await AuthValidationService.validateGoogleLogin({
                email: 'webmaskadevelopement@gmail.com',
                name: 'Primary Admin'
            });

            assert.equal(res.success, true);
            assert.ok(res.token, 'Must return valid session JWT');
            assert.equal(res.user.email, 'webmaskadevelopement@gmail.com');
            assert.equal(res.user.role, 'admin');
        });

        it('should authenticate Manager (backend.webmaska@gmail.com) with role manager', async () => {
            const res = await AuthValidationService.validateGoogleLogin({
                email: 'backend.webmaska@gmail.com',
                name: 'Engineering Manager'
            });

            assert.equal(res.success, true);
            assert.ok(res.token);
            assert.equal(res.user.email, 'backend.webmaska@gmail.com');
            assert.equal(res.user.role, 'manager');
        });

        it('should allow and auto-provision new Google user as member without "Not invited" error', async () => {
            const testEmail = `new.member.${Date.now()}@gmail.com`;
            const res = await AuthValidationService.validateGoogleLogin({
                email: testEmail,
                name: 'New Team Member'
            });

            assert.equal(res.success, true);
            assert.ok(res.token);
            assert.equal(res.user.email, testEmail);
            assert.equal(res.user.role, 'member');

            // Verify user exists in SQLite
            const inDb = db.queryOne('SELECT email, role FROM users WHERE LOWER(email) = ?', [testEmail]);
            assert.ok(inDb);
            assert.equal(inDb.role, 'member');

            // Clean up test entry
            db.execute('DELETE FROM portal_members WHERE user_id = (SELECT id FROM users WHERE email = ?)', [testEmail]);
            db.execute('DELETE FROM users WHERE email = ?', [testEmail]);
        });

        it('should reject Google login if email is missing', async () => {
            await assert.rejects(
                async () => {
                    await AuthValidationService.validateGoogleLogin({
                        email: '',
                        name: 'No Email'
                    });
                },
                {
                    message: 'Google email is required.'
                }
            );
        });
    });

    describe('3. Database Integrity & Zero Dummy Data Verification', () => {
        it('should have zero dummy persona users in users table', () => {
            const dummyUsers = db.queryAll(`
                SELECT email FROM users
                WHERE email LIKE '%@lifepms.com'
                   OR email LIKE '%@acme.com'
                   OR email LIKE '%@brandacme.com'
                   OR email LIKE '%@example.com'
            `);
            assert.equal(dummyUsers.length, 0, `Expected 0 dummy users, found: ${dummyUsers.map(u => u.email).join(', ')}`);
        });

        it('should have zero dummy sample projects in projects table', () => {
            const dummyProjects = db.queryAll(`
                SELECT id, name FROM projects
                WHERE id IN ('proj-zoho-core', 'proj-mobile-app', 'proj-design-system', 'proj-analytics', 'proj-compliance')
            `);
            assert.equal(dummyProjects.length, 0, `Expected 0 dummy sample projects, found: ${dummyProjects.map(p => p.name).join(', ')}`);
        });

        it('should verify projects table contains zero dummy sample data', () => {
            const dummyNames = ['proj-ai-training', 'proj-agency-automation', 'proj-mobile-app', 'proj-design-system'];
            const foundDummy = db.queryAll(`
                SELECT id, name FROM projects
                WHERE id IN ('proj-ai-training', 'proj-agency-automation', 'proj-mobile-app', 'proj-design-system')
            `);
            assert.equal(foundDummy.length, 0, 'Zero dummy sample projects should exist in database');
        });
    });

    describe('4. Firebase Functions 2nd Gen Callables Export', () => {
        it('should properly export validateLogin and validateGoogleLogin', () => {
            assert.ok(cloudFunctions.validateLogin, 'validateLogin callable should be exported');
            assert.ok(cloudFunctions.validateGoogleLogin, 'validateGoogleLogin callable should be exported');
        });
    });
});
