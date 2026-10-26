const express = require('express');
const router = express.Router();
const TeamsService = require('./teams.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

router.get('/', (req, res, next) => {
    try {
        const teams = TeamsService.getTeams(req.portalId);
        res.json({ success: true, data: teams });
    } catch (err) {
        next(err);
    }
});

router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { name, description, memberIds } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Team name is required.' });
        const team = TeamsService.createTeam(req.portalId, { name, description, memberIds });
        res.status(201).json({ success: true, data: team });
    } catch (err) {
        next(err);
    }
});

router.put('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const team = TeamsService.updateTeam(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: team });
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = TeamsService.deleteTeam(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
