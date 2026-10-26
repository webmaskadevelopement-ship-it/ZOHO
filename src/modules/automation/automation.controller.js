const express = require('express');
const router = express.Router();
const AutomationService = require('./automation.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

// Business Rules
router.get('/rules', (req, res, next) => {
    try {
        const rules = AutomationService.getRules(req.portalId, req.query.projectId);
        res.json({ success: true, data: rules });
    } catch (err) {
        next(err);
    }
});

router.post('/rules', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { name, triggerType } = req.body;
        if (!name || !triggerType) {
            return res.status(400).json({ success: false, error: 'name and triggerType are required.' });
        }
        const rule = AutomationService.createRule(req.portalId, req.body);
        res.status(201).json({ success: true, data: rule });
    } catch (err) {
        next(err);
    }
});

// Webhooks
router.get('/webhooks', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const webhooks = AutomationService.getWebhooks(req.portalId);
        res.json({ success: true, data: webhooks });
    } catch (err) {
        next(err);
    }
});

router.post('/webhooks', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { targetUrl } = req.body;
        if (!targetUrl) return res.status(400).json({ success: false, error: 'targetUrl is required.' });

        const webhook = AutomationService.createWebhook(req.portalId, req.body);
        res.status(201).json({ success: true, data: webhook });
    } catch (err) {
        next(err);
    }
});

router.delete('/webhooks/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = AutomationService.deleteWebhook(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
