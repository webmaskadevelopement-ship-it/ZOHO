const RecurrenceWorker = require('./recurrenceWorker');
const ReminderScheduler = require('./reminderScheduler');
const SlaEscalationWorker = require('./slaEscalationWorker');

class WorkerRunner {
    static runAll() {
        const recurrenceResults = RecurrenceWorker.processRecurringTasks();
        const reminderResults = ReminderScheduler.processPendingReminders();
        const slaResults = SlaEscalationWorker.checkSlaBreaches();

        return {
            timestamp: new Date().toISOString(),
            recurrence: recurrenceResults,
            reminders: reminderResults,
            sla: slaResults
        };
    }
}

module.exports = WorkerRunner;
