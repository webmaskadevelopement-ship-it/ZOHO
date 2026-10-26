const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class InvoicesService {
    static getInvoices(portalId, projectId = null) {
        let sql = 'SELECT * FROM invoices WHERE portal_id = ?';
        const params = [portalId];
        if (projectId) {
            sql += ' AND project_id = ?';
            params.push(projectId);
        }
        sql += ' ORDER BY created_at DESC';
        const rows = db.queryAll(sql, params);
        return rows.map(r => ({
            ...r,
            items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : r.items
        }));
    }

    static getInvoiceById(portalId, invoiceId) {
        const inv = db.queryOne('SELECT * FROM invoices WHERE portal_id = ? AND id = ?', [portalId, invoiceId]);
        if (!inv) throw new Error('Invoice not found.');
        return {
            ...inv,
            items: typeof inv.items === 'string' ? JSON.parse(inv.items || '[]') : inv.items
        };
    }

    static createInvoice(portalId, { projectId, clientCompanyId = null, invoiceNumber, issueDate, dueDate, items = [], subtotal = 0, taxPercentage = 0, currency = 'USD' }) {
        if (!projectId || !invoiceNumber) throw new Error('projectId and invoiceNumber are required.');
        const id = uuidv4();
        const now = new Date().toISOString();
        const tax = Math.round((subtotal * (taxPercentage / 100)) * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        db.execute(
            `INSERT INTO invoices (id, portal_id, project_id, invoice_number, client_company_id, issue_date, due_date, items, subtotal, tax, total, currency, tax_percentage, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [id, portalId, projectId, invoiceNumber, clientCompanyId, issueDate || now.split('T')[0], dueDate || now.split('T')[0], JSON.stringify(items), subtotal, tax, total, currency, taxPercentage, now]
        );
        return this.getInvoiceById(portalId, id);
    }

    /**
     * PDF Feature 96: Generate Client Invoice directly from approved billable time logs and expenses
     */
    static generateFromTimesheetsAndExpenses(portalId, { projectId, clientCompanyId = null, dueDate, taxPercentage = 0, currency = 'USD' }) {
        const proj = db.queryOne('SELECT name, key_prefix FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        if (!proj) throw new Error('Project not found.');

        // 1. Fetch approved billable time logs
        const billableLogs = db.queryAll(
            `SELECT tl.*, u.name as user_name, u.billable_rate_per_hour, t.name as task_name
             FROM time_logs tl
             JOIN users u ON tl.user_id = u.id
             LEFT JOIN tasks t ON tl.task_id = t.id
             WHERE tl.project_id = ? AND tl.portal_id = ? AND tl.status = 'approved' AND tl.is_billable = 1`,
            [projectId, portalId]
        );

        // 2. Fetch approved billable expenses
        const billableExpenses = db.queryAll(
            `SELECT * FROM expenses WHERE project_id = ? AND portal_id = ? AND status = 'approved' AND is_billable = 1`,
            [projectId, portalId]
        );

        const items = [];
        let subtotal = 0;

        // Group time logs by user/task
        billableLogs.forEach(log => {
            const hoursDecimal = Math.round((log.hours + ((log.minutes || 0) / 60)) * 100) / 100;
            const rate = log.billable_rate_per_hour || 75.0;
            const amount = Math.round(hoursDecimal * rate * 100) / 100;
            subtotal += amount;

            items.push({
                type: 'time_log',
                description: `${log.task_name ? log.task_name + ' - ' : ''}${log.user_name} (${hoursDecimal} hrs @ $${rate}/hr)`,
                quantity: hoursDecimal,
                unitPrice: rate,
                total: amount,
                date: log.log_date
            });
        });

        // Add billable expenses
        billableExpenses.forEach(exp => {
            const amount = Number(exp.amount) || 0;
            subtotal += amount;
            items.push({
                type: 'expense',
                description: `${exp.category}: ${exp.description || 'Project Expense'}`,
                quantity: 1,
                unitPrice: amount,
                total: amount,
                date: exp.expense_date
            });
        });

        subtotal = Math.round(subtotal * 100) / 100;
        const tax = Math.round((subtotal * (taxPercentage / 100)) * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;

        const count = db.queryOne('SELECT COUNT(*) as cnt FROM invoices WHERE portal_id = ?', [portalId]).cnt;
        const invoiceNumber = `INV-${proj.key_prefix}-${String(count + 1).padStart(4, '0')}`;
        const now = new Date().toISOString();
        const targetDueDate = dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const id = uuidv4();
        db.execute(
            `INSERT INTO invoices (id, portal_id, project_id, invoice_number, client_company_id, issue_date, due_date, items, subtotal, tax, total, currency, tax_percentage, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [id, portalId, projectId, invoiceNumber, clientCompanyId, now.split('T')[0], targetDueDate, JSON.stringify(items), subtotal, tax, total, currency, taxPercentage, now]
        );

        return this.getInvoiceById(portalId, id);
    }

    static updateStatus(portalId, invoiceId, status) {
        const allowed = ['draft', 'sent', 'paid', 'cancelled'];
        if (!allowed.includes(status)) throw new Error(`Invalid invoice status: ${status}`);
        const paidAt = status === 'paid' ? new Date().toISOString() : null;
        db.execute(
            'UPDATE invoices SET status = ?, paid_at = ? WHERE id = ? AND portal_id = ?',
            [status, paidAt, invoiceId, portalId]
        );
        return this.getInvoiceById(portalId, invoiceId);
    }

    static exportInvoice(portalId, invoiceId, format = 'json') {
        const inv = this.getInvoiceById(portalId, invoiceId);
        if (format === 'csv') {
            const header = 'Type,Description,Quantity,UnitPrice,Total,Date\n';
            const rows = inv.items.map(it => `"${it.type}","${it.description}",${it.quantity},${it.unitPrice},${it.total},"${it.date}"`).join('\n');
            const summary = `\nSubtotal,,,,,${inv.subtotal}\nTax (${inv.tax_percentage}%),,,,,${inv.tax}\nTotal,,,,,${inv.total}\n`;
            return { format: 'csv', content: header + rows + summary, filename: `${inv.invoice_number}.csv` };
        }
        return { format: 'json', content: inv, filename: `${inv.invoice_number}.json` };
    }
}

module.exports = InvoicesService;
