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

    static createProject(firstArg, secondArg = {}) {
        let options = {};
        if (typeof firstArg === 'string') {
            options = { portalId: firstArg, ...secondArg };
        } else if (firstArg && typeof firstArg === 'object') {
            options = firstArg;
        }

        const {
            portalId,
            ownerId,
            name = 'New Project',
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
        } = options;

        const id = uuidv4();
        const now = new Date().toISOString();

        // Generate Prefix Key e.g. "ZPA", "PROJ"
        const cleanName = (name && typeof name === 'string') ? name : 'PRJ';
        const prefix = (keyPrefix || cleanName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PR')).padEnd(3, 'J');

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

    static getProjectMembers(portalId, projectId) {
        const project = this.getProjectById(portalId, projectId);
        if (!project) throw new Error('Project not found.');

        let memberIds = [];
        try {
            memberIds = Array.isArray(project.member_ids) ? project.member_ids : JSON.parse(project.member_ids || '[]');
        } catch {
            memberIds = [];
        }

        const allIds = Array.from(new Set([project.owner_id, ...memberIds].filter(Boolean)));
        if (allIds.length === 0) return [];

        const placeholders = allIds.map(() => '?').join(',');
        const users = db.queryAll(`
            SELECT id, email, name, role, department, avatar_url
            FROM users
            WHERE id IN (${placeholders})
        `, allIds);

        return users.map(u => ({
            ...u,
            isOwner: u.id === project.owner_id,
            displayRole: u.id === project.owner_id ? 'Owner' : (u.role || 'Member')
        }));
    }

    static async shareProject(portalId, projectId, { email, role = 'member', inviterId, inviterName, inviterEmail, baseUrl = 'http://localhost:5000' }) {
        if (!email || typeof email !== 'string') {
            throw new Error('A valid recipient email address is required.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(cleanEmail)) {
            throw new Error('Please enter a valid recipient email format (e.g. user@example.com).');
        }

        const project = this.getProjectById(portalId, projectId);
        if (!project) throw new Error('Project not found in this workspace.');

        const now = new Date().toISOString();
        let targetUserId = null;

        // 1. Resolve recipient user identity
        let user = db.queryOne('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
        const { resolveAuthorizedRole } = require('../../config/roles');
        const canonicalRole = resolveAuthorizedRole(cleanEmail, user ? user.role : role);

        if (user) {
            targetUserId = user.id;
            // Ensure canonical role consistency in users table
            if (user.role !== canonicalRole) {
                try {
                    db.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [canonicalRole, now, user.id]);
                    user.role = canonicalRole;
                } catch (e) {}
            }
        } else {
            // Provision user in users table
            const newUserId = uuidv4();
            const displayName = cleanEmail.split('@')[0];

            db.execute(
                `INSERT INTO users (id, email, password_hash, name, role, department, status, created_at, updated_at)
                 VALUES (?, ?, 'FIREBASE_AUTH_MANAGED', ?, ?, 'Team', 'active', ?, ?)`,
                [newUserId, cleanEmail, displayName, canonicalRole, now, now]
            );
            targetUserId = newUserId;
            user = { id: newUserId, email: cleanEmail, name: displayName, role: canonicalRole };
        }

        // 2. Add to portal_members if not present
        const portalMember = db.queryOne('SELECT * FROM portal_members WHERE portal_id = ? AND user_id = ?', [portalId, targetUserId]);
        if (!portalMember) {
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [uuidv4(), portalId, targetUserId, canonicalRole, now]
            );
        }

        // 3. Update project member_ids
        let members = [];
        try {
            members = Array.isArray(project.member_ids) ? [...project.member_ids] : (typeof project.member_ids === 'string' ? JSON.parse(project.member_ids) : []);
        } catch (e) {
            members = [];
        }

        if (!members.includes(targetUserId)) {
            members.push(targetUserId);
            db.execute('UPDATE projects SET member_ids = ?, updated_at = ? WHERE id = ? AND portal_id = ?', [
                JSON.stringify(members),
                now,
                projectId,
                portalId
            ]);
        }

        // 4. Save to invited_members record (UPSERT: update if already exists, insert if new)
        const crypto = require('crypto');
        const existingInvite = db.queryOne('SELECT id, token FROM invited_members WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
        let inviteId = existingInvite ? existingInvite.id : uuidv4();
        let token = existingInvite?.token || (uuidv4() + '-' + crypto.randomBytes(16).toString('hex'));
        let tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const inviteStatus = user ? 'active' : 'pending';

        if (existingInvite) {
            db.execute(
                `UPDATE invited_members 
                 SET portal_id = ?, name = ?, role = ?, status = ?, invited_by = ?, token = ?, token_hash = ?, expires_at = ?, project_id = ?, updated_at = ? 
                 WHERE id = ?`,
                [portalId, user?.name || cleanEmail.split('@')[0], canonicalRole, inviteStatus, inviterId || 'system', token, tokenHash, expiresAt, projectId, now, inviteId]
            );
        } else {
            db.execute(
                `INSERT INTO invited_members (id, portal_id, email, name, role, status, invited_by, token, token_hash, expires_at, project_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [inviteId, portalId, cleanEmail, user?.name || cleanEmail.split('@')[0], canonicalRole, inviteStatus, inviterId || 'system', token, tokenHash, expiresAt, projectId, now, now]
            );
        }

        // 5. Construct invite and workspace access links with token & direct project routing
        const directUrl = `${baseUrl}/#project/${projectId}/tasks`;
        const shareLink = `${baseUrl}/login?token=${token}&inviteEmail=${encodeURIComponent(cleanEmail)}&projectId=${projectId}&redirect=${encodeURIComponent('/#project/' + projectId + '/tasks')}`;

        // Detect if sender and recipient use the same email address
        const isSelfShare = Boolean((inviterId && targetUserId === inviterId) || (inviterEmail && cleanEmail === inviterEmail.toLowerCase().trim()));

        // 6. Send email notification via EmailService (resilient delivery)
        let emailDelivery = { success: false, deliveredToInbox: false };
        try {
            const EmailService = require('../../services/emailService');
            emailDelivery = await EmailService.sendInvitationEmail({
                recipientEmail: cleanEmail,
                recipientName: user?.name || cleanEmail.split('@')[0],
                role: canonicalRole,
                portalName: 'Life PMS Workspace',
                projectName: project.name,
                inviteLink: shareLink,
                token,
                expiresAt,
                inviterName: inviterName || 'Project Administrator',
                isSelfShare
            });
        } catch (mailErr) {
            console.error('[EmailService] Project share dispatch error:', mailErr.message);
            emailDelivery = { success: false, deliveredToInbox: false, error: mailErr.message };
        }

        // 7. Sync to Firestore if available
        try {
            const { db: firestoreDb } = require('../../config/firebase');
            if (firestoreDb && typeof firestoreDb.collection === 'function') {
                await firestoreDb.collection('submitted_emails').add({
                    email: cleanEmail,
                    role: canonicalRole,
                    projectId,
                    source: 'project_share_modal',
                    portalId,
                    sharedAt: now,
                    invitedBy: inviterName || 'Admin',
                    isSelfShare
                });
            }
        } catch (fsErr) {
            console.warn('[Firestore] Project share sync notice:', fsErr.message);
        }

        const message = isSelfShare
            ? `Project "${project.name}" access link and summary successfully sent to your email (${cleanEmail}).`
            : `Project "${project.name}" successfully shared with ${cleanEmail} (${canonicalRole})!`;

        return {
            success: true,
            message,
            projectId,
            projectName: project.name,
            email: cleanEmail,
            role: canonicalRole,
            token,
            expiresAt,
            isSelfShare,
            shareLink,
            directUrl,
            messageId: emailDelivery.messageId || null,
            previewUrl: emailDelivery.previewUrl || null,
            deliveredToInbox: emailDelivery.deliveredToInbox || false,
            sandboxOnly: emailDelivery.sandboxOnly || false,
            provider: emailDelivery.provider || null,
            emailDelivery
        };
    }
}

module.exports = ProjectsService;
