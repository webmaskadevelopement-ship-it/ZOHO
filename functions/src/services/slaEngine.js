/**
 * SLA Escalation Engine (Firebase Cloud Functions)
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
}

module.exports = SlaEngine;
