const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/database');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.headers['x-api-key']) {
        // Personal Access Token (PAT)
        const apiKey = req.headers['x-api-key'];
        // Look up user by PAT if stored, or fallback to token
        token = apiKey;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        const user = db.queryOne(
            'SELECT id, email, name, role, cost_per_hour, billable_rate_per_hour, department, client_company_id, status FROM users WHERE id = ?',
            [decoded.userId || decoded.id]
        );

        if (!user || user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'User account is inactive or not found.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            const user = db.queryOne('SELECT id, email, name, role FROM users WHERE id = ?', [decoded.userId || decoded.id]);
            if (user) req.user = user;
        } catch {
            // ignore
        }
    }
    next();
}

module.exports = {
    authenticate,
    optionalAuth
};
