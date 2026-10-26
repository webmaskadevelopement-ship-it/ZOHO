const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const WbsRollupEngine = require('../../engines/wbsRollupEngine');

class TimesheetsService {
    // 1. Live Stopwatch Timer
    static startTimer(portalId, userId, { projectId, taskId = null, issueId = null, description = '' }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        // Check if user already has an active timer
        const existing = db.queryOne('SELECT * FROM active_timers WHERE user_id = ?', [userId]);
        if (existing) {
            // Stop existing timer and convert to time log
            this.stopTimer(portalId, userId);
        }

        db.execute(
            `INSERT INTO active_timers (id, portal_id, user_id, project_id, task_id, issue_id, started_at, is_running, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [id, portalId, userId, projectId, taskId, issueId, now, description]
        );

        return db.queryOne('SELECT * FROM active_timers WHERE id = ?', [id]);
    }

    static getActiveTimer(userId) {
        return db.queryOne('SELECT * FROM active_timers WHERE user_id = ? AND is_running = 1', [userId]) || null;
    }

    static stopTimer(portalId, userId, workNotes = '') {
        const timer = db.queryOne('SELECT * FROM active_timers WHERE user_id = ?', [userId]);
        if (!timer) return null;

        const startTime = new Date(timer.started_at);
        const endTime = new Date();
        const elapsedMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)));
        const hours = Math.floor(elapsedMinutes / 60);
        const minutes = elapsedMinutes % 60;
        const logDate = endTime.toISOString().split('T')[0];

        // Delete active timer
        db.execute('DELETE FROM active_timers WHERE id = ?', [timer.id]);

        // Create time log
        return this.createTimeLog(portalId, {
            projectId: timer.project_id,
            taskId: timer.task_id,
            issueId: timer.issue_id,
            userId,
            logDate,
            hours,
            minutes,
            isBillable: 1,
            workNotes: workNotes || timer.description || 'Logged via Live Stopwatch Timer'
        });
    }

    // 2. Manual Time Logs
    static getTimeLogs(portalId, filters = {}) {
        let sql = `
            SELECT tl.*, u.name as user_name, u.email as user_email,
                   p.name as project_name, t.name as task_name, t.prefix_key as task_key,
                   i.title as issue_title, i.prefix_key as issue_key
            FROM time_logs tl
            JOIN users u ON tl.user_id = u.id
            JOIN projects p ON tl.project_id = p.id
            LEFT JOIN tasks t ON tl.task_id = t.id
            LEFT JOIN issues i ON tl.issue_id = i.id
            WHERE tl.portal_id = ?
        `;
        const params = [portalId];

        if (filters.projectId) {
            sql += ' AND tl.project_id = ?';
            params.push(filters.projectId);
        }

        if (filters.userId) {
            sql += ' AND tl.user_id = ?';
            params.push(filters.userId);
        }

        if (filters.startDate && filters.endDate) {
            sql += ' AND tl.log_date >= ? AND tl.log_date <= ?';
            params.push(filters.startDate, filters.endDate);
        }

        if (filters.status) {
            sql += ' AND tl.status = ?';
            params.push(filters.status);
        }

        sql += ' ORDER BY tl.log_date DESC, tl.created_at DESC';
        return db.queryAll(sql, params);
    }

    static createTimeLog(portalId, {
        projectId,
        taskId = null,
        issueId = null,
        userId,
        logDate,
        hours,
        minutes = 0,
        isBillable = 1,
        workNotes = ''
    }) {
        const today = new Date().toISOString().split('T')[0];
        if (logDate > today) {
            throw new Error('Future-date time logging is not permitted.');
        }

        const totalHours = Number(hours) + (Number(minutes) / 60);
        if (totalHours <= 0 || totalHours > 24) {
            throw new Error('Logged time must be between 0 and 24 hours per entry.');
        }

        // Daily cap verification
        const existingLogs = db.queryAll(
            'SELECT hours, minutes FROM time_logs WHERE portal_id = ? AND user_id = ? AND log_date = ?',
            [portalId, userId, logDate]
        );
        let dailyMinutes = totalHours * 60;
        existingLogs.forEach(l => { dailyMinutes += (l.hours * 60) + l.minutes; });
        if (dailyMinutes > 24 * 60) {
            throw new Error('Total logged time for this date exceeds 24 hours.');
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO time_logs (
                id, portal_id, project_id, task_id, issue_id, user_id,
                log_date, hours, minutes, is_billable, work_notes, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [
                id, portalId, projectId, taskId, issueId, userId,
                logDate, Number(hours), Number(minutes), isBillable ? 1 : 0, workNotes, now
            ]
        );

        return db.queryOne('SELECT * FROM time_logs WHERE id = ?', [id]);
    }

    // 3. Approval Workflow
    static submitTimesheets(portalId, userId, { timeLogIds = [] }) {
        if (!timeLogIds.length) throw new Error('No time logs provided to submit.');

        const placeholders = timeLogIds.map(() => '?').join(',');
        db.execute(
            `UPDATE time_logs SET status = 'submitted' WHERE portal_id = ? AND user_id = ? AND id IN (${placeholders})`,
            [portalId, userId, ...timeLogIds]
        );

        return { success: true, submittedCount: timeLogIds.length };
    }

    static reviewTimeLog(portalId, timeLogId, reviewerUserId, { status, comment = '' }) {
        if (!['approved', 'rejected'].includes(status)) {
            throw new Error('Status must be "approved" or "rejected".');
        }

        const log = db.queryOne('SELECT * FROM time_logs WHERE id = ? AND portal_id = ?', [timeLogId, portalId]);
        if (!log) throw new Error('Time log not found.');

        db.execute(
            'UPDATE time_logs SET status = ?, approved_by = ?, approval_comment = ? WHERE id = ?',
            [status, reviewerUserId, comment, timeLogId]
        );

        if (status === 'approved') {
            WbsRollupEngine.rollupProject(db, log.project_id);
        }

        return db.queryOne('SELECT * FROM time_logs WHERE id = ?', [timeLogId]);
    }

    // 4. Weekly Grid aggregation
    static getWeeklyGrid(portalId, userId, weekStartDate) {
        const start = new Date(weekStartDate);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            days.push(d.toISOString().split('T')[0]);
        }

        const logs = db.queryAll(
            `SELECT tl.*, t.name as task_name, t.prefix_key as task_key, p.name as project_name
             FROM time_logs tl
             JOIN projects p ON tl.project_id = p.id
             LEFT JOIN tasks t ON tl.task_id = t.id
             WHERE tl.portal_id = ? AND tl.user_id = ? AND tl.log_date >= ? AND tl.log_date <= ?`,
            [portalId, userId, days[0], days[6]]
        );

        return {
            weekDays: days,
            logs
        };
    }
}

module.exports = TimesheetsService;
