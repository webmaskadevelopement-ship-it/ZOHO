const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class SlaEscalationWorker {
    /**
     * Checks open issues against SLA resolution targets and logs breaches
     */
    static checkSlaBreaches() {
        const now = new Date().toISOString();

        // Issues that have an SLA target in the past and are not closed and not marked breached yet
        const breachedIssues = db.queryAll(
            `SELECT * FROM issues
             WHERE is_closed = 0
               AND sla_breached = 0
               AND sla_resolution_target_date IS NOT NULL
               AND sla_resolution_target_date < ?`,
            [now]
        );

        let escalatedCount = 0;

        breachedIssues.forEach(iss => {
            const breachLogId = uuidv4();
            db.execute(
                `INSERT INTO sla_breach_logs (id, portal_id, issue_id, breach_type, breached_at, details)
                 VALUES (?, ?, ?, 'resolution', ?, ?)`,
                [
                    breachLogId,
                    iss.portal_id,
                    iss.id,
                    now,
                    JSON.stringify({ severity: iss.severity, targetDate: iss.sla_resolution_target_date })
                ]
            );

            // Mark issue as breached
            db.execute('UPDATE issues SET sla_breached = 1, updated_at = ? WHERE id = ?', [now, iss.id]);

            // Notify reporter / admins of breach
            const notifId = uuidv4();
            db.execute(
                `INSERT INTO notifications (id, portal_id, recipient_id, type, title, message, link_url, is_read, created_at)
                 VALUES (?, ?, ?, 'sla_breach', ?, ?, ?, 0, ?)`,
                [
                    notifId,
                    iss.portal_id,
                    iss.reporter_id,
                    `SLA BREACH ALERT: ${iss.prefix_key}`,
                    `Issue '${iss.title}' has breached its ${iss.severity} SLA resolution target!`,
                    `/issues/${iss.id}`,
                    now
                ]
            );

            escalatedCount++;
        });

        return { breachedIssuesChecked: breachedIssues.length, escalationsTriggered: escalatedCount };
    }
}

module.exports = SlaEscalationWorker;
