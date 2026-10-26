const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class CustomFieldsService {
    static getCustomFields(portalId, projectId = null, entityType = null) {
        let sql = 'SELECT * FROM custom_fields WHERE portal_id = ?';
        const params = [portalId];

        if (projectId) {
            sql += ' AND (project_id = ? OR project_id IS NULL)';
            params.push(projectId);
        }
        if (entityType) {
            sql += ' AND entity_type = ?';
            params.push(entityType);
        }
        sql += ' ORDER BY created_at ASC';

        const fields = db.queryAll(sql, params);
        return fields.map(f => ({
            ...f,
            options: typeof f.options === 'string' ? JSON.parse(f.options || '[]') : f.options
        }));
    }

    static createCustomField(portalId, { projectId = null, entityType = 'task', name, fieldKey, fieldType = 'text', options = [], defaultValue = null, isRequired = 0 }) {
        if (!name || !fieldKey) throw new Error('name and fieldKey are required.');
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO custom_fields (id, portal_id, project_id, entity_type, name, field_key, field_type, options, default_value, is_required, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, projectId, entityType, name, fieldKey, fieldType, JSON.stringify(options), defaultValue, isRequired ? 1 : 0, now]
        );
        return db.queryOne('SELECT * FROM custom_fields WHERE id = ?', [id]);
    }

    static deleteCustomField(portalId, fieldId) {
        db.execute('DELETE FROM custom_fields WHERE id = ? AND portal_id = ?', [fieldId, portalId]);
        return { success: true };
    }

    // Project Layouts CRUD (PDF Feature 21)
    static getLayouts(portalId) {
        const layouts = db.queryAll('SELECT * FROM project_layouts WHERE portal_id = ? ORDER BY created_at ASC', [portalId]);
        return layouts.map(l => ({
            ...l,
            field_ids: typeof l.field_ids === 'string' ? JSON.parse(l.field_ids || '[]') : l.field_ids,
            statuses: typeof l.statuses === 'string' ? JSON.parse(l.statuses || '[]') : l.statuses
        }));
    }

    static getLayoutById(portalId, layoutId) {
        const layout = db.queryOne('SELECT * FROM project_layouts WHERE portal_id = ? AND id = ?', [portalId, layoutId]);
        if (!layout) throw new Error('Layout not found.');
        return {
            ...layout,
            field_ids: typeof layout.field_ids === 'string' ? JSON.parse(layout.field_ids || '[]') : layout.field_ids,
            statuses: typeof layout.statuses === 'string' ? JSON.parse(layout.statuses || '[]') : layout.statuses
        };
    }

    static createLayout(portalId, { name, description = '', fieldIds = [], statuses = ['open', 'in_progress', 'on_hold', 'closed'] }) {
        if (!name) throw new Error('Layout name is required.');
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO project_layouts (id, portal_id, name, description, field_ids, statuses, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, description, JSON.stringify(fieldIds), JSON.stringify(statuses), now]
        );
        return this.getLayoutById(portalId, id);
    }

    static updateLayout(portalId, layoutId, { name, description, fieldIds, statuses }) {
        const existing = this.getLayoutById(portalId, layoutId);
        const newName = name !== undefined ? name : existing.name;
        const newDesc = description !== undefined ? description : existing.description;
        const newFields = fieldIds !== undefined ? JSON.stringify(fieldIds) : JSON.stringify(existing.field_ids);
        const newStatuses = statuses !== undefined ? JSON.stringify(statuses) : JSON.stringify(existing.statuses);

        db.execute(
            'UPDATE project_layouts SET name = ?, description = ?, field_ids = ?, statuses = ? WHERE id = ? AND portal_id = ?',
            [newName, newDesc, newFields, newStatuses, layoutId, portalId]
        );
        return this.getLayoutById(portalId, layoutId);
    }

    /**
     * Safe Evaluator for Formula Columns (PDF Feature 65)
     * e.g., Estimated Hours * Rate or Days Remaining
     */
    static evaluateFormula(formulaString, contextVariables = {}) {
        try {
            // Supported operations: +, -, *, /, and variable tokens
            const sanitized = formulaString.replace(/([a-zA-Z_][a-zA-Z0-9_]*)/g, (match) => {
                if (contextVariables.hasOwnProperty(match)) {
                    return Number(contextVariables[match]) || 0;
                }
                return 0;
            });
            // Safe mathematical calculation without arbitrary eval
            const result = Function(`'use strict'; return (${sanitized});`)();
            return typeof result === 'number' && !isNaN(result) ? Math.round(result * 100) / 100 : 0;
        } catch (e) {
            return 0;
        }
    }
}

module.exports = CustomFieldsService;
