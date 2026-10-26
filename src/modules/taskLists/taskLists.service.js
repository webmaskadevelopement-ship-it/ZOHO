const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const WbsRollupEngine = require('../../engines/wbsRollupEngine');

class TaskListsService {
    static getTaskLists(portalId, projectId, isClient = false) {
        let sql = 'SELECT * FROM task_lists WHERE portal_id = ? AND project_id = ?';
        const params = [portalId, projectId];

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        sql += ' ORDER BY created_at ASC';
        const lists = db.queryAll(sql, params);

        return lists.map(tl => ({
            ...tl,
            sequence: JSON.parse(tl.sequence || '{"milestoneSequence":0,"projectSequence":0}'),
            stats: JSON.parse(tl.stats || '{"openTaskCount":0,"closedTaskCount":0,"completionPercentage":0}')
        }));
    }

    static getTaskListById(portalId, listId, isClient = false) {
        let sql = 'SELECT * FROM task_lists WHERE id = ? AND portal_id = ?';
        const params = [listId, portalId];

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        const tl = db.queryOne(sql, params);
        if (!tl) throw new Error('Task list not found.');

        return {
            ...tl,
            sequence: JSON.parse(tl.sequence || '{"milestoneSequence":0,"projectSequence":0}'),
            stats: JSON.parse(tl.stats || '{"openTaskCount":0,"closedTaskCount":0,"completionPercentage":0}')
        };
    }

    static createTaskList(portalId, {
        projectId,
        phaseId = null,
        name,
        flag = 'internal',
        sequence = { milestoneSequence: 0, projectSequence: 0 }
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO task_lists (
                id, portal_id, project_id, phase_id, name, flag,
                is_general_default, is_completed, is_rolled_over, sequence, stats,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, '{"openTaskCount":0,"closedTaskCount":0,"completionPercentage":0}', ?, ?)`,
            [id, portalId, projectId, phaseId, name, flag, JSON.stringify(sequence), now, now]
        );

        return this.getTaskListById(portalId, id);
    }

    static updateTaskList(portalId, listId, updates) {
        const tl = db.queryOne('SELECT * FROM task_lists WHERE id = ? AND portal_id = ?', [listId, portalId]);
        if (!tl) throw new Error('Task list not found.');

        const setClauses = [];
        const params = [];

        if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
        if (updates.phaseId !== undefined) { setClauses.push('phase_id = ?'); params.push(updates.phaseId); }
        if (updates.flag !== undefined) { setClauses.push('flag = ?'); params.push(updates.flag); }
        if (updates.isCompleted !== undefined) { setClauses.push('is_completed = ?'); params.push(updates.isCompleted ? 1 : 0); }
        if (updates.sequence !== undefined) { setClauses.push('sequence = ?'); params.push(JSON.stringify(updates.sequence)); }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(listId);
            params.push(portalId);

            db.execute(`UPDATE task_lists SET ${setClauses.join(', ')} WHERE id = ? AND portal_id = ?`, params);
            WbsRollupEngine.rollupProject(db, tl.project_id);
        }

        return this.getTaskListById(portalId, listId);
    }

    /**
     * Task List Rollover:
     * Moves all open, uncompleted tasks from a completed or closing task list/phase into a target list/phase!
     */
    static rolloverUncompletedTasks(portalId, sourceListId, targetListId, targetPhaseId = null) {
        const sourceList = this.getTaskListById(portalId, sourceListId);
        const targetList = this.getTaskListById(portalId, targetListId);

        return db.transaction(() => {
            const openTasks = db.queryAll(
                'SELECT id FROM tasks WHERE task_list_id = ? AND is_completed = 0 AND is_trashed = 0',
                [sourceListId]
            );

            for (const t of openTasks) {
                db.execute(
                    'UPDATE tasks SET task_list_id = ?, phase_id = ?, updated_at = ? WHERE id = ?',
                    [targetListId, targetPhaseId || targetList.phase_id, new Date().toISOString(), t.id]
                );
            }

            // Mark source as rolled over
            db.execute(
                'UPDATE task_lists SET is_rolled_over = 1, is_completed = 1, updated_at = ? WHERE id = ?',
                [new Date().toISOString(), sourceListId]
            );

            WbsRollupEngine.rollupProject(db, sourceList.project_id);

            return {
                success: true,
                rolledOverCount: openTasks.length,
                sourceListId,
                targetListId
            };
        });
    }

    static deleteTaskList(portalId, listId) {
        const tl = db.queryOne('SELECT project_id FROM task_lists WHERE id = ? AND portal_id = ?', [listId, portalId]);
        if (tl) {
            db.execute('DELETE FROM task_lists WHERE id = ? AND portal_id = ?', [listId, portalId]);
            WbsRollupEngine.rollupProject(db, tl.project_id);
        }
        return { success: true };
    }
}

module.exports = TaskListsService;
