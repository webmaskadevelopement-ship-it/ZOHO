const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const EvmEngine = require('../../engines/evmEngine');

class BudgetsService {
    static getProjectEvm(portalId, projectId) {
        const proj = db.queryOne('SELECT * FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        if (!proj) throw new Error('Project not found.');

        const budgetConfig = JSON.parse(proj.budget_config || '{}');
        const stats = JSON.parse(proj.stats || '{}');

        // Sum actual cost from approved billable logs
        const logs = db.queryAll(
            `SELECT tl.hours, tl.minutes, u.cost_per_hour
             FROM time_logs tl
             JOIN users u ON tl.user_id = u.id
             WHERE tl.project_id = ? AND tl.status = 'approved'`,
            [projectId]
        );

        let laborCost = 0;
        logs.forEach(l => {
            const h = l.hours + ((l.minutes || 0) / 60);
            laborCost += h * (l.cost_per_hour || 50);
        });

        // Sum non-labor expenses
        const expenses = db.queryAll("SELECT amount FROM expenses WHERE project_id = ? AND status = 'approved'", [projectId]);
        const expenseTotal = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

        const totalActualCost = Math.round((laborCost + expenseTotal) * 100) / 100;

        const metrics = EvmEngine.calculateMetrics({
            startDate: proj.start_date,
            endDate: proj.end_date,
            plannedBudget: budgetConfig.plannedCost || 10000,
            completionPercentage: stats.completionPercentage || 0,
            actualCost: totalActualCost
        });

        // Check budget thresholds
        const budgetBurnPercent = metrics.plannedBudget > 0
            ? Math.round((totalActualCost / metrics.plannedBudget) * 100)
            : 0;

        let thresholdAlert = null;
        if (budgetBurnPercent >= 100) {
            thresholdAlert = 'CRITICAL: Project has exceeded 100% of its planned budget!';
        } else if (budgetBurnPercent >= 80) {
            thresholdAlert = 'WARNING: Project has consumed over 80% of its allocated budget.';
        }

        return {
            projectId,
            projectName: proj.name,
            budgetConfig,
            laborCost,
            expenseTotal,
            totalActualCost,
            budgetBurnPercent,
            thresholdAlert,
            ...metrics
        };
    }

    // Expenses
    static getExpenses(portalId, projectId) {
        return db.queryAll('SELECT * FROM expenses WHERE portal_id = ? AND project_id = ? ORDER BY expense_date DESC', [portalId, projectId]);
    }

    static createExpense(portalId, { projectId, category, amount, currency = 'USD', expenseDate, description, receiptUrl = '', isBillable = 1 }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO expenses (id, portal_id, project_id, category, amount, currency, expense_date, description, receipt_url, is_billable, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)`,
            [id, portalId, projectId, category, Number(amount), currency, expenseDate, description, receiptUrl, isBillable ? 1 : 0, now]
        );
        return db.queryOne('SELECT * FROM expenses WHERE id = ?', [id]);
    }

    // Invoices
    static getInvoices(portalId, projectId) {
        return db.queryAll('SELECT * FROM invoices WHERE portal_id = ? AND project_id = ? ORDER BY issue_date DESC', [portalId, projectId]);
    }

    static generateInvoice(portalId, { projectId, clientCompanyId, dueDate, taxPercent = 0 }) {
        const proj = db.queryOne('SELECT name, key_prefix FROM projects WHERE id = ?', [projectId]);
        if (!proj) throw new Error('Project not found.');

        // Get unbilled approved billable time logs
        const billableLogs = db.queryAll(
            `SELECT tl.*, u.name as user_name, u.billable_rate_per_hour
             FROM time_logs tl
             JOIN users u ON tl.user_id = u.id
             WHERE tl.project_id = ? AND tl.status = 'approved' AND tl.is_billable = 1`,
            [projectId]
        );

        let subtotal = 0;
        const items = [];

        billableLogs.forEach(l => {
            const h = l.hours + ((l.minutes || 0) / 60);
            const rate = l.billable_rate_per_hour || 100;
            const itemTotal = Math.round(h * rate * 100) / 100;
            subtotal += itemTotal;

            items.push({
                type: 'time_log',
                description: `${l.user_name}: ${l.work_notes || 'Consulting'} (${h.toFixed(1)} hrs @ $${rate}/hr)`,
                hours: h,
                rate,
                total: itemTotal
            });
        });

        // Add billable expenses
        const billableExpenses = db.queryAll(
            "SELECT * FROM expenses WHERE project_id = ? AND is_billable = 1 AND status = 'approved'",
            [projectId]
        );

        billableExpenses.forEach(e => {
            subtotal += e.amount;
            items.push({
                type: 'expense',
                description: `${e.category}: ${e.description}`,
                amount: e.amount,
                total: e.amount
            });
        });

        const tax = Math.round((subtotal * (taxPercent / 100)) * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        const id = uuidv4();
        const invoiceNum = `INV-${proj.key_prefix}-${Date.now().toString().slice(-4)}`;
        const now = new Date().toISOString();
        const issueDate = now.split('T')[0];
        const finalDue = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        db.execute(
            `INSERT INTO invoices (
                id, portal_id, project_id, invoice_number, client_company_id,
                issue_date, due_date, items, subtotal, tax, total, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [
                id, portalId, projectId, invoiceNum, clientCompanyId,
                issueDate, finalDue, JSON.stringify(items), subtotal, tax, total, now
            ]
        );

        const inv = db.queryOne('SELECT * FROM invoices WHERE id = ?', [id]);
        return {
            ...inv,
            items: JSON.parse(inv.items || '[]')
        };
    }
}

module.exports = BudgetsService;
