const express = require('express');
const router = express.Router();
const PhasesService = require('./phases.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

router.get('/project/:projectId', (req, res, next) => {
    try {
        const phases = PhasesService.getPhases(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: phases });
    } catch (err) {
        next(err);
    }
});

router.post('/project/:projectId', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const payload = { ...req.body, projectId: req.params.projectId };
        if (!payload.name) {
            return res.status(400).json({ success: false, error: 'Milestone name is required.' });
        }
        const phase = PhasesService.createPhase(req.portalId, payload);
        res.status(201).json({ success: true, data: phase });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { projectId, name } = req.body;
        if (!projectId || !name) {
            return res.status(400).json({ success: false, error: 'projectId and name are required.' });
        }
        const phase = PhasesService.createPhase(req.portalId, req.body);
        res.status(201).json({ success: true, data: phase });
    } catch (err) {
        next(err);
    }
});

router.patch('/:id/status', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, error: 'status is required.' });
        const completionPercentage = (status === 'completed' || status === 'closed') ? 100 : 0;
        const phase = PhasesService.updatePhase(req.portalId, req.params.id, {
            status,
            completionPercentage
        });
        res.json({ success: true, data: phase });
    } catch (err) {
        next(err);
    }
});

router.get('/:id', (req, res, next) => {
    try {
        const phase = PhasesService.getPhaseById(req.portalId, req.params.id, req.isClient);
        res.json({ success: true, data: phase });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const phase = PhasesService.updatePhase(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: phase });
    } catch (err) {
        next(err);
    }
});

// Sequential Phase Chaining (PDF Feature 26)
router.post('/:id/chain', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { startAfterPhaseId, offsetDays } = req.body;
        if (!startAfterPhaseId) {
            return res.status(400).json({ success: false, error: 'startAfterPhaseId is required for phase chaining.' });
        }
        const chained = PhasesService.chainPhase(req.portalId, req.params.id, { startAfterPhaseId, offsetDays });
        res.json({ success: true, data: chained });
    } catch (err) {
        next(err);
    }
});

// Release Notes Generator (PDF Feature 82)
router.get('/:id/release-notes', (req, res, next) => {
    try {
        const notes = PhasesService.generateReleaseNotes(req.portalId, req.params.id);
        res.json({ success: true, data: notes });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = PhasesService.deletePhase(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
