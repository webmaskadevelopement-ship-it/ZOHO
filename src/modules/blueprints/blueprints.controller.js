const express = require('express');
const router = express.Router();
const BlueprintsService = require('./blueprints.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

router.get('/', (req, res, next) => {
    try {
        const blueprints = BlueprintsService.getBlueprints(req.portalId, req.query.entityType);
        res.json({ success: true, data: blueprints });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Blueprint name is required.' });

        const bp = BlueprintsService.createBlueprint(req.portalId, req.body);
        res.status(201).json({ success: true, data: bp });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req, res, next) => {
    try {
        const bp = BlueprintsService.getBlueprintById(req.portalId, req.params.id);
        res.json({ success: true, data: bp });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const bp = BlueprintsService.updateBlueprint(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: bp });
    } catch (err) {
        next(err);
    }
});

// Execute Transition
router.post('/execute-transition', (req, res, next) => {
    try {
        let { blueprintId, entityType, entityId, taskId, targetStateId, targetState, inputPrompts, promptData } = req.body;

        entityType = entityType || 'task';
        entityId = entityId || taskId;
        targetStateId = targetStateId || targetState;
        inputPrompts = inputPrompts || promptData || {};

        if (!blueprintId) {
            const bps = BlueprintsService.getBlueprints(req.portalId, entityType);
            if (bps && bps.length > 0) {
                blueprintId = bps[0].id;
            }
        }

        if (!blueprintId || !entityId || !targetStateId) {
            return res.status(400).json({ success: false, error: 'blueprintId, entityId, and targetStateId are required.' });
        }

        const userRole = req.portalMember?.role || req.user?.role || 'admin';
        const result = BlueprintsService.executeTransition(req.portalId, {
            blueprintId,
            entityType,
            entityId,
            targetStateId,
            userRole,
            userId: req.user?.id,
            inputPrompts
        });

        res.json({
            success: true,
            data: {
                ...result,
                status: result.status_id || targetStateId
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
