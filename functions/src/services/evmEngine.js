/**
 * Earned Value Management (EVM) Financial Engine (Firebase Cloud Functions)
 */

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

class EvmEngine {
    static calculateMetrics({
        startDate,
        endDate,
        plannedBudget = 0,
        completionPercentage = 0,
        actualCost = 0,
        asOfDate = new Date()
    }) {
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        const asOf = typeof asOfDate === 'string' ? parseDate(asOfDate) : asOfDate;

        const totalDurationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        let elapsedDays = Math.round((asOf.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        elapsedDays = Math.max(0, Math.min(elapsedDays, totalDurationDays));

        const scheduledProgressRatio = totalDurationDays > 0 ? (elapsedDays / totalDurationDays) : 1;
        const plannedValue = Math.round(plannedBudget * scheduledProgressRatio * 100) / 100;
        const earnedValue = Math.round(plannedBudget * (Math.min(100, Math.max(0, completionPercentage)) / 100) * 100) / 100;
        const ac = Math.round(actualCost * 100) / 100;

        const costVariance = Math.round((earnedValue - ac) * 100) / 100;
        const scheduleVariance = Math.round((earnedValue - plannedValue) * 100) / 100;

        const cpi = ac > 0 ? Math.round((earnedValue / ac) * 1000) / 1000 : 1.0;
        const spi = plannedValue > 0 ? Math.round((earnedValue / plannedValue) * 1000) / 1000 : 1.0;

        const eac = cpi > 0 ? Math.round((plannedBudget / cpi) * 100) / 100 : plannedBudget;
        const etc = Math.max(0, Math.round((eac - ac) * 100) / 100);
        const vac = Math.round((plannedBudget - eac) * 100) / 100;

        let healthScore = 'on_track';
        if (cpi < 0.8 || spi < 0.8) {
            healthScore = 'delayed';
        } else if (cpi < 0.95 || spi < 0.95) {
            healthScore = 'at_risk';
        }

        return {
            plannedBudget,
            plannedValue,
            earnedValue,
            actualCost: ac,
            costVariance,
            scheduleVariance,
            cpi,
            spi,
            estimateAtCompletion: eac,
            estimateToComplete: etc,
            varianceAtCompletion: vac,
            healthScore,
            isOverBudget: costVariance < 0,
            isBehindSchedule: scheduleVariance < 0
        };
    }
}

module.exports = EvmEngine;
