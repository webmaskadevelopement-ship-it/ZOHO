const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class ReminderScheduler {
    static createReminder(portalId, { taskId, recipientId, triggerType = 'before_due', remindAt, offsetMinutes = 120 }) {
        if (!taskId || !recipientId) throw new Error('taskId and recipientId are required.');
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO task_reminders (id, portal_id, task_id, recipient_id, trigger_type, remind_at, offset_minutes, is_sent, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [id, portalId, taskId, recipientId, triggerType, remindAt || now, offsetMinutes, now]
        );
        return db.queryOne('SELECT * FROM task_reminders WHERE id = ?', [id]);
    }

    /**
     * Scans pending reminders and dispatches notifications
     */
    static processPendingReminders() {
        const now = new Date().toISOString();
        const pending = db.queryAll(
            `SELECT tr.*, t.name as task_name, t.prefix_key, t.end_date, u.name as user_name
             FROM task_reminders tr
             JOIN tasks t ON tr.task_id = t.id
             JOIN users u ON tr.recipient_id = u.id
             WHERE tr.is_sent = 0 AND tr.remind_at <= ?`,
            [now]
        );

        let dispatchedCount = 0;
        pending.forEach(rem => {
            const notifId = uuidv4();
            db.execute(
                `INSERT INTO notifications (id, portal_id, recipient_id, type, title, message, link_url, is_read, created_at)
                 VALUES (?, ?, ?, 'task_reminder', ?, ?, ?, 0, ?)`,
                [
                    notifId,
                    rem.portal_id,
                    rem.recipient_id,
                    `Task Reminder: ${rem.prefix_key}`,
                    `Upcoming task '${rem.task_name}' is scheduled for completion on ${rem.end_date || 'target date'}.`,
                    `/tasks/${rem.task_id}`,
                    now
                ]
            );
            db.execute('UPDATE task_reminders SET is_sent = 1 WHERE id = ?', [rem.id]);
            dispatchedCount++;
        });

        return { pendingChecked: pending.length, remindersDispatched: dispatchedCount };
    }
}

module.exports = ReminderScheduler;
