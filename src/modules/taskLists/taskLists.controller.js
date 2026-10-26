const express = require('express');
const router = express.Router();
const TaskListsService = require('./taskLists.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

router.get('/project/:projectId', (req, res, next) => {
    try {
        const lists = TaskListsService.getTaskLists(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: lists });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { projectId, name } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ success: false, error: 'projectId and name are required.' });
        }
        const list = TaskListsService.createTaskList(req.portalId, req.body);
        res.status(201).json({ success: true, data: list });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req, res, next) => {
    try {
        const list = TaskListsService.getTaskListById(req.portalId, req.params.id, req.isClient);
        res.json({ success: true, data: list });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const list = TaskListsService.updateTaskList(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: list });
    } catch (err) {
        next(err);
    }
});

// Task List Rollover endpoint
router.post('/:id/rollover', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { targetListId, targetPhaseId } = req.body;
        if (!targetListId) {
            return res.status(400).json({ success: false, error: 'targetListId is required for rollover.' });
        }
        const result = TaskListsService.rolloverUncompletedTasks(req.portalId, req.params.id, targetListId, targetPhaseId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = TaskListsService.deleteTaskList(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
