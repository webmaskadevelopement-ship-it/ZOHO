const express = require('express');
const router = express.Router();
const RolesService = require('./roles.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

// List all roles (built-in and custom)
router.get('/', (req, res, next) => {
    try {
        const roles = RolesService.getRoles(req.portalId);
        res.json({ success: true, data: roles });
    } catch (err) {
        next(err);
    }
});

// List custom security profiles
router.get('/profiles', (req, res, next) => {
    try {
        const profiles = RolesService.getProfiles(req.portalId);
        res.json({ success: true, data: profiles });
    } catch (err) {
        next(err);
    }
});

// Create custom security profile
router.post('/profiles', requireRole(['admin']), (req, res, next) => {
    try {
        const { name, description, permissions } = req.body;
        const profile = RolesService.createProfile(req.portalId, { name, description, permissions });
        res.status(201).json({ success: true, data: profile });
    } catch (err) {
        next(err);
    }
});

// Get specific profile
router.get('/profiles/:id', (req, res, next) => {
    try {
        const profile = RolesService.getProfileById(req.portalId, req.params.id);
        res.json({ success: true, data: profile });
    } catch (err) {
        next(err);
    }
});

// Update profile
router.put('/profiles/:id', requireRole(['admin']), (req, res, next) => {
    try {
        const profile = RolesService.updateProfile(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: profile });
    } catch (err) {
        next(err);
    }
});

// Delete profile
router.delete('/profiles/:id', requireRole(['admin']), (req, res, next) => {
    try {
        const result = RolesService.deleteProfile(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
