const express = require('express');
const router = express.Router();
const ReportsService = require('./reports.service');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

// Creative: Vector SVG Gantt Generator (supports direct download from browser tabs)
router.get('/gantt-svg/:projectId', optionalAuth, (req, res, next) => {
    try {
        const portalId = req.headers['x-portal-id'] || req.query.portalId || 'portal-demo-zoho';
        const svg = ReportsService.getGanttSvg(portalId, req.params.projectId);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
    } catch (err) {
        next(err);
    }
});

// Creative: Executive Status Briefing
router.get('/executive-brief/:projectId', optionalAuth, (req, res, next) => {
    try {
        const portalId = req.headers['x-portal-id'] || req.query.portalId || 'portal-demo-zoho';
        const brief = ReportsService.getExecutiveBrief(portalId, req.params.projectId);
        res.json({ success: true, data: { markdown: brief } });
    } catch (err) {
        next(err);
    }
});

router.use(authenticate, portalScope, enforceClientVisibility);

// Burndown & Velocity
router.get('/burndown/:projectId', (req, res, next) => {
    try {
        const data = ReportsService.getBurndown(req.portalId, req.params.projectId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// Planned vs Actual Hours
router.get('/planned-vs-actual/:projectId', (req, res, next) => {
    try {
        const data = ReportsService.getPlannedVsActualHours(req.portalId, req.params.projectId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// Status & Priority Distribution
router.get('/distributions/:projectId', (req, res, next) => {
    try {
        const data = ReportsService.getTaskDistributions(req.portalId, req.params.projectId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// SLA & MTTR Report
router.get('/sla/:projectId', (req, res, next) => {
    try {
        const data = ReportsService.getSlaReport(req.portalId, req.params.projectId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

// Portfolio Rollup Summary
router.get('/portfolio-summary', (req, res, next) => {
    try {
        const data = ReportsService.getPortfolioSummary(req.portalId);
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
