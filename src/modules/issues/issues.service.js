const CentralSyncService = require('../../services/centralSyncService');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const SlaEngine = require('../../engines/slaEngine');
const WbsRollupEngine = require('../../engines/wbsRollupEngine');

class IssuesService {
    static getIssues(portalId, projectId, isClient = false, filters = {}) {
        let sql = 'SELECT * FROM issues WHERE portal_id = ? AND project_id = ?';
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

        if (filters.severity) {
            sql += ' AND severity = ?';
            params.push(filters.severity);
        }

        if (filters.statusId) {
            sql += ' AND status_id = ?';
            params.push(filters.statusId);
        }

        if (filters.assigneeId) {
            sql += ' AND assignee_id = ?';
            params.push(filters.assigneeId);
        }

        sql += ' ORDER BY sequence_number DESC';
        const rows = db.queryAll(sql, params);

        return rows.map(i => this.formatIssue(i));
    }

    static getIssueById(portalId, issueId, isClient = false) {
        let sql = 'SELECT * FROM issues WHERE id = ? AND portal_id = ?';
        const params = [issueId, portalId];

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        const issue = db.queryOne(sql, params);
        if (!issue) throw new Error('Issue not found.');

        return this.formatIssue(issue);
    }

    static formatIssue(i) {
        return {
            ...i,
            custom_fields: JSON.parse(i.custom_fields || '{}')
        };
    }

    static createIssue(portalId, {
        projectId,
        title,
        descriptionHtml = '',
        severity = 'major',
        reproducibility = 'always',
        classification = 'ui',
        module = 'General',
        affectedMilestoneId = null,
        releaseMilestoneId = null,
        assigneeId = null,
        reporterId,
        flag = 'internal',
        priority = 'medium',
        relatedTaskId = null,
        customFields = {}
    }) {
        const id = uuidv4();
        const now = new Date();
        const nowIso = now.toISOString();

        return db.transaction((database) => {
            // Fetch Project for Issue Counter
            const proj = database.prepare('SELECT key_prefix, issue_seq_counter FROM projects WHERE id = ?').get(projectId);
            if (!proj) throw new Error('Project not found.');

            const nextSeq = (proj.issue_seq_counter || 0) + 1;
            const prefixKey = `BUG-${nextSeq}`;
            database.prepare('UPDATE projects SET issue_seq_counter = ? WHERE id = ?').run(nextSeq, projectId);

            // Compute SLA targets
            const sla = SlaEngine.getSlaTargets(severity, now);

            database.prepare(
                `INSERT INTO issues (
                    id, portal_id, project_id, affected_milestone_id, release_milestone_id,
                    prefix_key, sequence_number, title, description_html, severity,
                    reproducibility, classification, module, status_id, is_closed,
                    priority, assignee_id, reporter_id, flag, sla_response_target_date,
                    sla_resolution_target_date, sla_breached, related_task_id, custom_fields,
                    is_trashed, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, 'open', 0,
                    ?, ?, ?, ?, ?,
                    ?, 0, ?, ?,
                    0, ?, ?
                )`
            ).run(
                id, portalId, projectId, affectedMilestoneId, releaseMilestoneId,
                prefixKey, nextSeq, title, descriptionHtml, severity,
                reproducibility, classification, module,
                priority, assigneeId, reporterId, flag, sla.slaResponseTargetDate,
                sla.slaResolutionTargetDate, relatedTaskId, JSON.stringify(customFields),
                nowIso, nowIso
            );

            WbsRollupEngine.rollupProject(db, projectId);

            const createdIssue = this.getIssueById(portalId, id);
            CentralSyncService.syncIssue(createdIssue).catch(() => {});
            return createdIssue;
        });
    }

    static updateIssue(portalId, issueId, updates) {
        const issue = db.queryOne('SELECT * FROM issues WHERE id = ? AND portal_id = ?', [issueId, portalId]);
        if (!issue) throw new Error('Issue not found.');

        const setClauses = [];
        const params = [];

        if (updates.title !== undefined) { setClauses.push('title = ?'); params.push(updates.title); }
        if (updates.descriptionHtml !== undefined) { setClauses.push('description_html = ?'); params.push(updates.descriptionHtml); }
        if (updates.severity !== undefined) {
            setClauses.push('severity = ?'); params.push(updates.severity);
            const sla = SlaEngine.getSlaTargets(updates.severity, new Date(issue.created_at));
            setClauses.push('sla_response_target_date = ?'); params.push(sla.slaResponseTargetDate);
            setClauses.push('sla_resolution_target_date = ?'); params.push(sla.slaResolutionTargetDate);
        }
        if (updates.reproducibility !== undefined) { setClauses.push('reproducibility = ?'); params.push(updates.reproducibility); }
        if (updates.classification !== undefined) { setClauses.push('classification = ?'); params.push(updates.classification); }
        if (updates.module !== undefined) { setClauses.push('module = ?'); params.push(updates.module); }
        if (updates.priority !== undefined) { setClauses.push('priority = ?'); params.push(updates.priority); }
        if (updates.assigneeId !== undefined) { setClauses.push('assignee_id = ?'); params.push(updates.assigneeId); }
        if (updates.affectedMilestoneId !== undefined) { setClauses.push('affected_milestone_id = ?'); params.push(updates.affectedMilestoneId); }
        if (updates.releaseMilestoneId !== undefined) { setClauses.push('release_milestone_id = ?'); params.push(updates.releaseMilestoneId); }
        if (updates.flag !== undefined) { setClauses.push('flag = ?'); params.push(updates.flag); }
        if (updates.statusId !== undefined) {
            setClauses.push('status_id = ?'); params.push(updates.statusId);
            const isClosed = updates.statusId === 'closed' || updates.statusId === 'resolved' ? 1 : 0;
            setClauses.push('is_closed = ?'); params.push(isClosed);
        }
        if (updates.customFields !== undefined) { setClauses.push('custom_fields = ?'); params.push(JSON.stringify(updates.customFields)); }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(issueId);
            params.push(portalId);

            db.execute(`UPDATE issues SET ${setClauses.join(', ')} WHERE id = ? AND portal_id = ?`, params);
            WbsRollupEngine.rollupProject(db, issue.project_id);
        }

        return this.getIssueById(portalId, issueId);
    }

    /**
     * Converts a reported Bug/Issue into a scheduled WBS Task
     */
    static convertIssueToTask(portalId, issueId, targetTaskListId = null, targetPhaseId = null) {
        const issue = this.getIssueById(portalId, issueId);
        if (!targetTaskListId) {
            const defaultTl = db.queryOne('SELECT id, phase_id FROM task_lists WHERE project_id = ? AND portal_id = ? LIMIT 1', [issue.project_id, portalId]);
            if (defaultTl) {
                targetTaskListId = defaultTl.id;
                targetPhaseId = targetPhaseId || defaultTl.phase_id;
            }
        }
        if (!targetTaskListId) throw new Error('No active task list found in project to convert issue.');

        return db.transaction((database) => {
            const TasksService = require('../tasks/tasks.service');
            const newTask = TasksService.createTask(portalId, {
                projectId: issue.project_id,
                taskListId: targetTaskListId,
                phaseId: targetPhaseId || issue.release_milestone_id,
                name: `[FIX] ${issue.title}`,
                descriptionHtml: `Converted from Issue ${issue.prefix_key}:<br/>${issue.description_html}`,
                flag: issue.flag,
                priority: issue.priority,
                ownerIds: issue.assignee_id ? [issue.assignee_id] : []
            });

            // Link issue to task
            database.prepare('UPDATE issues SET related_task_id = ?, updated_at = ? WHERE id = ?').run(
                newTask.id,
                new Date().toISOString(),
                issueId
            );

            return {
                success: true,
                issueId,
                createdTaskId: newTask.id,
                task: newTask
            };
        });
    }

    /**
     * PDF Feature 84: Duplicate Issue Merging
     * Merging duplicate bug reports while preserving all reporters/followers
     */
    static mergeIssues(portalId, primaryIssueId, duplicateIssueId) {
        const primary = this.getIssueById(portalId, primaryIssueId);
        const duplicate = this.getIssueById(portalId, duplicateIssueId);

        return db.transaction(() => {
            const now = new Date().toISOString();

            // Close duplicate issue and link to primary
            db.execute(
                "UPDATE issues SET is_closed = 1, status_id = 'closed', duplicate_of_issue_id = ?, updated_at = ? WHERE id = ? AND portal_id = ?",
                [primaryIssueId, now, duplicateIssueId, portalId]
            );

            // Re-link comments from duplicate to primary
            db.execute(
                "UPDATE comments SET entity_id = ? WHERE entity_type = 'issue' AND entity_id = ? AND portal_id = ?",
                [primaryIssueId, duplicateIssueId, portalId]
            );

            // Log activity comment
            const CollaborationService = require('../collaboration/collaboration.service');
            CollaborationService.createComment(portalId, {
                entityType: 'issue',
                entityId: primaryIssueId,
                userId: primary.reporter_id,
                content: `Merged duplicate issue ${duplicate.prefix_key} ("${duplicate.title}") into this issue.`
            });

            return this.getIssueById(portalId, primaryIssueId);
        });
    }

    /**
     * PDF Feature 79: Web-to-Issue Intake Form
     * Public bug submission form creating new issue
     */
    static webToIssue(portalId, { projectId, title, descriptionHtml, severity = 'major', classification = 'ui', reporterEmail, reporterName }) {
        if (!title) throw new Error('title is required.');
        if (!projectId) {
            const defProj = db.queryOne('SELECT id FROM projects WHERE portal_id = ? LIMIT 1', [portalId]);
            if (defProj) {
                projectId = defProj.id;
            } else {
                const ProjectsService = require('../projects/projects.service');
                const newP = ProjectsService.createProject({
                    portalId,
                    name: 'General Project',
                    keyPrefix: 'GEN',
                    isPublic: 1
                });
                projectId = newP.id;
            }
        }

        // Find or create reporter user
        let reporter = reporterEmail ? db.queryOne('SELECT id FROM users WHERE email = ?', [reporterEmail]) : null;
        if (!reporter) {
            reporter = db.queryOne('SELECT owner_id FROM projects WHERE id = ?', [projectId]);
        }

        return this.createIssue(portalId, {
            projectId,
            title,
            descriptionHtml: `[Web Intake from ${reporterName || reporterEmail || 'Public User'}]<br/>${descriptionHtml || ''}`,
            severity,
            classification,
            flag: 'external',
            reporterId: reporter ? reporter.id || reporter.owner_id : 'guest-user'
        });
    }

    static softDeleteIssue(portalId, issueId) {
        db.execute(
            'UPDATE issues SET is_trashed = 1, trashed_at = ?, updated_at = ? WHERE id = ? AND portal_id = ?',
            [new Date().toISOString(), new Date().toISOString(), issueId, portalId]
        );
        return { success: true };
    }
}

module.exports = IssuesService;
