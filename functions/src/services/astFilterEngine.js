/**
 * AST Boolean Pattern Engine (Firebase Cloud Functions)
 */

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

class AstFilterEngine {
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

        return {
            today: todayStr,
            yesterday: yesterdayStr,
            tomorrow: tomorrowStr,
            next_7_days_start: todayStr,
            next_7_days_end: next7DaysStr
        };
    }

    static evaluateCriterion(item, criterion, currentUserId = null) {
        let fieldVal;
        const field = criterion.field;

        if (field in item) {
            fieldVal = item[field];
        } else if (item.customFields) {
            fieldVal = item.customFields[field];
        }

        let targetVal = criterion.value;
        if (targetVal === 'current_login_user' && currentUserId) {
            targetVal = currentUserId;
        }

        const op = criterion.operator || 'equals';
        const now = new Date();
        const macros = this.resolveDateMacro('all', now);

        if (targetVal === 'today') {
            return fieldVal === macros.today;
        } else if (targetVal === 'overdue') {
            return fieldVal && fieldVal < macros.today && !item.isCompleted;
        }

        switch (op) {
            case 'equals':
                return String(fieldVal).toLowerCase() === String(targetVal).toLowerCase();
            case 'not_equals':
                return String(fieldVal).toLowerCase() !== String(targetVal).toLowerCase();
            case 'contains':
                return String(fieldVal || '').toLowerCase().includes(String(targetVal).toLowerCase());
            case 'in':
                return Array.isArray(targetVal) ? targetVal.map(String).includes(String(fieldVal)) : false;
            case 'greater_than':
                return Number(fieldVal) > Number(targetVal) || fieldVal > targetVal;
            case 'less_than':
                return Number(fieldVal) < Number(targetVal) || fieldVal < targetVal;
            default:
                return false;
        }
    }

    static evaluateBooleanPattern(pattern, criteriaMap) {
        if (!pattern || pattern.trim() === '') {
            return Object.values(criteriaMap).every(Boolean);
        }

        let expr = pattern.toUpperCase();
        for (const [key, val] of Object.entries(criteriaMap)) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            expr = expr.replace(regex, val ? ' true ' : ' false ');
        }

        expr = expr.replace(/\bAND\b/g, '&&').replace(/\bOR\b/g, '||').replace(/\bNOT\b/g, '!');
        const sanitized = expr.replace(/\s+/g, '');
        if (!/^(true|false|&&|\|\||!|\(|\))+$/.test(sanitized)) {
            return Object.values(criteriaMap).every(Boolean);
        }

        try {
            return Boolean(new Function(`return (${expr});`)());
        } catch {
            return false;
        }
    }

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
