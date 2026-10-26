const express = require('express');
const router = express.Router();
const BudgetsService = require('./budgets.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { requireRole } = require('../../middleware/rbac');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');

router.use(authenticate, portalScope, enforceClientVisibility);

// EVM Analytics for Project
router.get('/evm/:projectId', (req, res, next) => {
    try {
        const metrics = BudgetsService.getProjectEvm(req.portalId, req.params.projectId);
        res.json({ success: true, data: metrics });
    } catch (err) {
        next(err);
    }
});

// Expenses
router.get('/expenses/:projectId', (req, res, next) => {
    try {
        const expenses = BudgetsService.getExpenses(req.portalId, req.params.projectId);
        res.json({ success: true, data: expenses });
    } catch (err) {
        next(err);
    }
});

router.post('/expenses', requireRole(['admin', 'manager', 'employee']), (req, res, next) => {
    try {
        const { projectId, category, amount, expenseDate } = req.body;
        if (!projectId || !category || !amount || !expenseDate) {
            return res.status(400).json({ success: false, error: 'projectId, category, amount, and expenseDate are required.' });
        }
        const exp = BudgetsService.createExpense(req.portalId, req.body);
        res.status(201).json({ success: true, data: exp });
    } catch (err) {
        next(err);
    }
});

// Invoices
router.get('/invoices/:projectId', (req, res, next) => {
    try {
        const invoices = BudgetsService.getInvoices(req.portalId, req.params.projectId);
        res.json({ success: true, data: invoices });
    } catch (err) {
        next(err);
    }
});

router.post('/invoices/generate', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const { projectId } = req.body;
        if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required.' });

        const inv = BudgetsService.generateInvoice(req.portalId, req.body);
        res.status(201).json({ success: true, data: inv });
    } catch (err) {
        next(err);
    }
});

// Rate Cards (PDF Feature 92)
const RateCardsService = require('./rateCards.service');

router.get('/rate-cards', (req, res, next) => {
    try {
        const cards = RateCardsService.getRateCards(req.portalId);
        res.json({ success: true, data: cards });
    } catch (err) {
        next(err);
    }
});

router.post('/rate-cards', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const card = RateCardsService.createRateCard(req.portalId, req.body);
        res.status(201).json({ success: true, data: card });
    } catch (err) {
        next(err);
    }
});

router.put('/rate-cards/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const card = RateCardsService.updateRateCard(req.portalId, req.params.id, req.body);
        res.json({ success: true, data: card });
    } catch (err) {
        next(err);
    }
});

router.delete('/rate-cards/:id', requireRole(['admin', 'manager']), (req, res, next) => {
    try {
        const result = RateCardsService.deleteRateCard(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
