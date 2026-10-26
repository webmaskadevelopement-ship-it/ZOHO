/**
 * Business Day & Calendar Engine
 * Handles working days, shift hours, regional holidays, and leave availability
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
    /**
     * Checks if a specific date is a working business day for the portal
     */
    static isBusinessDay(date, businessHours = null, holidays = []) {
        const d = typeof date === 'string' ? parseDate(date) : date;
        const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday

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

    /**
     * Adds N business days to a start date, skipping weekends and holidays
     */
    static addBusinessDays(startDate, days, businessHours = null, holidays = []) {
        let current = typeof startDate === 'string' ? parseDate(startDate) : new Date(startDate.getTime());
        let daysToAdd = Math.max(0, Math.floor(days));

        // If starting on a non-business day, advance to the next business day
        while (!this.isBusinessDay(current, businessHours, holidays)) {
            current.setDate(current.getDate() + 1);
        }

        // Add business days
        while (daysToAdd > 0) {
            current.setDate(current.getDate() + 1);
            if (this.isBusinessDay(current, businessHours, holidays)) {
                daysToAdd--;
            }
        }

        return formatDate(current);
    }

    /**
     * Computes the number of business days between two dates
     */
    static getBusinessDayDifference(startDate, endDate, businessHours = null, holidays = []) {
        let start = typeof startDate === 'string' ? parseDate(startDate) : new Date(startDate.getTime());
        const end = typeof endDate === 'string' ? parseDate(endDate) : new Date(endDate.getTime());

        if (start > end) return 0;

        let count = 0;
        let cur = new Date(start.getTime());

        while (cur <= end) {
            if (this.isBusinessDay(cur, businessHours, holidays)) {
                count++;
            }
            cur.setDate(cur.getDate() + 1);
        }

        return count;
    }

    /**
     * Checks if any assignee is on leave during task dates
     */
    static checkAssigneeAvailability(userIds, startDate, endDate, leaveRecords = []) {
        const start = formatDate(parseDate(startDate));
        const end = formatDate(parseDate(endDate));

        const conflicts = [];
        for (const userId of userIds) {
            const userLeaves = leaveRecords.filter(l => l.user_id === userId && l.status === 'approved');
            for (const leave of userLeaves) {
                if (!(end < leave.start_date || start > leave.end_date)) {
                    conflicts.push({
                        userId,
                        leaveType: leave.leave_type,
                        startDate: leave.start_date,
                        endDate: leave.end_date
                    });
                }
            }
        }
        return conflicts;
    }
}

module.exports = BusinessDayEngine;
