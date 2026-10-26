const express = require('express');
const router = express.Router();
const InvoicesService = require('./invoices.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');

router.use(authenticate, portalScope);

// List invoices
router.get('/', (req, res, next) => {
    try {
        const invoices = InvoicesService.getInvoices(req.portalId, req.query.projectId);
        res.json({ success: true, data: invoices });
    } catch (err) {
        next(err);
    }
});

// Generate invoice from timesheets & expenses
router.post('/generate-from-timesheet', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { projectId, clientCompanyId, dueDate, taxPercentage, currency } = req.body;
        if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });

        const invoice = InvoicesService.generateFromTimesheetsAndExpenses(req.portalId, {
            projectId,
            clientCompanyId,
            dueDate,
            taxPercentage,
            currency
        });
        res.status(201).json({ success: true, data: invoice });
    } catch (err) {
        next(err);
    }
});

// Create manual invoice
router.post('/', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const invoice = InvoicesService.createInvoice(req.portalId, req.body);
        res.status(201).json({ success: true, data: invoice });
    } catch (err) {
        next(err);
    }
});

// Get invoice by ID
router.get('/:id', (req, res, next) => {
    try {
        const invoice = InvoicesService.getInvoiceById(req.portalId, req.params.id);
        res.json({ success: true, data: invoice });
    } catch (err) {
        next(err);
    }
});

// Update invoice status
router.patch('/:id/status', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ success: false, error: 'status is required.' });
        const invoice = InvoicesService.updateStatus(req.portalId, req.params.id, status);
        res.json({ success: true, data: invoice });
    } catch (err) {
        next(err);
    }
});

// Export invoice
router.get('/:id/export', (req, res, next) => {
    try {
        const format = req.query.format || 'json';
        const exported = InvoicesService.exportInvoice(req.portalId, req.params.id, format);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
            return res.send(exported.content);
        }
        res.json({ success: true, data: exported.content });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
