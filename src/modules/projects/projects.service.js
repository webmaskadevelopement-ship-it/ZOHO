const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const WbsRollupEngine = require('../../engines/wbsRollupEngine');

class ProjectsService {
    // Project Groups (Portfolios)
    static getProjectGroups(portalId) {
        return db.queryAll('SELECT * FROM project_groups WHERE portal_id = ? ORDER BY name ASC', [portalId]);
    }

    static createProjectGroup(portalId, { name, description = '', color = '#3B82F6' }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO project_groups (id, portal_id, name, description, color, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, description, color, now]
        );
        return db.queryOne('SELECT * FROM project_groups WHERE id = ?', [id]);
    }

    // Projects
    static getProjects(portalId, userId, userRole = 'employee', options = {}) {
        let sql = 'SELECT * FROM projects WHERE portal_id = ?';
        const params = [portalId];

        // Safe trash filter
        sql += ' AND (is_trashed = 0 OR is_trashed IS NULL) AND project_type != \'trashed\'';

        if (options.projectType) {
            sql += ' AND project_type = ?';
            params.push(options.projectType);
        }

        if (options.projectGroupId) {
            sql += ' AND project_group_id = ?';
            params.push(options.projectGroupId);
        }

        // Strict RBAC Project Scoping (BUG 5)
        if (userRole === 'admin') {
            // Admins have global visibility across all portal projects
        } else if (userRole === 'client') {
            // Clients see only projects explicitly scoped to them
            sql += ' AND member_ids LIKE ?';
            params.push(`%"${userId}"%`);
        } else {
            // Managers, Leads, and Employees see public projects OR assigned projects (owner or member)
            sql += ' AND (is_public = 1 OR owner_id = ? OR member_ids LIKE ?)';
            params.push(userId, `%"${userId}"%`);
        }

        sql += ' ORDER BY created_at DESC';
        const projects = db.queryAll(sql, params);

        return projects.map(p => ({
            ...p,
            member_ids: JSON.parse(p.member_ids || '[]'),
            client_company_ids: JSON.parse(p.client_company_ids || '[]'),
            budget_config: JSON.parse(p.budget_config || '{}'),
            stats: JSON.parse(p.stats || '{}'),
            enabled_modules: JSON.parse(p.enabled_modules || '[]'),
            custom_fields: JSON.parse(p.custom_fields || '{}')
        }));
    }

    static getProjectById(portalId, projectId) {
        const p = db.queryOne('SELECT * FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        if (!p) throw new Error('Project not found.');

        return {
            ...p,
            member_ids: JSON.parse(p.member_ids || '[]'),
            client_company_ids: JSON.parse(p.client_company_ids || '[]'),
            budget_config: JSON.parse(p.budget_config || '{}'),
            stats: JSON.parse(p.stats || '{}'),
            enabled_modules: JSON.parse(p.enabled_modules || '[]'),
            custom_fields: JSON.parse(p.custom_fields || '{}')
        };
    }

    static createProject({
        portalId,
        ownerId,
        name,
        description = '',
        keyPrefix = null,
        projectGroupId = null,
        startDate = null,
        endDate = null,
        isPublic = 1,
        isStrictSchedule = 0,
        isRollupProject = 0,
        budgetConfig = {},
        projectType = 'active',
        memberIds = [],
        clientCompanyIds = []
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        // Generate Prefix Key e.g. "ZPA", "PROJ"
        const prefix = (keyPrefix || name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PR')).padEnd(3, 'J');

        const initialBudget = {
            currency: 'USD',
            budgetType: 'project_hours',
            billingMethod: 'project_hours',
            plannedCost: 0,
            actualCost: 0,
            plannedHours: 0,
            actualHours: 0,
            revenueBudget: 0,
            earnedValue: 0,
            ...budgetConfig
        };

        const initialStats = {
            openTaskCount: 0,
            closedTaskCount: 0,
            openIssueCount: 0,
            closedIssueCount: 0,
            completionPercentage: 0,
            healthScore: 'on_track'
        };

        const finalMemberIds = Array.from(new Set([ownerId, ...memberIds]));

        return db.transaction(() => {
            db.execute(
                `INSERT INTO projects (
                    id, portal_id, project_group_id, name, description, key_prefix,
                    task_seq_counter, issue_seq_counter, owner_id, member_ids, client_company_ids,
                    project_type, is_public, is_strict_schedule, is_rollup_project,
                    start_date, end_date, budget_config, stats, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, portalId, projectGroupId, name, description, prefix,
                    ownerId, JSON.stringify(finalMemberIds), JSON.stringify(clientCompanyIds),
                    projectType, isPublic ? 1 : 0, isStrictSchedule ? 1 : 0, isRollupProject ? 1 : 0,
                    startDate, endDate, JSON.stringify(initialBudget), JSON.stringify(initialStats),
                    now, now
                ]
            );

            // Auto-create default internal and external Task Lists
            const internalListId = uuidv4();
            db.execute(
                `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Internal)', 'internal', 1, ?, ?)`,
                [internalListId, portalId, id, now, now]
            );

            const externalListId = uuidv4();
            db.execute(
                `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Client Visible)', 'external', 1, ?, ?)`,
                [externalListId, portalId, id, now, now]
            );

            return this.getProjectById(portalId, id);
        });
    }

    static updateProject(portalId, projectId, updates) {
        const p = db.queryOne('SELECT id FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        if (!p) throw new Error('Project not found.');

        const setClauses = [];
        const params = [];

        if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
        if (updates.description !== undefined) { setClauses.push('description = ?'); params.push(updates.description); }
        if (updates.projectGroupId !== undefined) { setClauses.push('project_group_id = ?'); params.push(updates.projectGroupId); }
        if (updates.statusId !== undefined) { setClauses.push('status_id = ?'); params.push(updates.statusId); }
        if (updates.projectType !== undefined) { setClauses.push('project_type = ?'); params.push(updates.projectType); }
        if (updates.isPublic !== undefined) { setClauses.push('is_public = ?'); params.push(updates.isPublic ? 1 : 0); }
        if (updates.isStrictSchedule !== undefined) { setClauses.push('is_strict_schedule = ?'); params.push(updates.isStrictSchedule ? 1 : 0); }
        if (updates.startDate !== undefined) { setClauses.push('start_date = ?'); params.push(updates.startDate); }
        if (updates.endDate !== undefined) { setClauses.push('end_date = ?'); params.push(updates.endDate); }
        if (updates.memberIds !== undefined) { setClauses.push('member_ids = ?'); params.push(JSON.stringify(updates.memberIds)); }
        if (updates.budgetConfig !== undefined) { setClauses.push('budget_config = ?'); params.push(JSON.stringify(updates.budgetConfig)); }
        if (updates.enabledModules !== undefined) { setClauses.push('enabled_modules = ?'); params.push(JSON.stringify(updates.enabledModules)); }
        if (updates.customFields !== undefined) { setClauses.push('custom_fields = ?'); params.push(JSON.stringify(updates.customFields)); }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(projectId);
            params.push(portalId);

            db.execute(`UPDATE projects SET ${setClauses.join(', ')} WHERE id = ? AND portal_id = ?`, params);
            WbsRollupEngine.rollupProject(db, projectId);
        }

        return this.getProjectById(portalId, projectId);
    }

    /**
     * Deep clones a project (copy_from) including phases, task lists, tasks and dependencies
     */
    static cloneProject(portalId, sourceProjectId, newProjectName, newOwnerId, newStartDate = null) {
        const sourceProj = this.getProjectById(portalId, sourceProjectId);
        const newProj = this.createProject({
            portalId,
            ownerId: newOwnerId,
            name: newProjectName,
            description: `Cloned from ${sourceProj.name}`,
            keyPrefix: `${sourceProj.key_prefix.substring(0, 2)}C`,
            projectGroupId: sourceProj.project_group_id,
            startDate: newStartDate || sourceProj.start_date,
            endDate: sourceProj.end_date,
            isPublic: sourceProj.is_public,
            isStrictSchedule: sourceProj.is_strict_schedule,
            budgetConfig: sourceProj.budget_config,
            memberIds: sourceProj.member_ids
        });

        // Deep copy phases
        const phases = db.queryAll('SELECT * FROM phases WHERE project_id = ? ORDER BY sequence ASC', [sourceProjectId]);
        const phaseIdMap = new Map();

        phases.forEach(ph => {
            const newPhaseId = uuidv4();
            phaseIdMap.set(ph.id, newPhaseId);
            db.execute(
                `INSERT INTO phases (id, portal_id, project_id, name, description, start_date, end_date, owner_id, budget, flag, sequence, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newPhaseId, portalId, newProj.id, ph.name, ph.description,
                    ph.start_date, ph.end_date, newOwnerId, ph.budget, ph.flag, ph.sequence,
                    new Date().toISOString(), new Date().toISOString()
                ]
            );
        });

        // Deep copy task lists
        const taskLists = db.queryAll('SELECT * FROM task_lists WHERE project_id = ?', [sourceProjectId]);
        const listIdMap = new Map();

        taskLists.forEach(tl => {
            const newListId = uuidv4();
            listIdMap.set(tl.id, newListId);
            const mappedPhaseId = tl.phase_id ? phaseIdMap.get(tl.phase_id) : null;
            db.execute(
                `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, sequence, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [newListId, portalId, newProj.id, mappedPhaseId, tl.name, tl.flag, tl.sequence, new Date().toISOString(), new Date().toISOString()]
            );
        });

        // Deep copy tasks
        const tasks = db.queryAll('SELECT * FROM tasks WHERE project_id = ? AND is_trashed = 0', [sourceProjectId]);
        const taskIdMap = new Map();

        tasks.forEach((t, idx) => {
            const newTaskId = uuidv4();
            taskIdMap.set(t.id, newTaskId);
            const mappedListId = listIdMap.get(t.task_list_id);
            if (!mappedListId) return;

            const mappedPhaseId = t.phase_id ? phaseIdMap.get(t.phase_id) : null;
            const seq = idx + 1;
            const prefixKey = `${newProj.key_prefix}-${seq}`;

            db.execute(
                `INSERT INTO tasks (
                    id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
                    name, description_html, flag, priority, start_date, end_date, duration,
                    owner_ids, billing_type, budget, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    newTaskId, portalId, newProj.id, mappedPhaseId, mappedListId, prefixKey, seq,
                    t.name, t.description_html, t.flag, t.priority, t.start_date, t.end_date, t.duration,
                    JSON.stringify([newOwnerId]), t.billing_type, t.budget,
                    new Date().toISOString(), new Date().toISOString()
                ]
            );
        });

        // Update task_seq_counter
        db.execute('UPDATE projects SET task_seq_counter = ? WHERE id = ?', [tasks.length, newProj.id]);
        WbsRollupEngine.rollupProject(db, newProj.id);

        return this.getProjectById(portalId, newProj.id);
    }

    static deleteProject(portalId, projectId, permanent = false) {
        if (permanent) {
            db.execute('DELETE FROM projects WHERE id = ? AND portal_id = ?', [projectId, portalId]);
        } else {
            db.execute(
                "UPDATE projects SET project_type = 'trashed', status_id = 'trashed', updated_at = ? WHERE id = ? AND portal_id = ?",
                [new Date().toISOString(), projectId, portalId]
            );
        }
        return { success: true };
    }
}

module.exports = ProjectsService;
