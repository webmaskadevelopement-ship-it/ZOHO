/**
 * AST Filter Compiler & Boolean Pattern Query Engine
 * Parses patterns like "(1 AND 2) OR 3" with relative date macros and operators.
 */

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

class AstFilterEngine {
    /**
     * Resolves relative date macros into concrete dates or date ranges
     */
    static resolveDateMacro(macro, now = new Date()) {
        const todayStr = formatDate(now);
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yesterdayStr = formatDate(y);

        const tm = new Date(now);
        tm.setDate(tm.getDate() + 1);
        const tomorrowStr = formatDate(tm);

        const n7 = new Date(now);
        n7.setDate(n7.getDate() + 7);
        const next7DaysStr = formatDate(n7);

        // This week (Monday to Sunday)
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(now.setDate(diffToMon));
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        const thisWeekStart = formatDate(mon);
        const thisWeekEnd = formatDate(sun);

        return {
            today: todayStr,
            yesterday: yesterdayStr,
            tomorrow: tomorrowStr,
            next_7_days_start: todayStr,
            next_7_days_end: next7DaysStr,
            this_week_start: thisWeekStart,
            this_week_end: thisWeekEnd
        };
    }

    /**
     * Evaluates a single criterion on an item
     */
    static evaluateCriterion(item, criterion, currentUserId = null) {
        let fieldVal;
        const field = criterion.field;

        // Check if top-level or in custom_fields
        if (field in item) {
            fieldVal = item[field];
        } else if (item.custom_fields) {
            const cf = typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields || '{}') : item.custom_fields;
            fieldVal = cf[field];
        }

        let targetVal = criterion.value;
        if (targetVal === 'current_login_user' && currentUserId) {
            targetVal = currentUserId;
        }

        const op = criterion.operator || 'equals';
        const now = new Date();
        const macros = this.resolveDateMacro('all', now);

        // Date macro handling
        if (targetVal === 'today') {
            return fieldVal === macros.today;
        } else if (targetVal === 'yesterday') {
            return fieldVal === macros.yesterday;
        } else if (targetVal === 'tomorrow') {
            return fieldVal === macros.tomorrow;
        } else if (targetVal === 'this_week') {
            return fieldVal >= macros.this_week_start && fieldVal <= macros.this_week_end;
        } else if (targetVal === 'next_7_days') {
            return fieldVal >= macros.next_7_days_start && fieldVal <= macros.next_7_days_end;
        } else if (targetVal === 'overdue') {
            return fieldVal && fieldVal < macros.today && !item.is_completed;
        } else if (targetVal === 'unscheduled') {
            return !item.start_date && !item.end_date;
        }

        switch (op) {
            case 'equals':
                return String(fieldVal).toLowerCase() === String(targetVal).toLowerCase();
            case 'not_equals':
                return String(fieldVal).toLowerCase() !== String(targetVal).toLowerCase();
            case 'contains':
                return String(fieldVal || '').toLowerCase().includes(String(targetVal).toLowerCase());
            case 'not_contains':
                return !String(fieldVal || '').toLowerCase().includes(String(targetVal).toLowerCase());
            case 'in':
                if (Array.isArray(targetVal)) {
                    return targetVal.map(String).includes(String(fieldVal));
                }
                return false;
            case 'greater_than':
                return Number(fieldVal) > Number(targetVal) || fieldVal > targetVal;
            case 'less_than':
                return Number(fieldVal) < Number(targetVal) || fieldVal < targetVal;
            case 'is_empty':
                return fieldVal === null || fieldVal === undefined || fieldVal === '';
            case 'is_not_empty':
                return fieldVal !== null && fieldVal !== undefined && fieldVal !== '';
            default:
                return false;
        }
    }

    /**
     * Safely evaluates boolean expression like "(1 AND 2) OR 3" given criteria evaluations
     */
    static evaluateBooleanPattern(pattern, criteriaMap) {
        if (!pattern || pattern.trim() === '') {
            // Default to AND of all criteria if no pattern given
            return Object.values(criteriaMap).every(Boolean);
        }

        // Replace numeric index keys with true/false string
        let expr = pattern.toUpperCase();
        for (const [key, val] of Object.entries(criteriaMap)) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            expr = expr.replace(regex, val ? ' true ' : ' false ');
        }

        // Replace AND / OR / NOT
        expr = expr.replace(/\bAND\b/g, '&&').replace(/\bOR\b/g, '||').replace(/\bNOT\b/g, '!');

        // Safe evaluation without arbitrary code execution
        // Validate characters strictly: only true, false, &&, ||, !, (, ), whitespace
        const sanitized = expr.replace(/\s+/g, '');
        if (!/^(true|false|&&|\|\||!|\(|\))+$/.test(sanitized)) {
            // Unsafe tokens, fallback to conjunction
            return Object.values(criteriaMap).every(Boolean);
        }

        try {
            // Use Function with strictly validated tokens
            return Boolean(new Function(`return (${expr});`)());
        } catch {
            return false;
        }
    }

    /**
     * Filters an array of items according to criteria and pattern
     */
    static filter(items, criteria = [], pattern = '', currentUserId = null) {
        if (!criteria || criteria.length === 0) return items;

        return items.filter(item => {
            const criteriaMap = {};
            criteria.forEach(crit => {
                const idx = crit.index || crit.id;
                criteriaMap[idx] = this.evaluateCriterion(item, crit, currentUserId);
            });

            return this.evaluateBooleanPattern(pattern, criteriaMap);
        });
    }
}

module.exports = AstFilterEngine;
