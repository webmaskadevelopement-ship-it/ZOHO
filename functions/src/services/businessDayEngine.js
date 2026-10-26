/**
 * Business Day & Calendar Engine (Firebase Cloud Functions)
 */

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

class BusinessDayEngine {
    static isBusinessDay(date, businessHours = null, holidays = []) {
        const d = typeof date === 'string' ? parseDate(date) : date;
        const dayOfWeek = d.getDay();

        const workingDays = businessHours?.workingDays || [1, 2, 3, 4, 5];
        if (!workingDays.includes(dayOfWeek)) {
            return false;
        }

        const dateStr = formatDate(d);
        const isHoliday = holidays.some(h => {
            const hDate = typeof h === 'string' ? h : h.date;
            return hDate === dateStr;
        });

        return !isHoliday;
    }

    static addBusinessDays(startDate, days, businessHours = null, holidays = []) {
        let current = typeof startDate === 'string' ? parseDate(startDate) : new Date(startDate.getTime());
        let daysToAdd = Math.max(0, Math.floor(days));

        while (!this.isBusinessDay(current, businessHours, holidays)) {
            current.setDate(current.getDate() + 1);
        }

        while (daysToAdd > 0) {
            current.setDate(current.getDate() + 1);
            if (this.isBusinessDay(current, businessHours, holidays)) {
                daysToAdd--;
            }
        }

        return formatDate(current);
    }
}

module.exports = BusinessDayEngine;
