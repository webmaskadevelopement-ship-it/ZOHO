const express = require('express');
const router = express.Router();
const AiCoPilotService = require('../../services/aiCoPilotService');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');

router.use(authenticate, portalScope);

// AI WBS Co-Pilot (PDF Feature 137, ZP-051)
router.post('/wbs-copilot', async (req, res, next) => {
    try {
        const { brief, projectDurationWeeks, projectType } = req.body;
        const wbs = await AiCoPilotService.generateWbs({ brief, projectDurationWeeks, projectType });
        res.json({ success: true, data: wbs });
    } catch (err) {
        next(err);
    }
});

// AI Risk & Schedule Bottleneck Predictor (PDF Feature 138, ZP-052)
router.post('/risk-predictor', (req, res, next) => {
    try {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });
        const analysis = AiCoPilotService.analyzeProjectRisk(req.portalId, projectId);
        res.json({ success: true, data: analysis });
    } catch (err) {
        next(err);
    }
});

// AI Thread & Meeting Summarizer (PDF Feature 139, ZP-053)
router.post('/summarize-thread', (req, res, next) => {
    try {
        const { comments } = req.body;
        const summary = AiCoPilotService.summarizeThread(comments);
        res.json({ success: true, data: summary });
    } catch (err) {
        next(err);
    }
});

// AI Bug Triage & Classification (PDF Feature 139, ZP-053)
router.post('/triage-issue', (req, res, next) => {
    try {
        const { title, description } = req.body;
        const triage = AiCoPilotService.triageIssue({ title, description });
        res.json({ success: true, data: triage });
    } catch (err) {
        next(err);
    }
});

// Vector / Semantic Search (PDF Feature 73, ZP-054)
router.post('/semantic-search', (req, res, next) => {
    try {
        const { query, projectId, limit } = req.body;
        const results = AiCoPilotService.semanticSearch(req.portalId, { query, projectId, limit });
        res.json({ success: true, data: results });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
