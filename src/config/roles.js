const ADMIN_EMAILS = new Set([
    'webmaskadevelopement@gmail.com',
    ...(process.env.INITIAL_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
]);

const MANAGER_EMAILS = new Set([
    'backend.webmaska@gmail.com',
    ...(process.env.INITIAL_MANAGER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
]);

function normalizeRole(roleInput) {
    if (!roleInput) return 'member';
    const r = String(roleInput).toLowerCase().trim();
    if (r === 'admin' || r === 'administrator') return 'admin';
    if (r === 'manager' || r === 'pm' || r === 'project manager') return 'manager';
    if (r === 'client' || r === 'stakeholder') return 'client';
    if (r === 'member' || r === 'employee' || r === 'lead' || r === 'developer' || r === 'qa') return 'member';
    return 'member';
}

function resolveAuthorizedRole(email, existingDbRole = null) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    if (ADMIN_EMAILS.has(normalized)) return 'admin';
    if (MANAGER_EMAILS.has(normalized)) return 'manager';
    if (existingDbRole) {
        const normExisting = normalizeRole(existingDbRole);
        if (['admin', 'manager', 'member', 'client'].includes(normExisting)) {
            return normExisting;
        }
    }
    // Any other valid Google-authenticated user defaults to 'member'
    return 'member';
}

module.exports = {
    ADMIN_EMAILS,
    MANAGER_EMAILS,
    normalizeRole,
    resolveAuthorizedRole
};
