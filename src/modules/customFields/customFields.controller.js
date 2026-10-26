const express = require('express');
const router = express.Router();
const CustomFieldsService = require('./customFields.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

// List custom fields
router.get('/', (req, res, next) => {
    try {
        const fields = CustomFieldsService.getCustomFields(req.portalId, req.query.projectId, req.query.entityType);
        res.json({ success: true, data: fields });
    } catch (err) {
        next(err);
    }
});

// Create custom field
router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const field = CustomFieldsService.createCustomField(req.portalId, req.body);
        res.status(201).json({ success: true, data: field });
    } catch (err) {
        next(err);
    }
});

// Delete custom field
router.delete('/:id', requireRole(['admin']), (req, res, next) => {
    try {
        const result = CustomFieldsService.deleteCustomField(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Layouts CRUD
router.get('/layouts', (req, res, next) => {
    try {
        const layouts = CustomFieldsService.getLayouts(req.portalId);
        res.json({ success: true, data: layouts });
    } catch (err) {
        next(err);
    }
});

router.post('/layouts', requireRole(['admin']), (req, res, next) => {
    try {
        const layout = CustomFieldsService.createLayout(req.portalId, req.body);
        res.status(201).json({ success: true, data: layout });
    } catch (err) {
        next(err);
    }
});

router.put('/layouts/:id', requireRole(['admin']), (req, res, next) => {
    try {
        const layout = CustomFieldsService.updateLayout(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: layout });
    } catch (err) {
        next(err);
    }
});

// Evaluate Formula Column
router.post('/evaluate-formula', (req, res, next) => {
    try {
        const { formula, context } = req.body;
        const result = CustomFieldsService.evaluateFormula(formula, context);
        res.json({ success: true, result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
