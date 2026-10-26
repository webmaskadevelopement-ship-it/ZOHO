/**
 * Client Visibility & Financial Cost Masking Middleware
 * Enforces internal vs. external scoping and masks sensitive financial cost rates.
 */

function enforceClientVisibility(req, res, next) {
    const isClient = (req.portalMember?.role === 'client') || (req.user?.role === 'client');
    req.isClient = isClient;

    // Helper to augment SQL query filters
    req.getVisibilityFilter = (tableAlias = '') => {
        const prefix = tableAlias ? `${tableAlias}.` : '';
        if (isClient) {
            return `AND ${prefix}flag = 'external'`;
        }
        return '';
    };

    // Store original send to mask sensitive financial fields
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object') {
            const isManagerOrAdmin = req.user?.role === 'admin' || req.portalMember?.role === 'manager' || req.portalMember?.role === 'admin';

            // If not manager or admin, mask internal cost rates
            if (!isManagerOrAdmin) {
                maskSensitiveFinancialData(body);
            }

            // If client, ensure any internal flagged entity accidentally included is filtered
            if (isClient) {
                filterInternalEntities(body);
            }
        }
        return originalJson(body);
    };

    next();
}

function maskSensitiveFinancialData(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        obj.forEach(maskSensitiveFinancialData);
        return;
    }

    // Mask sensitive fields
    if ('cost_per_hour' in obj) delete obj.cost_per_hour;
    if ('costPerHour' in obj) delete obj.costPerHour;
    if ('internalRate' in obj) delete obj.internalRate;
    if ('actualCost' in obj && !obj.isClientVisibleCost) delete obj.actualCost;

    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            maskSensitiveFinancialData(obj[key]);
        }
    }
}

function filterInternalEntities(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        for (let i = obj.length - 1; i >= 0; i--) {
            if (obj[i] && obj[i].flag === 'internal') {
                obj.splice(i, 1);
            } else {
                filterInternalEntities(obj[i]);
            }
        }
        return;
    }

    for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
            filterInternalEntities(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            filterInternalEntities(obj[key]);
        }
    }
}

module.exports = {
    enforceClientVisibility,
    maskSensitiveFinancialData,
    filterInternalEntities
};
