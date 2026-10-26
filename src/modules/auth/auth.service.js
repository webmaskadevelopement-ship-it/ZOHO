const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const config = require('../../config');

class AuthService {
    static async register({ email, password, name, role, department = '', clientCompanyId = null }) {
        const VALID_ROLES = ['admin', 'manager', 'employee', 'client'];
        if (!role || !VALID_ROLES.includes(role)) {
            throw new Error(`Role must be specified and must be one of: ${VALID_ROLES.join(', ')}.`);
        }

        const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (existing) {
            throw new Error('User with this email already exists.');
        }

        const id = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO users (id, email, password_hash, name, role, department, client_company_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, email.toLowerCase().trim(), passwordHash, name, role, department, clientCompanyId, now, now]
        );

        const user = db.queryOne(
            'SELECT id, email, name, role, department, client_company_id, status FROM users WHERE id = ?',
            [id]
        );

        const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.jwtSecret, {
            expiresIn: config.jwtExpiresIn
        });

        return { user, token };
    }

    static async login({ email, password }) {
        const user = db.queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (!user) {
            throw new Error('Invalid email or password.');
        }

        if (user.status !== 'active') {
            throw new Error('User account is suspended or inactive.');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            throw new Error('Invalid email or password.');
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        // Fetch portals user belongs to
        const portals = db.queryAll(
            `SELECT p.id, p.name, p.slug, pm.role as portalRole
             FROM portal_members pm
             JOIN portals p ON pm.portal_id = p.id
             WHERE pm.user_id = ? AND pm.status = 'active'`,
            [user.id]
        );

        const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            department: user.department,
            avatar_url: user.avatar_url,
            cost_per_hour: user.cost_per_hour,
            billable_rate_per_hour: user.billable_rate_per_hour,
            client_company_id: user.client_company_id
        };

        return { user: safeUser, token, portals };
    }

    static getProfile(userId) {
        const user = db.queryOne(
            'SELECT id, email, name, role, department, avatar_url, cost_per_hour, billable_rate_per_hour, client_company_id, status, created_at FROM users WHERE id = ?',
            [userId]
        );
        if (!user) throw new Error('User not found.');

        const portals = db.queryAll(
            `SELECT p.id, p.name, p.slug, pm.role as portalRole
             FROM portal_members pm
             JOIN portals p ON pm.portal_id = p.id
             WHERE pm.user_id = ? AND pm.status = 'active'`,
            [userId]
        );

        return { user, portals };
    }

    static async updateProfile(userId, { name, department, avatarUrl, costPerHour, billableRatePerHour }) {
        const now = new Date().toISOString();
        db.execute(
            `UPDATE users
             SET name = COALESCE(?, name),
                 department = COALESCE(?, department),
                 avatar_url = COALESCE(?, avatar_url),
                 cost_per_hour = COALESCE(?, cost_per_hour),
                 billable_rate_per_hour = COALESCE(?, billable_rate_per_hour),
                 updated_at = ?
             WHERE id = ?`,
            [name, department, avatarUrl, costPerHour, billableRatePerHour, now, userId]
        );

        return this.getProfile(userId);
    }

    /**
     * PDF Feature 140 & Ticket ZP-059: Personal Access Tokens (PATs) for Public REST API
     */
    static createPersonalAccessToken(userId, { name = 'Default API Token', scopes = ['read', 'write'], expiresDays = 90 }) {
        const id = uuidv4();
        const rawToken = `zpa_pat_${require('crypto').randomBytes(32).toString('hex')}`;
        const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000).toISOString();

        db.execute(
            `INSERT INTO personal_access_tokens (id, user_id, name, token_hash, scopes, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, userId, name, tokenHash, JSON.stringify(scopes), expiresAt, now.toISOString()]
        );

        return {
            id,
            name,
            scopes,
            token: rawToken, // Only returned on creation
            expiresAt,
            createdAt: now.toISOString()
        };
    }

    static getPersonalAccessTokens(userId) {
        const rows = db.queryAll(
            'SELECT id, user_id, name, scopes, last_used_at, expires_at, created_at FROM personal_access_tokens WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return rows.map(r => ({
            ...r,
            scopes: typeof r.scopes === 'string' ? JSON.parse(r.scopes || '[]') : r.scopes
        }));
    }

    static revokePersonalAccessToken(userId, tokenId) {
        db.execute('DELETE FROM personal_access_tokens WHERE id = ? AND user_id = ?', [tokenId, userId]);
        return { success: true, message: 'Personal access token revoked.' };
    }

    /**
     * PDF Feature 3: Active Device Sessions & Revocation
     */
    static getActiveSessions(userId) {
        return db.queryAll('SELECT * FROM active_sessions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }

    static revokeSession(userId, sessionId) {
        db.execute('DELETE FROM active_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        return { success: true, message: 'Session revoked.' };
    }
}

module.exports = AuthService;
