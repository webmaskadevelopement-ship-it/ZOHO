const express = require('express');
const router = express.Router();
const TasksService = require('./tasks.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

// List tasks for a project
router.get('/project/:projectId', (req, res, next) => {
    try {
        const filters = {
            phaseId: req.query.phaseId,
            taskListId: req.query.taskListId,
            assigneeId: req.query.assigneeId,
            statusId: req.query.statusId,
            isTrashed: req.query.trashed === 'true',
            myTasks: req.query.myTasks === 'true' || req.query.assignedToMe === 'true',
            userId: req.user?.id,
            userRole: req.user?.role,
            department: req.user?.department
        };
        const tasks = TasksService.getTasks(req.portalId, req.params.projectId, req.isClient, filters);
        res.json({ success: true, data: tasks });
    } catch (err) {
        next(err);
    }
});

// Create task under a project
router.post('/project/:projectId', requireRole(['admin', 'manager', 'employee', 'member', 'client']), (req, res, next) => {
    try {
        const payload = { ...req.body, projectId: req.params.projectId };
        if (!payload.name) {
            return res.status(400).json({ success: false, error: 'Task name is required.' });
        }
        const task = TasksService.createTask(req.portalId, payload);
        res.status(201).json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
});

// Create task root route
router.post('/', requireRole(['admin', 'manager', 'employee', 'member', 'client']), (req, res, next) => {
    try {
        const { projectId, taskListId, name } = req.body;
        if (!projectId || !taskListId || !name) {
            return res.status(400).json({ success: false, error: 'projectId, taskListId, and name are required.' });
        }
        const task = TasksService.createTask(req.portalId, req.body);
        res.status(201).json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
});

// Bulk update tasks (PDF Feature 50)
router.post('/bulk', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { taskIds, updates } = req.body;
        const result = TasksService.bulkUpdate(req.portalId, { taskIds, updates });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/bulk-update', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { taskIds, updates } = req.body;
        const result = TasksService.bulkUpdate(req.portalId, { taskIds, updates });
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Task Voting & Prioritization (PDF Feature 48)
router.post('/:id/vote', (req, res, next) => {
    try {
        const votes = TasksService.voteTask(req.portalId, req.params.id, req.user.id);
        res.json({ success: true, data: votes });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id/vote', (req, res, next) => {
    try {
        const votes = TasksService.unvoteTask(req.portalId, req.params.id, req.user.id);
        res.json({ success: true, data: votes });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/votes', (req, res, next) => {
    try {
        const votes = TasksService.getTaskVotes(req.portalId, req.params.id);
        res.json({ success: true, data: votes });
    } catch (err) {
        next(err);
    }
});

// Task Linking & Relations (PDF Feature 49)
router.post('/:id/relations', (req, res, next) => {
    try {
        const { targetTaskId, relationType } = req.body;
        const relations = TasksService.addTaskRelation(req.portalId, {
            sourceTaskId: req.params.id,
            targetTaskId,
            relationType
        });
        res.status(201).json({ success: true, data: relations });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/relations', (req, res, next) => {
    try {
        const relations = TasksService.getTaskRelations(req.portalId, req.params.id);
        res.json({ success: true, data: relations });
    } catch (err) {
        next(err);
    }
});

// Smart Task Reminders (PDF Feature 44)
router.post('/:id/reminders', (req, res, next) => {
    try {
        const { recipientId, triggerType, remindAt, offsetMinutes } = req.body;
        const reminder = TasksService.createTaskReminder(req.portalId, {
            taskId: req.params.id,
            recipientId: recipientId || req.user.id,
            triggerType,
            remindAt,
            offsetMinutes
        });
        res.status(201).json({ success: true, data: reminder });
    } catch (err) {
        next(err);
    }
});

// Get task by ID
router.get('/:id', (req, res, next) => {
    try {
        const task = TasksService.getTaskById(req.portalId, req.params.id, req.isClient);
        res.json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
});

// Update task
router.put('/:id', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const task = TasksService.updateTask(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
});

// Quick Status Transition (1-click from Kanban or Sheet)
router.patch('/:id/quick-status', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { statusId } = req.body;
        if (!statusId) return res.status(400).json({ success: false, error: 'statusId is required.' });
        const completionPercentage = (statusId === 'completed' || statusId === 'closed') ? 100 : (statusId === 'in_progress' ? 50 : 0);
        const task = TasksService.updateTask(req.portalId, req.params.id, {
            statusId,
            completionPercentage
        });
        res.json({ success: true, data: task });
    } catch (err) {
        next(err);
    }
});

// Soft Delete (move to trash)
router.delete('/:id', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const result = TasksService.softDeleteTask(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Restore from trash
router.post('/:id/restore', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = TasksService.restoreTask(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
