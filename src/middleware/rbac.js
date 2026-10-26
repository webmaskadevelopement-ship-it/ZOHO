/**
 * Role-Based Access Control (RBAC) Middleware
 * Hierarchy: admin > manager > employee > contractor > client
 */

const ROLE_RANKS = {
    admin: 100,
    manager: 80,
    employee: 50,
    contractor: 30,
    client: 10
};

function requireRole(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }

        // Global admin has access to everything
        if (req.user.role === 'admin') {
            return next();
        }

        // Check portal-specific role first if scoped, else user role
        const activeRole = req.portalMember?.role || req.user.role;

        if (allowedRoles.includes(activeRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${activeRole}`
        });
    };
}

function requireMinRank(minRole) {
    const requiredRank = ROLE_RANKS[minRole] || 0;
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }

        const activeRole = req.portalMember?.role || req.user.role;
        const currentRank = ROLE_RANKS[activeRole] || 0;

        if (currentRank >= requiredRank) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Requires at least ${minRole} rank.`
        });
    };
}

module.exports = {
    requireRole,
    requireMinRank,
    ROLE_RANKS
};
