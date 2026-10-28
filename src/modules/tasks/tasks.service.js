const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const BusinessDayEngine = require('../../engines/businessDayEngine');
const CriticalPathEngine = require('../../engines/criticalPathEngine');
const WbsRollupEngine = require('../../engines/wbsRollupEngine');

class TasksService {
    static getTasks(portalId, projectId, isClient = false, filters = {}) {
        let sql = 'SELECT * FROM tasks WHERE portal_id = ? AND project_id = ?';
        const params = [portalId, projectId];

        if (filters.isTrashed !== undefined) {
            sql += ' AND is_trashed = ?';
            params.push(filters.isTrashed ? 1 : 0);
        } else {
            sql += ' AND is_trashed = 0';
        }

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        // BUG 3: My Task vs All Task filtering
        if (filters.myTasks || filters.assignedToMe) {
            sql += ' AND owner_ids LIKE ?';
            params.push(`%"${filters.userId || filters.assigneeId}"%`);
        } else if (filters.assigneeId) {
            sql += ' AND owner_ids LIKE ?';
            params.push(`%"${filters.assigneeId}"%`);
        }

        // BUG 5: Role-based filtering
        if (filters.userRole === 'client') {
            sql += " AND flag = 'external'";
        }

        if (filters.phaseId) {
            sql += ' AND phase_id = ?';
            params.push(filters.phaseId);
        }

        if (filters.taskListId) {
            sql += ' AND task_list_id = ?';
            params.push(filters.taskListId);
        }

        if (filters.statusId) {
            sql += ' AND status_id = ?';
            params.push(filters.statusId);
        }

        sql += ' ORDER BY sheet_sequence ASC, sequence_number ASC';
        const rows = db.queryAll(sql, params);

        return rows.map(t => this.formatTask(t));
    }

    static getTaskById(portalId, taskId, isClient = false) {
        let sql = 'SELECT * FROM tasks WHERE id = ? AND portal_id = ?';
        const params = [taskId, portalId];

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        const t = db.queryOne(sql, params);
        if (!t) throw new Error('Task not found or access denied.');

        return this.formatTask(t);
    }

    static formatTask(t) {
        return {
            ...t,
            ancestor_ids: JSON.parse(t.ancestor_ids || '[]'),
            duration: JSON.parse(t.duration || '{"value":1,"type":"days"}'),
            predecessors: JSON.parse(t.predecessors || '[]'),
            successor_ids: JSON.parse(t.successor_ids || '[]'),
            owner_ids: JSON.parse(t.owner_ids || '[]'),
            owners_and_work: JSON.parse(t.owners_and_work || '{"workType":"standard","allocations":{}}'),
            logged_hours: JSON.parse(t.logged_hours || '{"billableMinutes":0,"nonBillableMinutes":0,"totalMinutes":0}'),
            budget: JSON.parse(t.budget || '{"plannedHours":0,"plannedCost":0,"actualCost":0,"revenueBudget":0}'),
            checklist_items: JSON.parse(t.checklist_items || '[]'),
            recurrence: JSON.parse(t.recurrence || '{"isActive":false}'),
            tag_ids: JSON.parse(t.tag_ids || '[]'),
            follower_ids: JSON.parse(t.follower_ids || '[]'),
            custom_fields: JSON.parse(t.custom_fields || '{}'),
            associated_team: t.associated_team || '',
            associatedTeam: t.associated_team || '',
            work_hours: t.work_hours || '00:00',
            workHours: t.work_hours || '00:00',
            reminder: t.reminder || 'None',
            note: t.note || ''
        };
    }

    static createTask(portalId, {
        projectId,
        taskListId,
        phaseId = null,
        name,
        descriptionHtml = '',
        note = '',
        flag = 'internal',
        parentTaskId = null,
        statusId = 'open',
        priority = 'medium',
        completionPercentage = 0,
        startDate = null,
        endDate = null,
        duration = { value: 1, type: 'days' },
        predecessors = [],
        ownerIds = [],
        ownersAndWork = {},
        billingType = 'billable',
        budget = {},
        checklistItems = [],
        recurrence = { isActive: false },
        tagIds = [],
        followerIds = [],
        customFields = {},
        associatedTeam = '',
        workHours = '00:00',
        reminder = 'None'
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        return db.transaction((database) => {
            // 1. Fetch Project for Prefix and Atomic Sequence Increment
            const project = database.prepare('SELECT key_prefix, task_seq_counter FROM projects WHERE id = ?').get(projectId);
            if (!project) throw new Error('Project not found.');

            const nextSeq = (project.task_seq_counter || 0) + 1;
            const prefixKey = `${project.key_prefix}-${nextSeq}`;
            database.prepare('UPDATE projects SET task_seq_counter = ? WHERE id = ?').run(nextSeq, projectId);

            // 2. Resolve Multi-Level Subtask Hierarchy
            let depth = 0;
            let rootTaskId = null;
            let ancestorIds = [];

            if (parentTaskId) {
                const parent = database.prepare('SELECT id, depth, root_task_id, ancestor_ids FROM tasks WHERE id = ?').get(parentTaskId);
                if (parent) {
                    depth = (parent.depth || 0) + 1;
                    rootTaskId = parent.root_task_id || parent.id;
                    const pAncestors = JSON.parse(parent.ancestor_ids || '[]');
                    ancestorIds = [...pAncestors, parent.id];
                }
            }

            // 3. Resolve Task List and Phase if not provided
            let finalTaskListId = taskListId || null;
            let finalPhaseId = phaseId || null;

            if (!finalTaskListId) {
                const defaultList = database.prepare('SELECT id, phase_id FROM task_lists WHERE project_id = ? ORDER BY sequence ASC LIMIT 1').get(projectId);
                if (defaultList) {
                    finalTaskListId = defaultList.id;
                    if (!finalPhaseId) finalPhaseId = defaultList.phase_id;
                }
            } else if (!finalPhaseId) {
                const tl = database.prepare('SELECT phase_id FROM task_lists WHERE id = ?').get(taskListId);
                if (tl) finalPhaseId = tl.phase_id;
            }

            // 4. Date and Duration calculation
            let finalStart = startDate || new Date().toISOString().split('T')[0];
            let finalEnd = endDate;
            if (!finalEnd && finalStart) {
                const durVal = duration?.value || 1;
                finalEnd = BusinessDayEngine.addBusinessDays(finalStart, durVal - 1);
            }

            const isCompleted = completionPercentage === 100 || statusId === 'completed' ? 1 : 0;

            database.prepare(
                `INSERT INTO tasks (
                    id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
                    name, description_html, note, flag, depth, parent_task_id, root_task_id, ancestor_ids,
                    sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
                    start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
                    baseline_start_date, baseline_end_date, owner_ids, owners_and_work, billing_type,
                    budget, checklist_items, recurrence, tag_ids, follower_ids, custom_fields,
                    associated_team, work_hours, reminder, is_trashed, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, '[]', 0,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, 0, ?, ?
                )`
            ).run(
                id, portalId, projectId, finalPhaseId || null, finalTaskListId, prefixKey, nextSeq,
                name, descriptionHtml || null, note || null, flag || null, depth || 0, parentTaskId || null, rootTaskId || null, JSON.stringify(ancestorIds),
                nextSeq, statusId || 'open', isCompleted, isCompleted, priority || 'medium', completionPercentage || 0,
                finalStart || null, finalEnd || null, JSON.stringify(duration || { value: 1, type: 'days' }), JSON.stringify(predecessors || []),
                finalStart || null, finalEnd || null, JSON.stringify(ownerIds || []), JSON.stringify(ownersAndWork || []), billingType || 'billable',
                JSON.stringify(budget || {}), JSON.stringify(checklistItems || []), JSON.stringify(recurrence || { isActive: false }),
                JSON.stringify(tagIds || []), JSON.stringify(followerIds || []), JSON.stringify(customFields || {}),
                associatedTeam || null, workHours || '00:00', reminder || 'None', now, now
            );

            // 5. Update predecessors' successor_ids
            for (const pred of predecessors) {
                const pTask = database.prepare('SELECT successor_ids FROM tasks WHERE id = ?').get(pred.taskId);
                if (pTask) {
                    const succs = JSON.parse(pTask.successor_ids || '[]');
                    if (!succs.includes(id)) {
                        succs.push(id);
                        database.prepare('UPDATE tasks SET successor_ids = ? WHERE id = ?').run(JSON.stringify(succs), pred.taskId);
                    }
                }
            }

            WbsRollupEngine.rollupProject(db, projectId);

            return this.getTaskById(portalId, id);
        });
    }

    static updateTask(portalId, taskId, updates) {
        const task = db.queryOne('SELECT * FROM tasks WHERE id = ? AND portal_id = ?', [taskId, portalId]);
        if (!task) throw new Error('Task not found.');

        const setClauses = [];
        const params = [];

        if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
        if (updates.descriptionHtml !== undefined) { setClauses.push('description_html = ?'); params.push(updates.descriptionHtml); }
        if (updates.note !== undefined) { setClauses.push('note = ?'); params.push(updates.note); }
        if (updates.taskListId !== undefined) { setClauses.push('task_list_id = ?'); params.push(updates.taskListId); }
        if (updates.phaseId !== undefined) { setClauses.push('phase_id = ?'); params.push(updates.phaseId); }
        if (updates.flag !== undefined) { setClauses.push('flag = ?'); params.push(updates.flag); }
        if (updates.priority !== undefined) { setClauses.push('priority = ?'); params.push(updates.priority); }
        if (updates.statusId !== undefined) {
            setClauses.push('status_id = ?');
            params.push(updates.statusId);
            const isClosed = updates.statusId === 'completed' || updates.statusId === 'closed' ? 1 : 0;
            setClauses.push('is_completed = ?'); params.push(isClosed);
            setClauses.push('is_closed_type = ?'); params.push(isClosed);
        }
        if (updates.completionPercentage !== undefined) {
            setClauses.push('completion_percentage = ?');
            params.push(updates.completionPercentage);
            if (updates.completionPercentage === 100) {
                setClauses.push('is_completed = 1');
                setClauses.push("status_id = 'completed'");
            }
        }
        if (updates.startDate !== undefined) { setClauses.push('start_date = ?'); params.push(updates.startDate); }
        if (updates.endDate !== undefined) { setClauses.push('end_date = ?'); params.push(updates.endDate); }
        if (updates.duration !== undefined) { setClauses.push('duration = ?'); params.push(JSON.stringify(updates.duration)); }
        if (updates.ownerIds !== undefined) { setClauses.push('owner_ids = ?'); params.push(JSON.stringify(updates.ownerIds)); }
        if (updates.ownersAndWork !== undefined) { setClauses.push('owners_and_work = ?'); params.push(JSON.stringify(updates.ownersAndWork)); }
        if (updates.predecessors !== undefined) {
            // Check for circular dependency
            const allProjTasks = db.queryAll('SELECT id, predecessors FROM tasks WHERE project_id = ? AND is_trashed = 0', [task.project_id]);
            for (const p of updates.predecessors) {
                if (CriticalPathEngine.hasCycle(allProjTasks, p.taskId, taskId)) {
                    throw new Error(`Circular dependency detected: adding predecessor ${p.taskId} creates a dependency cycle.`);
                }
            }
            setClauses.push('predecessors = ?');
            params.push(JSON.stringify(updates.predecessors));
        }
        if (updates.checklistItems !== undefined) { setClauses.push('checklist_items = ?'); params.push(JSON.stringify(updates.checklistItems)); }
        if (updates.customFields !== undefined) { setClauses.push('custom_fields = ?'); params.push(JSON.stringify(updates.customFields)); }
        if (updates.associatedTeam !== undefined) { setClauses.push('associated_team = ?'); params.push(updates.associatedTeam); }
        else if (updates.associated_team !== undefined) { setClauses.push('associated_team = ?'); params.push(updates.associated_team); }
        if (updates.workHours !== undefined) { setClauses.push('work_hours = ?'); params.push(updates.workHours); }
        else if (updates.work_hours !== undefined) { setClauses.push('work_hours = ?'); params.push(updates.work_hours); }
        if (updates.reminder !== undefined) { setClauses.push('reminder = ?'); params.push(updates.reminder); }
        if (updates.recurrence !== undefined) {
            setClauses.push('recurrence = ?');
            params.push(typeof updates.recurrence === 'string' ? updates.recurrence : JSON.stringify(updates.recurrence));
        }
        if (updates.tags !== undefined || updates.tagIds !== undefined) {
            const tagsVal = updates.tagIds !== undefined ? updates.tagIds : updates.tags;
            setClauses.push('tag_ids = ?');
            params.push(typeof tagsVal === 'string' ? tagsVal : JSON.stringify(tagsVal));
        }

        // Date cascading auto-reschedule
        let cascadedUpdates = [];
        if ((updates.startDate && updates.startDate !== task.start_date) || (updates.endDate && updates.endDate !== task.end_date)) {
            const newStart = updates.startDate || task.start_date;
            const newEnd = updates.endDate || task.end_date;
            const allTasks = db.queryAll('SELECT * FROM tasks WHERE project_id = ? AND is_trashed = 0', [task.project_id]);
            cascadedUpdates = CriticalPathEngine.cascadeReschedule(allTasks, taskId, newStart, newEnd);
        }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(taskId);
            params.push(portalId);

            db.execute(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ? AND portal_id = ?`, params);
        }

        // Apply any cascaded successor shifts
        if (cascadedUpdates.length > 1) {
            for (const c of cascadedUpdates) {
                if (c.id !== taskId) {
                    db.execute(
                        'UPDATE tasks SET start_date = ?, end_date = ?, updated_at = ? WHERE id = ?',
                        [c.start_date, c.end_date, new Date().toISOString(), c.id]
                    );
                }
            }
        }

        WbsRollupEngine.rollupProject(db, task.project_id);

        return this.getTaskById(portalId, taskId);
    }

    /**
     * Soft delete (Recycle Bin - 30 days retention)
     */
    static softDeleteTask(portalId, taskId) {
        const task = db.queryOne('SELECT project_id FROM tasks WHERE id = ? AND portal_id = ?', [taskId, portalId]);
        if (!task) throw new Error('Task not found.');

        db.execute(
            'UPDATE tasks SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND portal_id = ?',
            [new Date().toISOString(), new Date().toISOString(), taskId, portalId]
        );

        WbsRollupEngine.rollupProject(db, task.project_id);
        return { success: true, message: 'Task moved to trash.' };
    }

    /**
     * Restore from Recycle Bin
     */
    static restoreTask(portalId, taskId) {
        const task = db.queryOne('SELECT project_id FROM tasks WHERE id = ? AND portal_id = ?', [taskId, portalId]);
        if (!task) throw new Error('Task not found.');

        db.execute(
            'UPDATE tasks SET is_trashed = 0, trashed_at = NULL, updated_at = ? WHERE id = ? AND portal_id = ?',
            [new Date().toISOString(), taskId, portalId]
        );

        WbsRollupEngine.rollupProject(db, task.project_id);
        return { success: true, message: 'Task restored from trash.' };
    }

    /**
     * Bulk Task Operations (Status, Priority, Move TaskList, Delete)
     */
    static bulkUpdate(portalId, { taskIds = [], updates = {} }) {
        if (!taskIds.length) return { updatedCount: 0 };

        return db.transaction(() => {
            let updatedCount = 0;
            for (const id of taskIds) {
                try {
                    this.updateTask(portalId, id, updates);
                    updatedCount++;
                } catch {
                    // continue with others
                }
            }
            return { success: true, updatedCount };
        });
    }

    /**
     * PDF Feature 48: Task Voting & Reactions for backlog prioritization
     */
    static voteTask(portalId, taskId, userId) {
        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            db.execute(
                'INSERT INTO task_votes (id, portal_id, task_id, user_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [id, portalId, taskId, userId, now]
            );
        } catch (e) {
            // Already voted
        }
        return this.getTaskVotes(portalId, taskId);
    }

    static unvoteTask(portalId, taskId, userId) {
        db.execute('DELETE FROM task_votes WHERE portal_id = ? AND task_id = ? AND user_id = ?', [portalId, taskId, userId]);
        return this.getTaskVotes(portalId, taskId);
    }

    static getTaskVotes(portalId, taskId) {
        const rows = db.queryAll('SELECT user_id FROM task_votes WHERE portal_id = ? AND task_id = ?', [portalId, taskId]);
        return {
            taskId,
            voteCount: rows.length,
            voterUserIds: rows.map(r => r.user_id)
        };
    }

    /**
     * PDF Feature 49: Task Linking & Relations
     * relates_to, duplicates, blocks, is_blocked_by cross-project references
     */
    static addTaskRelation(portalId, { sourceTaskId, targetTaskId, relationType }) {
        const allowed = ['relates_to', 'duplicates', 'blocks', 'is_blocked_by'];
        if (!allowed.includes(relationType)) throw new Error(`Invalid relation type: ${relationType}`);
        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            db.execute(
                `INSERT INTO task_relations (id, portal_id, source_task_id, target_task_id, relation_type, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, portalId, sourceTaskId, targetTaskId, relationType, now]
            );
        } catch (e) {
            // Already exists
        }
        return this.getTaskRelations(portalId, sourceTaskId);
    }

    static getTaskRelations(portalId, taskId) {
        return db.queryAll(
            `SELECT tr.*, t.name as target_task_name, t.prefix_key as target_prefix_key, t.status_id as target_status_id
             FROM task_relations tr
             JOIN tasks t ON tr.target_task_id = t.id
             WHERE tr.portal_id = ? AND tr.source_task_id = ?`,
            [portalId, taskId]
        );
    }

    /**
     * PDF Feature 44: Smart Task Reminders
     */
    static createTaskReminder(portalId, { taskId, recipientId, triggerType = 'before_due', remindAt, offsetMinutes = 120 }) {
        const ReminderScheduler = require('../../services/workers/reminderScheduler');
        return ReminderScheduler.createReminder(portalId, { taskId, recipientId, triggerType, remindAt, offsetMinutes });
    }
}

module.exports = TasksService;
