const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class RecurrenceWorker {
    /**
     * Checks tasks that have recurrence rules and creates next recurrence if due
     */
    static processRecurringTasks() {
        const tasks = db.queryAll(
            "SELECT * FROM tasks WHERE is_trashed = 0 AND recurrence != 'null' AND recurrence != ''"
        );

        let createdCount = 0;
        const now = new Date().toISOString();

        tasks.forEach(t => {
            try {
                const rec = typeof t.recurrence === 'string' ? JSON.parse(t.recurrence) : t.recurrence;
                if (!rec || !rec.isActive || rec.frequency === 'none') return;

                // If nextRecurrenceAfterClose is true, only spawn when completed
                if (rec.nextRecurrenceAfterClose && !t.is_completed) return;

                // Compute next date offset based on frequency
                let offsetDays = 1;
                if (rec.frequency === 'daily') offsetDays = rec.interval || 1;
                else if (rec.frequency === 'weekly') offsetDays = (rec.interval || 1) * 7;
                else if (rec.frequency === 'monthly') offsetDays = (rec.interval || 1) * 30;
                else if (rec.frequency === 'yearly') offsetDays = (rec.interval || 1) * 365;

                const baseDate = t.end_date ? new Date(t.end_date) : new Date();
                const nextEndDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                // Check if next recurrence task already spawned
                const existingNext = db.queryOne(
                    'SELECT id FROM tasks WHERE project_id = ? AND name = ? AND end_date = ?',
                    [t.project_id, t.name, nextEndDate]
                );
                if (existingNext) return;

                // Increment sequence counter
                const proj = db.queryOne('SELECT key_prefix, task_seq_counter FROM projects WHERE id = ?', [t.project_id]);
                const nextSeq = (proj.task_seq_counter || 0) + 1;
                const newPrefixKey = `${proj.key_prefix}-${nextSeq}`;
                db.execute('UPDATE projects SET task_seq_counter = ? WHERE id = ?', [nextSeq, t.project_id]);

                const newTaskId = uuidv4();
                db.execute(
                    `INSERT INTO tasks (
                        id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
                        name, description_html, flag, priority, start_date, end_date, duration,
                        owner_ids, billing_type, recurrence, is_completed, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                    [
                        newTaskId, t.portal_id, t.project_id, t.phase_id, t.task_list_id, newPrefixKey, nextSeq,
                        t.name, t.description_html, t.flag, t.priority, t.end_date || now.split('T')[0], nextEndDate, t.duration,
                        t.owner_ids, t.billing_type, t.recurrence, now, now
                    ]
                );
                createdCount++;
            } catch (e) {
                console.error(`[RecurrenceWorker Error on task ${t.id}]:`, e.message);
            }
        });

        return { processedTasks: tasks.length, newOccurrencesCreated: createdCount };
    }
}

module.exports = RecurrenceWorker;
