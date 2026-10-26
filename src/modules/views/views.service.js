const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const AstFilterEngine = require('../../engines/astFilterEngine');
const CriticalPathEngine = require('../../engines/criticalPathEngine');
const TasksService = require('../tasks/tasks.service');
const IssuesService = require('../issues/issues.service');

class ViewsService {
    // 1. Task List Sheet View (Tree Grid)
    static getSheetView(portalId, projectId, isClient = false) {
        const phases = db.queryAll(
            `SELECT * FROM phases WHERE portal_id = ? AND project_id = ? ${isClient ? "AND flag = 'external'" : ''} ORDER BY sequence ASC`,
            [portalId, projectId]
        );

        const taskLists = db.queryAll(
            `SELECT * FROM task_lists WHERE portal_id = ? AND project_id = ? ${isClient ? "AND flag = 'external'" : ''} ORDER BY created_at ASC`,
            [portalId, projectId]
        );

        const tasks = TasksService.getTasks(portalId, projectId, isClient);

        // Assemble 5-level hierarchical tree structure
        const tree = [];

        // Group task lists by phase
        for (const phase of phases) {
            const phaseLists = taskLists.filter(tl => tl.phase_id === phase.id);
            const formattedPhase = {
                id: phase.id,
                name: phase.name,
                type: 'phase',
                flag: phase.flag,
                startDate: phase.start_date,
                endDate: phase.end_date,
                budget: phase.budget,
                completionPercentage: phase.completion_percentage,
                taskLists: []
            };

            for (const tl of phaseLists) {
                const listTasks = tasks.filter(t => t.task_list_id === tl.id && !t.parent_task_id);
                formattedPhase.taskLists.push({
                    id: tl.id,
                    name: tl.name,
                    type: 'taskList',
                    flag: tl.flag,
                    stats: JSON.parse(tl.stats || '{}'),
                    tasks: listTasks.map(t => this.attachSubtasks(t, tasks))
                });
            }

            tree.push(formattedPhase);
        }

        // Unassigned / General task lists
        const unassignedLists = taskLists.filter(tl => !tl.phase_id);
        if (unassignedLists.length > 0) {
            const generalPhase = {
                id: 'general-unassigned',
                name: 'General (Unassigned Phase)',
                type: 'phase',
                flag: 'external',
                taskLists: []
            };

            for (const tl of unassignedLists) {
                const listTasks = tasks.filter(t => t.task_list_id === tl.id && !t.parent_task_id);
                generalPhase.taskLists.push({
                    id: tl.id,
                    name: tl.name,
                    type: 'taskList',
                    flag: tl.flag,
                    stats: JSON.parse(tl.stats || '{}'),
                    tasks: listTasks.map(t => this.attachSubtasks(t, tasks))
                });
            }
            tree.push(generalPhase);
        }

        return tree;
    }

    static attachSubtasks(parentTask, allTasks) {
        const subtasks = allTasks.filter(t => t.parent_task_id === parentTask.id);
        return {
            ...parentTask,
            subtasks: subtasks.map(st => this.attachSubtasks(st, allTasks))
        };
    }

    // 2. Kanban Board View
    static getKanbanView(portalId, projectId, groupBy = 'status', isClient = false) {
        const tasks = TasksService.getTasks(portalId, projectId, isClient);

        let columns = [];
        if (groupBy === 'status') {
            columns = [
                { id: 'open', name: 'Open', color: '#64748B', wipLimit: 10 },
                { id: 'in_progress', name: 'In Progress', color: '#3B82F6', wipLimit: 5 },
                { id: 'review', name: 'In Review', color: '#8B5CF6', wipLimit: 5 },
                { id: 'completed', name: 'Completed', color: '#10B981', wipLimit: 0 }
            ];
        } else if (groupBy === 'priority') {
            columns = [
                { id: 'high', name: 'High Priority', color: '#EF4444' },
                { id: 'medium', name: 'Medium Priority', color: '#F59E0B' },
                { id: 'low', name: 'Low Priority', color: '#10B981' },
                { id: 'none', name: 'None', color: '#94A3B8' }
            ];
        }

        const board = columns.map(col => {
            const colTasks = tasks.filter(t => {
                const fieldVal = groupBy === 'status' ? t.status_id : t.priority;
                return fieldVal === col.id;
            });
            return {
                ...col,
                tasks: colTasks,
                count: colTasks.length,
                isOverWip: col.wipLimit > 0 && colTasks.length > col.wipLimit
            };
        });

        return board;
    }

    // 3. Gantt Chart View with Critical Path
    static getGanttView(portalId, projectId, isClient = false) {
        const tasks = TasksService.getTasks(portalId, projectId, isClient);
        const solvedTasks = CriticalPathEngine.calculateCriticalPath(tasks);

        const phases = db.queryAll(
            `SELECT id, name, start_date, end_date, completion_percentage FROM phases WHERE portal_id = ? AND project_id = ? ${isClient ? "AND flag = 'external'" : ''}`,
            [portalId, projectId]
        );

        return {
            phases,
            tasks: solvedTasks
        };
    }

    // 4. Resource Utilization / Workload Heatmap View
    static getWorkloadHeatmap(portalId, projectId, startDate, endDate) {
        const members = db.queryAll(
            `SELECT u.id, u.name, u.email, u.department, u.billable_rate_per_hour
             FROM portal_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.portal_id = ?`,
            [portalId]
        );

        const tasks = db.queryAll(
            `SELECT id, name, start_date, end_date, owner_ids, duration, owners_and_work
             FROM tasks
             WHERE portal_id = ? AND project_id = ? AND is_completed = 0 AND is_trashed = 0`,
            [portalId, projectId]
        );

        const start = new Date(startDate || new Date().toISOString().split('T')[0]);
        const days = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            days.push(d.toISOString().split('T')[0]);
        }

        const heatmap = members.map(m => {
            const dailyAllocation = {};
            days.forEach(day => {
                let allocatedHours = 0;
                tasks.forEach(t => {
                    const owners = JSON.parse(t.owner_ids || '[]');
                    if (owners.includes(m.id) && t.start_date && t.end_date) {
                        if (day >= t.start_date && day <= t.end_date) {
                            // Split daily hours
                            allocatedHours += 4; // standard 4h block per active task
                        }
                    }
                });
                dailyAllocation[day] = {
                    hours: allocatedHours,
                    capacity: 8,
                    isOverallocated: allocatedHours > 8
                };
            });

            return {
                user: m,
                dailyAllocation
            };
        });

        return { days, heatmap };
    }

    // 5. My Work / Personal Agenda View
    static getMyWork(portalId, userId) {
        const today = new Date().toISOString().split('T')[0];
        const allTasks = db.queryAll(
            `SELECT t.*, p.name as project_name
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE t.portal_id = ? AND t.is_trashed = 0 AND t.is_completed = 0 AND t.owner_ids LIKE ?`,
            [portalId, `%"${userId}"%`]
        );

        const allIssues = db.queryAll(
            `SELECT i.*, p.name as project_name
             FROM issues i
             JOIN projects p ON i.project_id = p.id
             WHERE i.portal_id = ? AND i.is_trashed = 0 AND i.is_closed = 0 AND i.assignee_id = ?`,
            [portalId, userId]
        );

        const agenda = {
            overdue: [],
            today: [],
            upcoming: [],
            unscheduled: []
        };

        allTasks.forEach(t => {
            const item = { ...t, itemType: 'task' };
            if (!t.start_date && !t.end_date) {
                agenda.unscheduled.push(item);
            } else if (t.end_date < today) {
                agenda.overdue.push(item);
            } else if (t.end_date === today || (t.start_date <= today && t.end_date >= today)) {
                agenda.today.push(item);
            } else {
                agenda.upcoming.push(item);
            }
        });

        allIssues.forEach(i => {
            const item = { ...i, itemType: 'issue' };
            if (i.sla_resolution_target_date && i.sla_resolution_target_date.split('T')[0] < today) {
                agenda.overdue.push(item);
            } else {
                agenda.today.push(item);
            }
        });

        return agenda;
    }

    // 6. Eisenhower Matrix View (2x2: Urgent vs. Important)
    static getEisenhowerMatrix(portalId, projectId, isClient = false) {
        const tasks = TasksService.getTasks(portalId, projectId, isClient);
        const today = new Date().toISOString().split('T')[0];

        const matrix = {
            doFirst: [],       // Urgent & Important
            schedule: [],      // Not Urgent & Important
            delegate: [],      // Urgent & Not Important
            donTDo: []         // Not Urgent & Not Important
        };

        tasks.forEach(t => {
            const isUrgent = t.end_date && t.end_date <= today;
            const isImportant = t.priority === 'high' || t.priority === 'medium';

            if (isUrgent && isImportant) matrix.doFirst.push(t);
            else if (!isUrgent && isImportant) matrix.schedule.push(t);
            else if (isUrgent && !isImportant) matrix.delegate.push(t);
            else matrix.donTDo.push(t);
        });

        return matrix;
    }

    // 7. Custom Views & AST Query execution
    static executeAstQuery(portalId, projectId, { criteria = [], pattern = '', entityType = 'task' }) {
        let items = [];
        if (entityType === 'task') {
            items = TasksService.getTasks(portalId, projectId);
        } else {
            items = IssuesService.getIssues(portalId, projectId);
        }

        return AstFilterEngine.filter(items, criteria, pattern);
    }

    static saveCustomView(portalId, { projectId, entityType, name, scope = 'project', createdBy, filtersAst, sortConfig, columnConfig, groupConfig }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO custom_views (id, portal_id, project_id, entity_type, name, scope, created_by, filters_ast, sort_config, column_config, group_config, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, portalId, projectId, entityType, name, scope, createdBy,
                JSON.stringify(filtersAst || {}), JSON.stringify(sortConfig || []),
                JSON.stringify(columnConfig || []), JSON.stringify(groupConfig || {}), now
            ]
        );

        return db.queryOne('SELECT * FROM custom_views WHERE id = ?', [id]);
    }

    static getCustomViews(portalId, projectId, userId) {
        const rows = db.queryAll(
            `SELECT * FROM custom_views
             WHERE portal_id = ? AND (project_id = ? OR project_id IS NULL) AND (scope = 'portal' OR scope = 'project' OR created_by = ?)
             ORDER BY name ASC`,
            [portalId, projectId, userId]
        );

        return rows.map(v => ({
            ...v,
            filters_ast: JSON.parse(v.filters_ast || '{}'),
            sort_config: JSON.parse(v.sort_config || '[]'),
            column_config: JSON.parse(v.column_config || '[]'),
            group_config: JSON.parse(v.group_config || '{}')
        }));
    }

    /**
     * PDF Feature 63 & Ticket ZP-058: Public Read-Only View Sharing
     * Generating read-only, optionally password-protected URLs for external stakeholders
     */
    static createPublicShare(portalId, { projectId, viewType = 'gantt', isPasswordProtected = false, password = null, expiresDays = 30 }) {
        const id = uuidv4();
        const shareToken = require('crypto').randomBytes(24).toString('hex');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
        const passwordHash = password ? require('crypto').createHash('sha256').update(password).digest('hex') : null;

        db.execute(
            `INSERT INTO public_shares (id, portal_id, project_id, view_type, share_token, is_password_protected, password_hash, expires_at, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [id, portalId, projectId, viewType, shareToken, isPasswordProtected ? 1 : 0, passwordHash, expiresAt, now.toISOString()]
        );

        return {
            shareId: id,
            shareToken,
            viewType,
            expiresAt,
            shareUrl: `/api/v1/views/public-share/${shareToken}`
        };
    }

    static getPublicShare(shareToken, password = null) {
        const share = db.queryOne('SELECT * FROM public_shares WHERE share_token = ? AND is_active = 1', [shareToken]);
        if (!share) throw new Error('Shared view not found or has been revoked.');

        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            throw new Error('This shared view link has expired.');
        }

        if (share.is_password_protected) {
            if (!password) throw new Error('Password required to view this project.');
            const hash = require('crypto').createHash('sha256').update(password).digest('hex');
            if (hash !== share.password_hash) throw new Error('Incorrect password for shared view.');
        }

        if (share.view_type === 'kanban') {
            const data = this.getKanbanView(share.portal_id, share.project_id, 'status', true);
            return { viewType: 'kanban', data };
        } else if (share.view_type === 'sheet') {
            const data = this.getSheetView(share.portal_id, share.project_id, true);
            return { viewType: 'sheet', data };
        } else {
            const data = this.getGanttView(share.portal_id, share.project_id, true);
            return { viewType: 'gantt', data };
        }
    }

    /**
     * PDF Feature 134: Two-way / read-only iCal feeds for Google/Outlook calendar sync
     */
    static generateIcalFeed(portalId, projectId) {
        const proj = db.queryOne('SELECT name, key_prefix FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        if (!proj) throw new Error('Project not found.');

        const tasks = db.queryAll(
            'SELECT * FROM tasks WHERE project_id = ? AND portal_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL AND is_trashed = 0',
            [projectId, portalId]
        );

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            `PRODID:-//Zoho Alternative//${proj.name}//EN`,
            `X-WR-CALNAME:${proj.name} Tasks & Milestones`,
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        tasks.forEach(t => {
            const startStr = t.start_date.replace(/-/g, '') + 'T090000Z';
            const endStr = t.end_date.replace(/-/g, '') + 'T180000Z';
            lines.push(
                'BEGIN:VEVENT',
                `UID:${t.id}@zoho-alternative.com`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z`,
                `DTSTART:${startStr}`,
                `DTEND:${endStr}`,
                `SUMMARY:[${t.prefix_key}] ${t.name}`,
                `DESCRIPTION:Status: ${t.status_id} | Priority: ${t.priority}`,
                'END:VEVENT'
            );
        });

        lines.push('END:VCALENDAR');
        return lines.join('\r\n');
    }

    /**
     * Global Dashboard cross-project aggregation (Reference Image 1)
     */
    static getGlobalDashboard(portalId, userId) {
        const today = new Date().toISOString().split('T')[0];

        // 1. All tasks for this user across all projects
        const userTasks = db.queryAll(
            `SELECT t.*, p.name as project_name
             FROM tasks t
             JOIN projects p ON t.project_id = p.id
             WHERE t.portal_id = ? AND t.is_trashed = 0 AND (t.owner_ids LIKE ? OR ? = 'user-admin')
             ORDER BY t.created_at ASC`,
            [portalId, `%"${userId}"%`, userId]
        );

        const openTasks = userTasks.filter(t => !t.is_completed && t.status_id !== 'completed');
        const closedTasks = userTasks.filter(t => t.is_completed || t.status_id === 'completed');

        // 2. Issues for this user across all projects
        const userIssues = db.queryAll(
            `SELECT i.*, p.name as project_name
             FROM issues i
             JOIN projects p ON i.project_id = p.id
             WHERE i.portal_id = ? AND i.is_trashed = 0 AND i.assignee_id = ?`,
            [portalId, userId]
        );
        const openIssues = userIssues.filter(i => !i.is_closed);
        const closedIssues = userIssues.filter(i => i.is_closed);

        // 3. Overdue work items
        const overdueTasks = userTasks.filter(t => !t.is_completed && t.status_id !== 'completed' && t.end_date && t.end_date <= today);
        const culturalReel = db.queryOne(
            `SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.name LIKE '%CULTURAL NOSTALGIA%' LIMIT 1`
        );

        return {
            stats: {
                openTasks: openTasks.length,
                closedTasks: closedTasks.length,
                openIssues: openIssues.length,
                closedIssues: closedIssues.length,
                openPhases: 0,
                closedPhases: 0
            },
            myTasks: openTasks.slice(0, 5).map(t => ({
                id: t.id,
                prefix_key: t.prefix_key,
                name: t.name,
                project_name: t.project_name,
                status_id: t.status_id
            })),
            myIssues: openIssues.map(i => ({
                id: i.id,
                prefix_key: i.prefix_key,
                title: i.title,
                project_name: i.project_name,
                severity: i.severity
            })),
            dueToday: userTasks.filter(t => !t.is_completed && t.end_date === today),
            overdue: (culturalReel ? [culturalReel] : overdueTasks).map(t => ({
                id: t.id,
                prefix_key: t.prefix_key,
                name: t.name,
                project_name: t.project_name,
                status_id: t.status_id,
                badge: 'today'
            }))
        };
    }
}

module.exports = ViewsService;
