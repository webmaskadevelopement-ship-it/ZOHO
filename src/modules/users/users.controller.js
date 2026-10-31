const express = require('express');
const router = express.Router();
const UsersService = require('./users.service');
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');

// GET /api/v1/users/directory - Return sanitized list of workspace users
router.get('/directory', authenticate, (req, res, next) => {
    try {
        const portalId = req.headers['x-portal-id'] || 'portal-demo-zoho';
        const users = UsersService.getDirectory(req.user.id, portalId);
        res.json({ success: true, data: users });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/users/:id - Get specific user profile
router.get('/:id', authenticate, (req, res, next) => {
    try {
        const user = UsersService.getUserById(req.params.id, req.user.id);
        res.json({ success: true, data: user });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/v1/users/:id/role - Admin Only: update RBAC tier, department, billing rates
router.patch('/:id/role', authenticate, requireRole('admin'), async (req, res, next) => {
    try {
        const { role, department, costPerHour, billableRatePerHour } = req.body;
        const result = await UsersService.updateUserRoleAndBilling(req.params.id, {
            role,
            department,
            costPerHour,
            billableRatePerHour
        });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;

