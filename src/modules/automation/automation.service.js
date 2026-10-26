const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../../db/database');

class AutomationService {
    // Business Rules
    static getRules(portalId, projectId = null) {
        let sql = 'SELECT * FROM automation_rules WHERE portal_id = ?';
        const params = [portalId];
        if (projectId) {
            sql += ' AND (project_id = ? OR project_id IS NULL)';
            params.push(projectId);
        }
        sql += ' ORDER BY created_at DESC';
        const rows = db.queryAll(sql, params);

        return rows.map(r => ({
            ...r,
            conditions: JSON.parse(r.conditions || '[]'),
            actions: JSON.parse(r.actions || '[]')
        }));
    }

    static createRule(portalId, { projectId = null, name, triggerType, conditions = [], actions = [] }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO automation_rules (id, portal_id, project_id, name, trigger_type, conditions, actions, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [id, portalId, projectId, name, triggerType, JSON.stringify(conditions), JSON.stringify(actions), now]
        );

        return db.queryOne('SELECT * FROM automation_rules WHERE id = ?', [id]);
    }

    // Webhooks
    static getWebhooks(portalId) {
        return db.queryAll('SELECT * FROM webhooks WHERE portal_id = ? ORDER BY created_at DESC', [portalId]);
    }

    static createWebhook(portalId, { targetUrl, events = ['task.created', 'task.updated', 'issue.created'], secret = null }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const generatedSecret = secret || crypto.randomBytes(20).toString('hex');

        db.execute(
            `INSERT INTO webhooks (id, portal_id, target_url, events, secret, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [id, portalId, targetUrl, JSON.stringify(events), generatedSecret, now]
        );

        return db.queryOne('SELECT * FROM webhooks WHERE id = ?', [id]);
    }

    static deleteWebhook(portalId, webhookId) {
        db.execute('DELETE FROM webhooks WHERE id = ? AND portal_id = ?', [webhookId, portalId]);
        return { success: true };
    }
}

module.exports = AutomationService;
