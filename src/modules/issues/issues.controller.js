const express = require('express');
const router = express.Router();
const IssuesService = require('./issues.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

router.get('/project/:projectId', (req, res, next) => {
    try {
        const filters = {
            severity: req.query.severity,
            statusId: req.query.statusId,
            assigneeId: req.query.assigneeId,
            isTrashed: req.query.trashed === 'true'
        };
        const issues = IssuesService.getIssues(req.portalId, req.params.projectId, req.isClient, filters);
        res.json({ success: true, data: issues });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager', 'employee', 'client']), (req, res, next) => {
    try {
        const { projectId, title } = req.body;
        if (!projectId || !title) {
            return res.status(400).json({ success: false, error: 'projectId and title are required.' });
        }
        const issue = IssuesService.createIssue(req.portalId, {
            ...req.body,
            reporterId: req.user.id
        });
        res.status(201).json({ success: true, data: issue });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req, res, next) => {
    try {
        const issue = IssuesService.getIssueById(req.portalId, req.params.id, req.isClient);
        res.json({ success: true, data: issue });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const issue = IssuesService.updateIssue(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: issue });
    } catch (err) {
        next(err);
    }
});

// Convert Issue to Task
router.post('/:id/convert-to-task', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { targetTaskListId, targetPhaseId } = req.body;
        const result = IssuesService.convertIssueToTask(req.portalId, req.params.id, targetTaskListId, targetPhaseId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Duplicate Issue Merging (PDF Feature 84)
router.post('/merge', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { primaryIssueId, duplicateIssueId } = req.body;
        if (!primaryIssueId || !duplicateIssueId) {
            return res.status(400).json({ success: false, error: 'primaryIssueId and duplicateIssueId are required.' });
        }
        const merged = IssuesService.mergeIssues(req.portalId, primaryIssueId, duplicateIssueId);
        res.json({ success: true, data: merged });
    } catch (err) {
        next(err);
    }
});

// Web-to-Issue Intake Form (PDF Feature 79)
router.post('/web-to-issue', (req, res, next) => {
    try {
        const issue = IssuesService.webToIssue(req.portalId, req.body);
        res.status(201).json({ success: true, data: issue });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const result = IssuesService.softDeleteIssue(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
