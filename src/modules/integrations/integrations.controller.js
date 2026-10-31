const express = require('express');
const router = express.Router();
const IntegrationsService = require('./integrations.service');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

// Public OpenAPI spec endpoint
router.get('/swagger.json', (req, res) => {
    res.json(IntegrationsService.getOpenApiSpec());
});

// Git Webhook (supports secret or public token)
router.post('/git-webhook', optionalAuth, (req, res, next) => {
    try {
        const portalId = req.headers['x-portal-id'] || req.query.portalId || 'demo-portal-id';
        const result = IntegrationsService.handleGitWebhook(portalId, req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Firebase Status & Diagnostics
const FirebaseSyncService = require('../../services/firebaseSyncService');

router.get('/firebase/status', (req, res) => {
    try {
        const status = FirebaseSyncService.getStatus();
        res.json({ success: true, data: status });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Form Email Submission (Public or Authenticated Intake)
router.post('/firebase/submit-email', optionalAuth, async (req, res) => {
    try {
        const { email, name, role, source, portalId, metadata } = req.body;
        const result = await FirebaseSyncService.recordEmailSubmission({
            email,
            name,
            role: role || 'employee',
            source: source || 'public_form',
            portalId: portalId || req.portalId || 'portal-demo-zoho',
            metadata: metadata || {}
        });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// List Submitted Emails
router.get('/firebase/submitted-emails', optionalAuth, (req, res) => {
    try {
        const emails = FirebaseSyncService.getSubmittedEmails();
        res.json({ success: true, data: emails });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.use(authenticate, portalScope);

// Project Importer
router.post('/import/:projectId', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { source, items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, error: 'items array is required for import.' });
        }
        const result = IntegrationsService.importProjectData(req.portalId, req.params.projectId, { source, items });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Project Export (JSON or CSV)
router.get('/export/:projectId', (req, res, next) => {
    try {
        const format = req.query.format || 'json';
        const result = IntegrationsService.exportProjectData(req.portalId, req.params.projectId, format);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="project-${req.params.projectId}-tasks.csv"`);
            return res.send(result);
        }

        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Real Production Data Ingestion Endpoint
router.post('/import-real-data', requireRole(['admin']), async (req, res, next) => {
    try {
        const DataIngestionService = require('../../services/dataIngestionService');
        const results = await DataIngestionService.ingestPayload(req.portalId, req.body);
        res.status(201).json({ success: true, message: 'Real data imported successfully.', data: results });
    } catch (err) {
        next(err);
    }
});

// Test SMTP Email Dispatch
router.post('/test-email', async (req, res, next) => {
    try {
        const EmailService = require('../../services/emailService');
        const { to = req.user.email, subject = 'Life PMS Test Notification', text = 'This is a test notification from Life PMS.' } = req.body;
        const result = await EmailService.sendMail({ to, subject, text, html: `<div style="font-family:sans-serif;padding:16px;"><h2>${subject}</h2><p>${text}</p></div>` });
        res.json({ success: true, message: 'Email sent or simulated.', result });
    } catch (err) {
        next(err);
    }
});

// Test FCM Push Dispatch
router.post('/test-push', async (req, res, next) => {
    try {
        const FcmService = require('../../services/fcmNotificationService');
        const { deviceToken = 'demo-token', title = 'Task Assigned', body = 'You have a new work item in WE-11 AI Training.' } = req.body;
        const result = await FcmService.sendPushToDevice(deviceToken, { title, body });
        res.json({ success: true, message: 'Push notification processed.', result });
    } catch (err) {
        next(err);
    }
});


const { admin, firestoreDb } = require('../../services/firebaseFirestoreService');
router.admin = admin;
router.firestoreDb = firestoreDb;

module.exports = router;
module.exports.admin = admin;
module.exports.firestoreDb = firestoreDb;

