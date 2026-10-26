const db = require('../db/database');

function portalScope(req, res, next) {
    let portalId = req.headers['x-portal-id'] || req.query.portalId || req.params.portalId;

    if (!portalId && req.params.portalSlug) {
        const portal = db.queryOne('SELECT id FROM portals WHERE slug = ?', [req.params.portalSlug]);
        if (portal) portalId = portal.id;
    }

    if (!portalId) {
        // Fallback: check first portal user belongs to
        if (req.user) {
            const member = db.queryOne(
                "SELECT portal_id, role FROM portal_members WHERE user_id = ? AND status = 'active' LIMIT 1",
                [req.user.id]
            );
            if (member) portalId = member.portal_id;
        }
    }

    if (!portalId) {
        return res.status(400).json({ success: false, error: 'Portal scope required. Specify x-portal-id header or portalId param.' });
    }

    const portal = db.queryOne('SELECT * FROM portals WHERE id = ?', [portalId]);
    if (!portal) {
        return res.status(404).json({ success: false, error: 'Portal not found.' });
    }

    // Verify membership if authenticated
    if (req.user && req.user.role !== 'admin') {
        const membership = db.queryOne(
            "SELECT * FROM portal_members WHERE portal_id = ? AND user_id = ? AND status = 'active'",
            [portalId, req.user.id]
        );
        if (!membership) {
            return res.status(403).json({ success: false, error: 'User is not a member of this portal.' });
        }
        req.portalMember = membership;
    }

    req.portal = portal;
    req.portalId = portal.id;
    next();
}

module.exports = portalScope;
