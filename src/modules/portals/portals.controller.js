const express = require('express');
const router = express.Router();
const PortalsService = require('./portals.service');
const db = require('../../db/database');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const FirebaseSyncService = require('../../services/firebaseSyncService');

// Public invitation verification route
router.get('/invite/accept', (req, res) => {
    try {
        const token = req.query.token || req.query.code;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Invitation token is required.' });
        }
        const member = db.queryOne('SELECT * FROM invited_members WHERE id = ?', [token]);
        if (!member) {
            return res.status(404).json({ success: false, error: 'Invitation not found or expired.' });
        }
        res.json({
            success: true,
            data: {
                message: 'Invitation verified successfully.',
                email: member.email,
                name: member.name,
                role: member.role,
                portalId: member.portal_id
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Member Invitations with Real Email Delivery & Firebase Firestore Sync
router.post('/invite', optionalAuth, async (req, res, next) => {
    try {
        const portalId = req.body.portalId || req.portalId || 'portal-demo-zoho';
        const { email, name, role } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'A valid email address is required.' });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const inviterId = req.user?.id || 'user-admin';
        const inviterName = req.user?.name || 'Admin';

        // 1. Deliver invitation
        const result = await PortalsService.inviteMember(portalId, {
            email,
            name: name || email.split('@')[0],
            role: role || 'employee',
            inviterId,
            inviterName,
            baseUrl
        });

        // 2. Also record in Firebase Firestore
        try {
            await FirebaseSyncService.recordEmailSubmission({
                email,
                name: name || email.split('@')[0],
                role: role || 'employee',
                source: 'portal_invite_form',
                portalId,
                metadata: { inviterId, inviterName }
            });
        } catch (fbErr) {
            console.warn('[FirebaseSync] Post-invite sync notice:', fbErr.message);
        }

        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

router.use(authenticate);

// List portals user belongs to
router.get('/', (req, res, next) => {
    try {
        const portals = PortalsService.getPortalsForUser(req.user.id);
        res.json({ success: true, data: portals });
    } catch (err) {
        next(err);
    }
});

// Create a new portal
router.post('/', (req, res, next) => {
    try {
        const { name, slug, customDomain, logoUrl, currency, businessHours } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Portal name is required.' });

        const portal = PortalsService.createPortal({
            name,
            slug,
            customDomain,
            logoUrl,
            currency,
            businessHours,
            creatorUserId: req.user.id
        });
        res.status(201).json({ success: true, data: portal });
    } catch (err) {
        next(err);
    }
});

// Get current portal details
router.get('/:portalId', portalScope, (req, res, next) => {
    try {
        res.json({ success: true, data: req.portal });
    } catch (err) {
        next(err);
    }
});

// Update portal settings
router.put('/:portalId', portalScope, requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const updated = PortalsService.updatePortal(req.portalId, {
            ...req.body,
            userId: req.user.id
        });
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// Members
router.get('/:portalId/members', portalScope, (req, res, next) => {
    try {
        const members = PortalsService.getMembers(req.portalId);
        res.json({ success: true, data: members });
    } catch (err) {
        next(err);
    }
});

router.post('/:portalId/members', portalScope, requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { userId, email, role } = req.body;
        const member = PortalsService.addMember(req.portalId, { userId, email, role });
        res.status(201).json({ success: true, data: member });
    } catch (err) {
        next(err);
    }
});

router.put('/:portalId/members/:userId/role', portalScope, requireRole(['admin']), (req, res, next) => {
    try {
        const { role } = req.body;
        const result = PortalsService.updateMemberRole(req.portalId, req.params.userId, role);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});



router.post('/:portalId/invite', portalScope, requireRole(['admin', 'manager']), async (req, res, next) => {
    try {
        const { email, name, role } = req.body;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const result = await PortalsService.inviteMember(req.portalId, {
            email,
            name,
            role,
            inviterId: req.user.id,
            inviterName: req.user.name,
            baseUrl
        });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Client Companies
router.get('/:portalId/client-companies', portalScope, (req, res, next) => {
    try {
        const companies = PortalsService.getClientCompanies(req.portalId);
        res.json({ success: true, data: companies });
    } catch (err) {
        next(err);
    }
});

router.post('/:portalId/client-companies', portalScope, requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const company = PortalsService.createClientCompany(req.portalId, req.body);
        res.status(201).json({ success: true, data: company });
    } catch (err) {
        next(err);
    }
});

// Leave Tracker
router.get('/:portalId/leaves', portalScope, (req, res, next) => {
    try {
        const leaves = PortalsService.getLeaveRecords(req.portalId);
        res.json({ success: true, data: leaves });
    } catch (err) {
        next(err);
    }
});

router.post('/:portalId/leaves', portalScope, (req, res, next) => {
    try {
        const { startDate, endDate, leaveType } = req.body;
        const leave = PortalsService.createLeaveRecord(req.portalId, {
            userId: req.user.id,
            startDate,
            endDate,
            leaveType
        });
        res.status(201).json({ success: true, data: leave });
    } catch (err) {
        next(err);
    }
});

// Audit Logs
router.get('/:portalId/audit-logs', portalScope, requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const logs = PortalsService.getAuditLogs(req.portalId, parseInt(req.query.limit) || 50);
        res.json({ success: true, data: logs });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
