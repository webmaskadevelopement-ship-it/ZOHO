const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const BusinessDayEngine = require('../../engines/businessDayEngine');

class PhasesService {
    static getPhases(portalId, projectId, isClient = false) {
        let sql = `
            SELECT p.*,
                   (SELECT COUNT(*) FROM tasks t WHERE t.phase_id = p.id AND (t.is_trashed = 0 OR t.is_trashed IS NULL)) as tasks_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.phase_id = p.id AND (t.is_completed = 1 OR t.status_id = 'completed') AND (t.is_trashed = 0 OR t.is_trashed IS NULL)) as closed_tasks_count
            FROM phases p
            WHERE p.portal_id = ? AND p.project_id = ?
        `;
        const params = [portalId, projectId];

        if (isClient) {
            sql += " AND p.flag = 'external'";
        }

        sql += ' ORDER BY p.sequence ASC, p.start_date ASC';
        const phases = db.queryAll(sql, params);

        return phases.map(ph => {
            const total = ph.tasks_count || 0;
            const closed = ph.closed_tasks_count || 0;
            const comp = total > 0 ? Math.round((closed / total) * 100) : (ph.completion_percentage || 0);
            return {
                ...ph,
                completion_percentage: comp
            };
        });
    }

    static getPhaseById(portalId, phaseId, isClient = false) {
        let sql = 'SELECT * FROM phases WHERE id = ? AND portal_id = ?';
        const params = [phaseId, portalId];

        if (isClient) {
            sql += " AND flag = 'external'";
        }

        const ph = db.queryOne(sql, params);
        if (!ph) throw new Error('Phase not found or access denied.');
        return ph;
    }

    static createPhase(portalId, {
        projectId,
        name,
        description = '',
        startDate = null,
        endDate = null,
        ownerId = null,
        budget = 0,
        flag = 'internal',
        startAfterPhaseId = null,
        startAfterDays = 0,
        sequence = 0
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        let computedStartDate = startDate;
        let computedEndDate = endDate;

        // Sequential Phase Chaining
        if (startAfterPhaseId) {
            const predPhase = db.queryOne('SELECT end_date FROM phases WHERE id = ?', [startAfterPhaseId]);
            if (predPhase && predPhase.end_date) {
                computedStartDate = BusinessDayEngine.addBusinessDays(predPhase.end_date, startAfterDays || 1);
                if (!computedEndDate) {
                    computedEndDate = BusinessDayEngine.addBusinessDays(computedStartDate, 14); // default 2 weeks
                }
            }
        }

        db.execute(
            `INSERT INTO phases (
                id, portal_id, project_id, name, description, start_date, end_date,
                owner_id, budget, completion_percentage, flag, status, start_after_phase_id,
                start_after_days, sequence, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active', ?, ?, ?, ?, ?)`,
            [
                id, portalId, projectId, name, description, computedStartDate, computedEndDate,
                ownerId, budget, flag, startAfterPhaseId, startAfterDays, sequence, now, now
            ]
        );

        return this.getPhaseById(portalId, id);
    }

    static updatePhase(portalId, phaseId, updates) {
        const ph = db.queryOne('SELECT * FROM phases WHERE id = ? AND portal_id = ?', [phaseId, portalId]);
        if (!ph) throw new Error('Phase not found.');

        const setClauses = [];
        const params = [];

        if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
        if (updates.description !== undefined) { setClauses.push('description = ?'); params.push(updates.description); }
        if (updates.startDate !== undefined) { setClauses.push('start_date = ?'); params.push(updates.startDate); }
        if (updates.endDate !== undefined) { setClauses.push('end_date = ?'); params.push(updates.endDate); }
        if (updates.ownerId !== undefined) { setClauses.push('owner_id = ?'); params.push(updates.ownerId); }
        if (updates.budget !== undefined) { setClauses.push('budget = ?'); params.push(updates.budget); }
        if (updates.flag !== undefined) { setClauses.push('flag = ?'); params.push(updates.flag); }
        if (updates.status !== undefined) { setClauses.push('status = ?'); params.push(updates.status); }
        if (updates.startAfterPhaseId !== undefined) { setClauses.push('start_after_phase_id = ?'); params.push(updates.startAfterPhaseId); }
        if (updates.startAfterDays !== undefined) { setClauses.push('start_after_days = ?'); params.push(updates.startAfterDays); }
        if (updates.sequence !== undefined) { setClauses.push('sequence = ?'); params.push(updates.sequence); }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(phaseId);
            params.push(portalId);

            db.execute(`UPDATE phases SET ${setClauses.join(', ')} WHERE id = ? AND portal_id = ?`, params);
        }

        return this.getPhaseById(portalId, phaseId);
    }

    /**
     * PDF Feature 26: Sequential Phase Chaining
     * Sets a phase to start_after a previous phase by N days/weeks/months and cascades downstream
     */
    static chainPhase(portalId, phaseId, { startAfterPhaseId, offsetDays = 0 }) {
        const currentPhase = this.getPhaseById(portalId, phaseId);
        const prevPhase = this.getPhaseById(portalId, startAfterPhaseId);

        if (!prevPhase.end_date) {
            throw new Error('Predecessor phase must have an end date to calculate sequential chain.');
        }

        // Calculate duration of current phase
        let durationDays = 14;
        if (currentPhase.start_date && currentPhase.end_date) {
            const diffMs = new Date(currentPhase.end_date).getTime() - new Date(currentPhase.start_date).getTime();
            durationDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }

        const newStartDate = BusinessDayEngine.addBusinessDays(prevPhase.end_date, offsetDays);
        const newEndDate = BusinessDayEngine.addBusinessDays(newStartDate, durationDays);

        this.updatePhase(portalId, phaseId, {
            startAfterPhaseId,
            startAfterDays: offsetDays,
            startDate: newStartDate,
            endDate: newEndDate
        });

        // Cascade to any successor phases that depend on this phase
        const successors = db.queryAll('SELECT id, start_after_days FROM phases WHERE start_after_phase_id = ? AND portal_id = ?', [phaseId, portalId]);
        successors.forEach(succ => {
            this.chainPhase(portalId, succ.id, { startAfterPhaseId: phaseId, offsetDays: succ.start_after_days || 0 });
        });

        return this.getPhaseById(portalId, phaseId);
    }

    /**
     * PDF Feature 82: Release Notes Generator
     * Compiling all closed issues and tasks tied to a release_milestone into formatted release notes
     */
    static generateReleaseNotes(portalId, phaseId) {
        const phase = this.getPhaseById(portalId, phaseId);
        const proj = db.queryOne('SELECT name, key_prefix FROM projects WHERE id = ?', [phase.project_id]);

        // Tasks in this phase
        const tasks = db.queryAll(
            `SELECT prefix_key, name, description_html, updated_at
             FROM tasks
             WHERE phase_id = ? AND portal_id = ? AND (is_completed = 1 OR status_id = 'completed') AND is_trashed = 0
             ORDER BY sequence_number ASC`,
            [phaseId, portalId]
        );

        // Issues resolved in this milestone
        const issues = db.queryAll(
            `SELECT prefix_key, title, severity, classification, updated_at
             FROM issues
             WHERE release_milestone_id = ? AND portal_id = ? AND is_closed = 1 AND is_trashed = 0
             ORDER BY sequence_number ASC`,
            [phaseId, portalId]
        );

        const mdLines = [
            `# Release Notes: ${phase.name}`,
            `**Project**: ${proj ? proj.name : 'Project'}`,
            `**Target Date**: ${phase.end_date || 'N/A'}`,
            `**Status**: ${phase.status || 'active'}`,
            '',
            '## 🚀 Completed Tasks & Features',
            tasks.length === 0 ? '_No closed tasks recorded for this milestone._' : tasks.map(t => `- **[${t.prefix_key}]** ${t.name}`).join('\n'),
            '',
            '## 🐛 Resolved Issues & Bug Fixes',
            issues.length === 0 ? '_No resolved issues recorded for this milestone._' : issues.map(i => `- **[${i.prefix_key}]** (${i.severity.toUpperCase()}) ${i.title}`).join('\n'),
            '',
            `_Generated automatically by Zoho Alternative Release Notes Engine on ${new Date().toISOString().split('T')[0]}_`
        ];

        return {
            phaseId,
            phaseName: phase.name,
            totalCompletedTasks: tasks.length,
            totalResolvedIssues: issues.length,
            markdown: mdLines.join('\n'),
            tasks,
            issues
        };
    }
}

module.exports = PhasesService;
