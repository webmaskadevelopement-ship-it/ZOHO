const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');
const { resolveAuthorizedRole } = require('../config/roles');

async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.headers['x-api-key']) {
        // Personal Access Token (PAT)
        token = req.headers['x-api-key'];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }

    // 1. Try local session JWT verification
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const user = db.queryOne(
            'SELECT id, email, name, role, cost_per_hour, billable_rate_per_hour, department, client_company_id, status FROM users WHERE id = ?',
            [decoded.userId || decoded.id]
        );

        if (user && user.status === 'active') {
            // Ensure canonical role is applied
            const canonicalRole = resolveAuthorizedRole(user.email, user.role);
            if (user.role !== canonicalRole) {
                db.execute('UPDATE users SET role = ? WHERE id = ?', [canonicalRole, user.id]);
                user.role = canonicalRole;
            }
            req.user = user;
            return next();
        }
    } catch (err) {
        // Fall through to Firebase ID token verification
    }

    // 2. Try Firebase ID Token verification
    try {
        const FirebaseAuthService = require('../services/firebaseAuthService');
        const fbResult = await FirebaseAuthService.verifyFirebaseToken(token);
        if (fbResult && fbResult.user) {
            const user = db.queryOne(
                'SELECT id, email, name, role, cost_per_hour, billable_rate_per_hour, department, client_company_id, status FROM users WHERE id = ?',
                [fbResult.user.id]
            ) || fbResult.user;

            req.user = user;
            return next();
        }
    } catch (fbErr) {
        // Token is invalid
    }

    // 3. Try Personal Access Token (PAT) match in database
    try {
        const pat = db.queryOne(
            'SELECT user_id FROM personal_access_tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)',
            [token, new Date().toISOString()]
        );
        if (pat) {
            const user = db.queryOne(
                'SELECT id, email, name, role, cost_per_hour, billable_rate_per_hour, department, client_company_id, status FROM users WHERE id = ?',
                [pat.user_id]
            );
            if (user && user.status === 'active') {
                req.user = user;
                return next();
            }
        }
    } catch (patErr) {}

    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
}

async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            const user = db.queryOne('SELECT id, email, name, role FROM users WHERE id = ?', [decoded.userId || decoded.id]);
            if (user) {
                req.user = user;
                return next();
            }
        } catch {
            try {
                const FirebaseAuthService = require('../services/firebaseAuthService');
                const fbResult = await FirebaseAuthService.verifyFirebaseToken(token);
                if (fbResult && fbResult.user) {
                    req.user = fbResult.user;
                }
            } catch {}
        }
    }
    next();
}

module.exports = {
    authenticate,
    optionalAuth
};
