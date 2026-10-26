const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const BlueprintEngine = require('../../engines/blueprintEngine');

class BlueprintsService {
    static getBlueprints(portalId, entityType = null) {
        let sql = 'SELECT * FROM blueprints WHERE portal_id = ?';
        const params = [portalId];
        if (entityType) {
            sql += ' AND entity_type = ?';
            params.push(entityType);
        }
        sql += ' ORDER BY created_at DESC';
        const rows = db.queryAll(sql, params);

        return rows.map(b => ({
            ...b,
            states: JSON.parse(b.states || '[]'),
            transitions: JSON.parse(b.transitions || '[]')
        }));
    }

    static getBlueprintById(portalId, blueprintId) {
        const b = db.queryOne('SELECT * FROM blueprints WHERE id = ? AND portal_id = ?', [blueprintId, portalId]);
        if (!b) throw new Error('Blueprint not found.');

        return {
            ...b,
            states: JSON.parse(b.states || '[]'),
            transitions: JSON.parse(b.transitions || '[]')
        };
    }

    static createBlueprint(portalId, { name, entityType = 'task', states = [], transitions = [] }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO blueprints (id, portal_id, name, entity_type, states, transitions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, entityType, JSON.stringify(states), JSON.stringify(transitions), now, now]
        );

        return this.getBlueprintById(portalId, id);
    }

    static updateBlueprint(portalId, blueprintId, { name, states, transitions }) {
        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (states !== undefined) { updates.push('states = ?'); params.push(JSON.stringify(states)); }
        if (transitions !== undefined) { updates.push('transitions = ?'); params.push(JSON.stringify(transitions)); }

        if (updates.length > 0) {
            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(blueprintId);
            params.push(portalId);
            db.execute(`UPDATE blueprints SET ${updates.join(', ')} WHERE id = ? AND portal_id = ?`, params);
        }

        return this.getBlueprintById(portalId, blueprintId);
    }

    /**
     * Executes a blueprint state machine transition on a Task or Issue
     */
    static executeTransition(portalId, {
        blueprintId,
        entityType = 'task',
        entityId,
        targetStateId,
        userRole,
        userId = null,
        inputPrompts = {}
    }) {
        const blueprint = this.getBlueprintById(portalId, blueprintId);

        // Fetch entity
        const table = entityType === 'task' ? 'tasks' : 'issues';
        const item = db.queryOne(`SELECT * FROM ${table} WHERE id = ? AND portal_id = ?`, [entityId, portalId]);
        if (!item) throw new Error(`${entityType} not found.`);

        const currentStateId = item.status_id || 'open';

        // Validate Transition
        const validation = BlueprintEngine.validateTransition({
            blueprint,
            currentStateId,
            targetStateId,
            userRole,
            itemData: item,
            inputPrompts
        });

        if (!validation.allowed) {
            throw new Error(validation.error);
        }

        // Apply Transition & Post-actions
        const postUpdates = BlueprintEngine.executePostActions(validation.transition, item, inputPrompts, db);

        return db.transaction(() => {
            const setClauses = ['status_id = ?'];
            const params = [targetStateId];

            for (const [key, val] of Object.entries(postUpdates)) {
                setClauses.push(`${key} = ?`);
                params.push(val);
            }

            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(entityId);

            db.execute(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`, params);

            // Log Comment / Audit
            let validUserId = userId;
            if (!validUserId) {
                const ownerIds = JSON.parse(item.owner_ids || '[]');
                validUserId = ownerIds[0] || item.reporter_id || item.assignee_id;
                if (!validUserId) {
                    const anyUser = db.queryOne('SELECT id FROM users LIMIT 1');
                    validUserId = anyUser ? anyUser.id : null;
                }
            }

            if (validUserId) {
                const commentId = uuidv4();
                const now = new Date().toISOString();
                db.execute(
                    `INSERT INTO comments (id, portal_id, entity_type, entity_id, user_id, content, flag, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'internal', ?)`,
                    [
                        commentId, portalId, entityType, entityId, validUserId,
                        `Transitioned status from "${currentStateId}" to "${targetStateId}" via Blueprint "${blueprint.name}".`,
                        now
                    ]
                );
            }

            return db.queryOne(`SELECT * FROM ${table} WHERE id = ?`, [entityId]);
        });
    }
}

module.exports = BlueprintsService;
