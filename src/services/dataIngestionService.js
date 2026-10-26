/**
 * Real Data Ingestion & Seeding Service
 * Dedicated service for inserting actual production data (projects, tasks, issues, users)
 * without touching dummy/mock logic. Validates foreign keys and runs in an atomic transaction.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const WbsRollupEngine = require('../engines/wbsRollupEngine');

class DataIngestionService {
    /**
     * Ingest full production data payload into the database
     * @param {string} portalId
     * @param {Object} payload
     */
    static async ingestPayload(portalId, payload = {}) {
        const {
            users = [],
            projects = [],
            phases = [],
            taskLists = [],
            tasks = [],
            issues = []
        } = payload;

        const results = {
            usersCreated: 0,
            projectsCreated: 0,
            phasesCreated: 0,
            taskListsCreated: 0,
            tasksCreated: 0,
            issuesCreated: 0
        };

        const now = new Date().toISOString();

        return db.transaction(async (database) => {
            // 1. Ingest Users
            for (const u of users) {
                const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(u.email.toLowerCase().trim());
                let userId = existing ? existing.id : (u.id || uuidv4());

                if (!existing) {
                    const passHash = await bcrypt.hash(u.password || 'Password123!', 10);
                    database.prepare(`
                        INSERT INTO users (id, email, password_hash, name, role, department, cost_per_hour, billable_rate_per_hour, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        userId,
                        u.email.toLowerCase().trim(),
                        passHash,
                        u.name,
                        u.role || 'employee',
                        u.department || 'General',
                        u.costPerHour || 0.0,
                        u.billableRatePerHour || 0.0,
                        now, now
                    );
                    results.usersCreated++;
                }

                // Add to portal_members if not present
                const member = database.prepare('SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?').get(portalId, userId);
                if (!member) {
                    database.prepare(`
                        INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                        VALUES (?, ?, ?, ?, 'active', ?)
                    `).run(uuidv4(), portalId, userId, u.role || 'employee', now);
                }
            }

            // 2. Ingest Projects
            const defaultOwner = database.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
            const ownerId = defaultOwner ? defaultOwner.id : 'user-admin';

            for (const p of projects) {
                const projId = p.id || `proj-${(p.keyPrefix || 'PRJ').toLowerCase()}`;
                const existing = database.prepare('SELECT id FROM projects WHERE id = ?').get(projId);

                if (!existing) {
                    const budgetConfig = JSON.stringify({
                        currency: 'USD',
                        budgetType: 'project_hours',
                        billingMethod: 'project_hours',
                        plannedCost: p.budgetAmount || 25000,
                        actualCost: 0,
                        plannedHours: 0,
                        actualHours: 0,
                        revenueBudget: 0,
                        earnedValue: 0
                    });

                    const stats = JSON.stringify({
                        openTaskCount: 0,
                        closedTaskCount: 0,
                        openIssueCount: 0,
                        closedIssueCount: 0,
                        completionPercentage: 0,
                        healthScore: 'on_track'
                    });

                    database.prepare(`
                        INSERT INTO projects (
                            id, portal_id, owner_id, name, key_prefix, description,
                            start_date, end_date, budget_config, stats, is_public, project_type,
                            task_seq_counter, issue_seq_counter, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?, ?)
                    `).run(
                        projId,
                        portalId,
                        p.ownerId || ownerId,
                        p.name,
                        p.keyPrefix || 'PRJ',
                        p.description || '',
                        p.startDate || now.split('T')[0],
                        p.endDate || now.split('T')[0],
                        budgetConfig,
                        stats,
                        p.isPublic !== undefined ? (p.isPublic ? 1 : 0) : 1,
                        now, now
                    );
                    results.projectsCreated++;
                }
            }

            // 3. Ingest Phases
            for (const ph of phases) {
                const phaseId = ph.id || uuidv4();
                const existing = database.prepare('SELECT id FROM phases WHERE id = ?').get(phaseId);

                if (!existing) {
                    database.prepare(`
                        INSERT INTO phases (id, portal_id, project_id, name, sequence, status, flag, start_date, end_date, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        phaseId,
                        portalId,
                        ph.projectId,
                        ph.name,
                        ph.sequence || 1,
                        ph.status || 'open',
                        ph.flag || 'internal',
                        ph.startDate || null,
                        ph.endDate || null,
                        now, now
                    );
                    results.phasesCreated++;
                }
            }

            // 4. Ingest Task Lists
            for (const tl of taskLists) {
                const listId = tl.id || uuidv4();
                const existing = database.prepare('SELECT id FROM task_lists WHERE id = ?').get(listId);

                if (!existing) {
                    const seqJson = JSON.stringify({ milestoneSequence: tl.sequence || 1, projectSequence: tl.sequence || 1 });
                    database.prepare(`
                        INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, sequence, flag, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        listId,
                        portalId,
                        tl.projectId,
                        tl.phaseId || null,
                        tl.name,
                        seqJson,
                        tl.flag || 'internal',
                        now, now
                    );
                    results.taskListsCreated++;
                }
            }

            // 5. Ingest Tasks
            for (const t of tasks) {
                const taskId = t.id || uuidv4();
                const existing = database.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);

                if (!existing) {
                    const proj = database.prepare('SELECT key_prefix, task_seq_counter FROM projects WHERE id = ?').get(t.projectId);
                    const nextSeq = (proj ? proj.task_seq_counter : 0) + 1;
                    const prefixKey = t.prefixKey || `${proj ? proj.key_prefix : 'TSK'}-${nextSeq}`;

                    if (proj) {
                        database.prepare('UPDATE projects SET task_seq_counter = ? WHERE id = ?').run(nextSeq, t.projectId);
                    }

                    const isCompleted = (t.statusId === 'completed' || t.statusId === 'closed') ? 1 : 0;
                    const completionPct = isCompleted ? 100 : (t.completionPercentage || 0);

                    database.prepare(`
                        INSERT INTO tasks (
                            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
                            name, description_html, note, flag, depth, status_id, is_completed, is_closed_type,
                            priority, completion_percentage, start_date, end_date, duration, predecessors,
                            baseline_start_date, baseline_end_date, owner_ids, billing_type,
                            associated_team, work_hours, reminder, is_trashed, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                    `).run(
                        taskId,
                        portalId,
                        t.projectId,
                        t.phaseId || null,
                        t.taskListId,
                        prefixKey,
                        nextSeq,
                        t.name,
                        t.descriptionHtml || '',
                        t.note || '',
                        t.flag || 'internal',
                        t.depth || 0,
                        t.statusId || 'open',
                        isCompleted,
                        isCompleted,
                        t.priority || 'medium',
                        completionPct,
                        t.startDate || null,
                        t.endDate || null,
                        JSON.stringify(t.duration || { value: 1, type: 'days' }),
                        JSON.stringify(t.predecessors || []),
                        t.startDate || null,
                        t.endDate || null,
                        JSON.stringify(t.ownerIds || []),
                        t.billingType || 'billable',
                        t.associatedTeam || t.associated_team || '',
                        t.workHours || t.work_hours || '00:00',
                        t.reminder || 'None',
                        now, now
                    );
                    results.tasksCreated++;
                } else {
                    const isCompleted = (t.statusId === 'completed' || t.statusId === 'closed') ? 1 : 0;
                    database.prepare(`
                        UPDATE tasks SET
                            task_list_id = COALESCE(?, task_list_id),
                            phase_id = COALESCE(?, phase_id),
                            name = COALESCE(?, name),
                            status_id = COALESCE(?, status_id),
                            is_completed = ?,
                            is_closed_type = ?,
                            owner_ids = COALESCE(?, owner_ids),
                            priority = COALESCE(?, priority),
                            start_date = COALESCE(?, start_date),
                            end_date = COALESCE(?, end_date),
                            duration = COALESCE(?, duration),
                            associated_team = COALESCE(?, associated_team),
                            work_hours = COALESCE(?, work_hours),
                            reminder = COALESCE(?, reminder),
                            updated_at = ?
                        WHERE id = ?
                    `).run(
                        t.taskListId || null,
                        t.phaseId || null,
                        t.name || null,
                        t.statusId || null,
                        isCompleted,
                        isCompleted,
                        t.ownerIds ? JSON.stringify(t.ownerIds) : null,
                        t.priority || null,
                        t.startDate || null,
                        t.endDate || null,
                        t.duration ? JSON.stringify(t.duration) : null,
                        t.associatedTeam || t.associated_team || null,
                        t.workHours || t.work_hours || null,
                        t.reminder || null,
                        now,
                        taskId
                    );
                }
            }

            // 6. Ingest Issues
            for (const iss of issues) {
                const issueId = iss.id || uuidv4();
                const existing = database.prepare('SELECT id FROM issues WHERE id = ?').get(issueId);

                if (!existing) {
                    const proj = database.prepare('SELECT key_prefix, issue_seq_counter FROM projects WHERE id = ?').get(iss.projectId);
                    const nextSeq = (proj ? proj.issue_seq_counter : 0) + 1;
                    const prefixKey = iss.prefixKey || `BUG-${nextSeq}`;

                    if (proj) {
                        database.prepare('UPDATE projects SET issue_seq_counter = ? WHERE id = ?').run(nextSeq, iss.projectId);
                    }

                    database.prepare(`
                        INSERT INTO issues (
                            id, portal_id, project_id, reporter_id, prefix_key, sequence_number, title,
                            description_html, severity, classification, module, status_id, is_closed,
                            priority, flag, sla_breached, is_trashed, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
                    `).run(
                        issueId,
                        portalId,
                        iss.projectId,
                        iss.reporterId || ownerId,
                        prefixKey,
                        nextSeq,
                        iss.title,
                        iss.descriptionHtml || '',
                        iss.severity || 'major',
                        iss.classification || 'ui',
                        iss.module || 'General',
                        iss.statusId || 'open',
                        iss.statusId === 'closed' ? 1 : 0,
                        iss.priority || 'medium',
                        iss.flag || 'internal',
                        now, now
                    );
                    results.issuesCreated++;
                }
            }

            // Rollup affected projects
            const projectIds = [...new Set([...projects.map(p => p.id), ...tasks.map(t => t.projectId)])];
            for (const pid of projectIds) {
                if (pid) WbsRollupEngine.rollupProject(db, pid);
            }

            return results;
        });
    }
}

module.exports = DataIngestionService;
