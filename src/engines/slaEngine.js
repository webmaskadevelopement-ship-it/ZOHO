/**
 * SLA (Service Level Agreement) Escalation Engine
 * Calculates SLA response/resolution targets by severity, evaluates breaches,
 * and computes MTTD/MTTR quality metrics.
 */

class SlaEngine {
    static getSlaTargets(severity = 'major', baseDate = new Date()) {
        const start = new Date(baseDate.getTime());
        let responseHours = 8;
        let resolutionHours = 24;

        switch (severity.toLowerCase()) {
            case 'blocker':
                responseHours = 1;
                resolutionHours = 4;
                break;
            case 'critical':
                responseHours = 2;
                resolutionHours = 8;
                break;
            case 'major':
                responseHours = 8;
                resolutionHours = 24;
                break;
            case 'minor':
                responseHours = 24;
                resolutionHours = 72;
                break;
        }

        const responseTarget = new Date(start.getTime() + responseHours * 60 * 60 * 1000);
        const resolutionTarget = new Date(start.getTime() + resolutionHours * 60 * 60 * 1000);

        return {
            slaResponseTargetDate: responseTarget.toISOString(),
            slaResolutionTargetDate: resolutionTarget.toISOString(),
            responseHours,
            resolutionHours
        };
    }

    /**
     * Checks if an issue has breached its SLA
     */
    static checkBreach(issue, now = new Date()) {
        if (issue.is_closed) return 0;
        if (!issue.sla_resolution_target_date) return 0;

        const target = new Date(issue.sla_resolution_target_date);
        return now > target ? 1 : 0;
    }

    /**
     * Computes Mean Time To Resolve (MTTR) in hours
     */
    static calculateMttr(closedIssues) {
        if (!closedIssues || closedIssues.length === 0) return 0;

        let totalHours = 0;
        let counted = 0;

        for (const issue of closedIssues) {
            if (issue.created_at && issue.updated_at) {
                const created = new Date(issue.created_at);
                const closed = new Date(issue.updated_at);
                const diffHours = (closed.getTime() - created.getTime()) / (1000 * 60 * 60);
                if (diffHours >= 0) {
                    totalHours += diffHours;
                    counted++;
                }
            }
        }

        return counted > 0 ? Math.round((totalHours / counted) * 10) / 10 : 0;
    }
}

module.exports = SlaEngine;
