const express = require('express');
const router = express.Router();
const TimesheetsService = require('./timesheets.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

// Stopwatch Timer endpoints
router.post('/timer/start', (req, res, next) => {
    try {
        const timer = TimesheetsService.startTimer(req.portalId, req.user.id, req.body);
        res.status(201).json({ success: true, data: timer });
    } catch (err) {
        next(err);
    }
});

router.get('/timer/active', (req, res, next) => {
    try {
        const timer = TimesheetsService.getActiveTimer(req.user.id);
        res.json({ success: true, data: timer });
    } catch (err) {
        next(err);
    }
});

router.post('/timer/stop', (req, res, next) => {
    try {
        const result = TimesheetsService.stopTimer(req.portalId, req.user.id, req.body.workNotes);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Time Logs list
router.get('/', (req, res, next) => {
    try {
        const filters = {
            projectId: req.query.projectId,
            userId: req.user.role === 'employee' || req.user.role === 'contractor' ? req.user.id : req.query.userId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            status: req.query.status
        };
        const logs = TimesheetsService.getTimeLogs(req.portalId, filters);
        res.json({ success: true, data: logs });
    } catch (err) {
        next(err);
    }
});

// Manual log entry
router.post('/', (req, res, next) => {
    try {
        const { projectId, logDate, hours } = req.body;
        if (!projectId || !logDate || hours === undefined) {
            return res.status(400).json({ success: false, error: 'projectId, logDate, and hours are required.' });
        }
        const log = TimesheetsService.createTimeLog(req.portalId, {
            ...req.body,
            userId: req.user.id
        });
        res.status(201).json({ success: true, data: log });
    } catch (err) {
        next(err);
    }
});

// Submit weekly timesheet
router.post('/submit', (req, res, next) => {
    try {
        const { timeLogIds } = req.body;
        const result = TimesheetsService.submitTimesheets(req.portalId, req.user.id, { timeLogIds });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Review / Approve / Reject
router.put('/:id/review', requireRole(['admin', 'manager', 'client']), (req, res, next) => {
    try {
        const { status, comment } = req.body;
        const result = TimesheetsService.reviewTimeLog(req.portalId, req.params.id, req.user.id, { status, comment });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Weekly Timesheet Grid
router.get('/weekly-grid', (req, res, next) => {
    try {
        const weekStartDate = req.query.startDate || new Date().toISOString().split('T')[0];
        const grid = TimesheetsService.getWeeklyGrid(req.portalId, req.user.id, weekStartDate);
        res.json({ success: true, data: grid });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
