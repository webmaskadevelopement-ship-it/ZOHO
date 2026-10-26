/**
 * Login Validation Logic Test Suite
 * Verifies Email Whitelist, Name Match, and Google Login Flows.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const AuthValidationService = require('../functions/src/modules/auth/authValidation');
const cloudFunctions = require('../functions/src/index');

describe('Login Validation Logic (CRITICAL)', () => {

    describe('1. Email Whitelist & User Existence Validation', () => {
        it('should block non-existent email with exact error message', async () => {
            await assert.rejects(
                async () => {
                    await AuthValidationService.validateLogin({
                        email: 'unregistered.random@unknown.com',
                        name: 'Random Person',
                        role: 'Lead'
                    });
                },
                {
                    message: 'User not found. Please contact admin or use invited email.'
                }
            );
        });

        it('should block when email exists but Name does not match registered name', async () => {
            await assert.rejects(
                async () => {
                    await AuthValidationService.validateLogin({
                        email: 'dev@lifepms.com',
                        name: 'Wrong Full Name',
                        role: 'Lead'
                    });
                },
                {
                    message: 'Name does not match the registered user for this email.'
                }
            );
        });

        it('should succeed when email and name match case-insensitively for registered user', async () => {
            const res = await AuthValidationService.validateLogin({
                email: 'dev@lifepms.com',
                name: 'devon vance', // Case-insensitive match for "Devon Vance (Lead Dev)"
                role: 'Lead'
            });

            assert.equal(res.success, true);
            assert.ok(res.token, 'Should generate session token');
            assert.equal(res.user.email, 'dev@lifepms.com');
        });

        it('should allow invited member to login and auto-provision user', async () => {
            const res = await AuthValidationService.validateLogin({
                email: 'jordan.lee@lifepms.com',
                name: 'Jordan Lee',
                role: 'Lead'
            });

            assert.equal(res.success, true);
            assert.ok(res.token);
            assert.equal(res.user.email, 'jordan.lee@lifepms.com');
            assert.equal(res.user.name, 'Jordan Lee');
        });
    });

    describe('2. Google Login Whitelist Validation', () => {
        it('should allow existing user via Google login', async () => {
            const res = await AuthValidationService.validateGoogleLogin({
                email: 'admin@lifepms.com',
                name: 'Alex Director'
            });

            assert.equal(res.success, true);
            assert.ok(res.token);
            assert.equal(res.user.email, 'admin@lifepms.com');
        });

        it('should auto-provision invited member on Google login', async () => {
            const res = await AuthValidationService.validateGoogleLogin({
                email: 'sam.taylor@lifepms.com',
                name: 'Sam Taylor'
            });

            assert.equal(res.success, true);
            assert.ok(res.token);
            assert.equal(res.user.email, 'sam.taylor@lifepms.com');
        });

        it('should block uninvited new user on Google login with "Not invited" message', async () => {
            await assert.rejects(
                async () => {
                    await AuthValidationService.validateGoogleLogin({
                        email: 'stranger.not.invited@gmail.com',
                        name: 'Stranger'
                    });
                },
                {
                    message: 'Not invited. Please contact admin or use invited email.'
                }
            );
        });
    });

    describe('3. Firebase Functions 2nd Gen Callables Export', () => {
        it('should export validateLogin and validateGoogleLogin', () => {
            assert.ok(cloudFunctions.validateLogin, 'validateLogin callable should be exported');
            assert.ok(cloudFunctions.validateGoogleLogin, 'validateGoogleLogin callable should be exported');
        });
    });
});
