const express = require('express');
const router = express.Router();
const RequestsService = require('./requests.service');
const { authenticate } = require('../../middleware/auth');

// POST /api/v1/requests - Send a new in-app request
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { receiver_id, username, email, request_type, target_entity_id, payload } = req.body;
        const result = await RequestsService.createRequest(req.user, {
            receiver_id,
            username,
            email,
            request_type,
            target_entity_id,
            payload
        });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// GET /api/v1/requests/incoming - List all pending incoming requests for the logged-in user
// GET /api/v1/requests/approvals - List collaboration approvals for My Approvals section
router.get('/approvals', authenticate, (req, res, next) => {
    try {
        const approvals = RequestsService.getApprovalsForUser(req.user.id, req.user.role);
        res.json({ success: true, data: approvals, count: approvals.length });
    } catch (err) {
        next(err);
    }
});

router.get('/incoming', authenticate, (req, res, next) => {
    try {
        const requests = RequestsService.getIncomingRequests(req.user.id);
        res.json({ success: true, data: requests, count: requests.length });
    } catch (err) {
        next(err);
    }
});

// GET /api/v1/requests/sent - List outgoing requests sent by the logged-in user
router.get('/sent', authenticate, (req, res, next) => {
    try {
        const requests = RequestsService.getSentRequests(req.user.id);
        res.json({ success: true, data: requests, count: requests.length });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/v1/requests/:id/respond - Accept or Reject a request
router.patch('/:id/respond', authenticate, async (req, res, next) => {
    try {
        const { action } = req.body;
        if (!action) {
            return res.status(400).json({ success: false, error: "Field 'action' is required (ACCEPT or REJECT)." });
        }
        const result = await RequestsService.respondToRequest(req.params.id, req.user.id, action);
        res.json({ success: true, data: result });
    } catch (err) {
        const isAuthErr = err.message.includes('Unauthorized');
        res.status(isAuthErr ? 403 : 400).json({ success: false, error: err.message });
    }
});

// DELETE /api/v1/requests/:id - Cancel a pending outgoing request
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await RequestsService.cancelRequest(req.params.id, req.user.id);
        res.json({ success: true, data: result });
    } catch (err) {
        const isAuthErr = err.message.includes('Unauthorized');
        res.status(isAuthErr ? 403 : 400).json({ success: false, error: err.message });
    }
});

module.exports = router;

