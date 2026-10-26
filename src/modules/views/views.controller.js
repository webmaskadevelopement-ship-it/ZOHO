const express = require('express');
const router = express.Router();
const ViewsService = require('./views.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

// Public Read-Only Share Viewer (No Auth Required) - PDF Feature 63, ZP-058
router.get('/public-share/:token', (req, res, next) => {
    try {
        const password = req.query.password || req.headers['x-share-password'];
        const shared = ViewsService.getPublicShare(req.params.token, password);
        res.json({ success: true, data: shared });
    } catch (err) {
        res.status(403).json({ success: false, error: err.message });
    }
});

// iCal Feed Export (No Auth Required with Token) - PDF Feature 134, ZP-058
router.get('/ical/:token', (req, res, next) => {
    try {
        const db = require('../../db/database');
        const share = db.queryOne('SELECT portal_id, project_id FROM public_shares WHERE share_token = ? AND is_active = 1', [req.params.token]);
        if (!share) return res.status(404).send('Invalid or expired calendar feed token.');

        const icalData = ViewsService.generateIcalFeed(share.portal_id, share.project_id);
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"');
        res.send(icalData);
    } catch (err) {
        next(err);
    }
});

router.use(authenticate, portalScope, enforceClientVisibility);

// Create Public Share Link (PDF Feature 63)
router.post('/public-share', (req, res, next) => {
    try {
        const { projectId, viewType, isPasswordProtected, password, expiresDays } = req.body;
        if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });
        const share = ViewsService.createPublicShare(req.portalId, { projectId, viewType, isPasswordProtected, password, expiresDays });
        res.status(201).json({ success: true, data: share });
    } catch (err) {
        next(err);
    }
});

// Sheet Grid Tree
router.get('/sheet/:projectId', (req, res, next) => {
    try {
        const tree = ViewsService.getSheetView(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: tree });
    } catch (err) {
        next(err);
    }
});

// Kanban Board View
router.get('/kanban/:projectId', (req, res, next) => {
    try {
        const board = ViewsService.getKanbanView(req.portalId, req.params.projectId, req.query.groupBy || 'status', req.isClient);
        res.json({ success: true, data: board });
    } catch (err) {
        next(err);
    }
});

// Gantt View with Critical Path
router.get('/gantt/:projectId', (req, res, next) => {
    try {
        const gantt = ViewsService.getGanttView(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: gantt });
    } catch (err) {
        next(err);
    }
});

// Resource Workload Heatmap
router.get('/workload/:projectId', (req, res, next) => {
    try {
        const workload = ViewsService.getWorkloadHeatmap(req.portalId, req.params.projectId, req.query.startDate, req.query.endDate);
        res.json({ success: true, data: workload });
    } catch (err) {
        next(err);
    }
});

// Global Dashboard View (Reference Image 1)
router.get('/dashboard/global', (req, res, next) => {
    try {
        const userId = req.user?.id || 'user-nikhil';
        const dashboard = ViewsService.getGlobalDashboard(req.portalId, userId);
        res.json({ success: true, data: dashboard });
    } catch (err) {
        next(err);
    }
});

// My Work / Personal Agenda
router.get('/my-work', (req, res, next) => {
    try {
        const agenda = ViewsService.getMyWork(req.portalId, req.user.id);
        res.json({ success: true, data: agenda });
    } catch (err) {
        next(err);
    }
});

// Eisenhower Matrix (2x2)
router.get('/matrix/:projectId', (req, res, next) => {
    try {
        const matrix = ViewsService.getEisenhowerMatrix(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: matrix });
    } catch (err) {
        next(err);
    }
});

// Execute AST Query
router.post('/query/:projectId', (req, res, next) => {
    try {
        const { criteria, pattern, entityType } = req.body;
        const results = ViewsService.executeAstQuery(req.portalId, req.params.projectId, { criteria, pattern, entityType });
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
});

// Custom Views CRUD
router.get('/custom-views/:projectId', (req, res, next) => {
    try {
        const views = ViewsService.getCustomViews(req.portalId, req.params.projectId, req.user.id);
        res.json({ success: true, data: views });
    } catch (err) {
        next(err);
    }
});

router.post('/custom-views', (req, res, next) => {
    try {
        const view = ViewsService.saveCustomView(req.portalId, {
            ...req.body,
            createdBy: req.user.id
        });
        res.status(201).json({ success: true, data: view });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
