const express = require('express');
const router = express.Router();
const AuthService = require('./auth.service');
const { authenticate } = require('../../middleware/auth');

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name, role, department, clientCompanyId } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ success: false, error: 'Email, password, and name are required.' });
        }
        const validRoles = ['admin', 'manager', 'employee', 'client'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: `Role must be specified. Valid options: ${validRoles.join(', ')}` });
        }
        const result = await AuthService.register({ email, password, name, role, department, clientCompanyId });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required.' });
        }
        const result = await AuthService.login({ email, password });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Firebase Authentication Exchange Endpoint
router.post('/firebase-login', async (req, res, next) => {
    try {
        const { idToken, role, name } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, error: 'Firebase idToken is required.' });
        }
        const FirebaseAuthService = require('../../services/firebaseAuthService');
        const result = await FirebaseAuthService.verifyFirebaseToken(idToken, { role, name });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Login Validation: Email whitelist check (users or invited_members) + Name matching
router.post('/validate-login', async (req, res, next) => {
    try {
        const { email, name, role } = req.body;
        const AuthValidationService = require('../../../functions/src/modules/auth/authValidation');
        const result = await AuthValidationService.validateLogin({ email, name, role });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Google Login Validation: Check if email exists in users or invited_members
router.post('/google-validate', async (req, res, next) => {
    try {
        const { email, name, idToken, role } = req.body;
        const AuthValidationService = require('../../../functions/src/modules/auth/authValidation');
        const result = await AuthValidationService.validateGoogleLogin({ email, name, idToken, role });
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(403).json({ success: false, error: err.message });
    }
});

router.get('/me', authenticate, (req, res, next) => {
    try {
        const result = AuthService.getProfile(req.user.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.put('/me', authenticate, async (req, res, next) => {
    try {
        const result = await AuthService.updateProfile(req.user.id, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
});

// Personal Access Tokens (PDF Feature 140, ZP-059)
router.post('/tokens/pat', authenticate, (req, res, next) => {
    try {
        const { name, scopes, expiresDays } = req.body;
        const pat = AuthService.createPersonalAccessToken(req.user.id, { name, scopes, expiresDays });
        res.status(201).json({ success: true, data: pat });
    } catch (err) {
        next(err);
    }
});

router.get('/tokens/pat', authenticate, (req, res, next) => {
    try {
        const tokens = AuthService.getPersonalAccessTokens(req.user.id);
        res.json({ success: true, data: tokens });
    } catch (err) {
        next(err);
    }
});

router.delete('/tokens/pat/:id', authenticate, (req, res, next) => {
    try {
        const result = AuthService.revokePersonalAccessToken(req.user.id, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Session Management & Active Devices (PDF Feature 3)
router.get('/sessions', authenticate, (req, res, next) => {
    try {
        const sessions = AuthService.getActiveSessions(req.user.id);
        res.json({ success: true, data: sessions });
    } catch (err) {
        next(err);
    }
});

router.delete('/sessions/:id', authenticate, (req, res, next) => {
    try {
        const result = AuthService.revokeSession(req.user.id, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
