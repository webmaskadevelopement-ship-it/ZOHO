const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/projects/projects.service.js');
let code = fs.readFileSync(filePath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

const oldBlock = `        const id = uuidv4();
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
                \`INSERT INTO projects (
                    id, portal_id, project_group_id, name, description, key_prefix,
                    task_seq_counter, issue_seq_counter, owner_id, member_ids, client_company_ids,
                    project_type, is_public, is_strict_schedule, is_rollup_project,
                    start_date, end_date, budget_config, stats, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
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
                \`INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Internal)', 'internal', 1, ?, ?)\`,
                [internalListId, portalId, id, now, now]
            );

            const externalListId = uuidv4();
            db.execute(
                \`INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Client Visible)', 'external', 1, ?, ?)\`,
                [externalListId, portalId, id, now, now]
            );

            return this.getProjectById(portalId, id);
        });`;

const newBlock = `        const id = uuidv4();
        const now = new Date().toISOString();

        // 1. Resolve safe portalId to guarantee foreign key validity
        let finalPortalId = portalId || 'portal-demo-zoho';
        const portalRow = db.queryOne('SELECT id FROM portals WHERE id = ?', [finalPortalId]);
        if (!portalRow) {
            finalPortalId = 'portal-demo-zoho';
        }

        // 2. Resolve safe ownerId to guarantee foreign key validity
        let finalOwnerId = ownerId;
        let userRow = finalOwnerId ? db.queryOne('SELECT id FROM users WHERE id = ?', [finalOwnerId]) : null;
        if (!userRow && finalOwnerId) {
            userRow = db.queryOne('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?', [String(finalOwnerId).toLowerCase(), String(finalOwnerId).toLowerCase()]);
            if (userRow) finalOwnerId = userRow.id;
        }
        if (!userRow) {
            const fallbackAdmin = db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1") || db.queryOne("SELECT id FROM users LIMIT 1");
            finalOwnerId = fallbackAdmin ? fallbackAdmin.id : null;
        }

        // 3. Resolve safe projectGroupId to prevent FOREIGN KEY constraint failure
        let finalProjectGroupId = null;
        if (projectGroupId && projectGroupId !== 'general' && projectGroupId !== 'none' && projectGroupId !== 'null') {
            let groupRow = db.queryOne('SELECT id FROM project_groups WHERE id = ?', [projectGroupId]);
            if (!groupRow) {
                groupRow = db.queryOne('SELECT id FROM project_groups WHERE LOWER(name) = ? OR LOWER(id) = ?', [String(projectGroupId).toLowerCase(), String(projectGroupId).toLowerCase()]);
            }
            if (groupRow) {
                finalProjectGroupId = groupRow.id;
            } else {
                try {
                    const groupName = projectGroupId === 'internal' ? 'Internal Operations' : (projectGroupId === 'client' ? 'Client Workflows' : (String(projectGroupId).charAt(0).toUpperCase() + String(projectGroupId).slice(1)));
                    db.execute(
                        'INSERT OR IGNORE INTO project_groups (id, portal_id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [projectGroupId, finalPortalId, groupName, 'Project Group', '#3B82F6', now]
                    );
                    finalProjectGroupId = projectGroupId;
                } catch (e) {
                    finalProjectGroupId = null;
                }
            }
        }

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

        const finalMemberIds = Array.from(new Set([finalOwnerId, ...memberIds].filter(Boolean)));

        return db.transaction(() => {
            db.execute(
                \`INSERT INTO projects (
                    id, portal_id, project_group_id, name, description, key_prefix,
                    task_seq_counter, issue_seq_counter, owner_id, member_ids, client_company_ids,
                    project_type, is_public, is_strict_schedule, is_rollup_project,
                    start_date, end_date, budget_config, stats, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`,
                [
                    id, finalPortalId, finalProjectGroupId, name, description, prefix,
                    finalOwnerId, JSON.stringify(finalMemberIds), JSON.stringify(clientCompanyIds),
                    projectType, isPublic ? 1 : 0, isStrictSchedule ? 1 : 0, isRollupProject ? 1 : 0,
                    startDate, endDate, JSON.stringify(initialBudget), JSON.stringify(initialStats),
                    now, now
                ]
            );

            // Auto-create default internal and external Task Lists
            const internalListId = uuidv4();
            db.execute(
                \`INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Internal)', 'internal', 1, ?, ?)\`,
                [internalListId, finalPortalId, id, now, now]
            );

            const externalListId = uuidv4();
            db.execute(
                \`INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                 VALUES (?, ?, ?, NULL, 'General (Client Visible)', 'external', 1, ?, ?)\`,
                [externalListId, finalPortalId, id, now, now]
            );

            return this.getProjectById(finalPortalId, id);
        });`;

if (code.includes(oldBlock)) {
    code = code.replace(oldBlock, newBlock);
    if (isCRLF) code = code.replace(/\n/g, '\r\n');
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('✓ Successfully patched ProjectsService.createProject with foreign key resolution');
} else {
    console.error('Target block not found in projects.service.js');
}

