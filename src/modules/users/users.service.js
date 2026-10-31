const db = require('../../db/database');
const { FirebaseFirestoreService } = require('../../services/firebaseFirestoreService');

class UsersService {
    /**
     * Get workspace user directory with connection statuses relative to current user
     */
    static getDirectory(currentUserId, portalId) {
        const users = db.queryAll(
            `SELECT id, name, username, email, role, department, avatar_url, bio, phone, status, created_at
             FROM users
             WHERE status = 'active'
             ORDER BY name ASC`
        );

        // Fetch all connections for current user
        const connections = new Set(
            db.queryAll(
                'SELECT connected_user_id FROM user_connections WHERE user_id = ?',
                [currentUserId]
            ).map(r => r.connected_user_id)
        );

        // Fetch all pending requests involving current user
        const sentPending = new Set(
            db.queryAll(
                `SELECT receiver_id FROM in_app_requests
                 WHERE sender_id = ? AND status = 'PENDING' AND request_type = 'USER_CONNECTION'`,
                [currentUserId]
            ).map(r => r.receiver_id)
        );

        const receivedPending = new Set(
            db.queryAll(
                `SELECT sender_id FROM in_app_requests
                 WHERE receiver_id = ? AND status = 'PENDING' AND request_type = 'USER_CONNECTION'`,
                [currentUserId]
            ).map(r => r.sender_id)
        );

        return users.map(u => {
            let connectionStatus = 'NONE';
            if (u.id === currentUserId) {
                connectionStatus = 'SELF';
            } else if (connections.has(u.id)) {
                connectionStatus = 'CONNECTED';
            } else if (sentPending.has(u.id)) {
                connectionStatus = 'PENDING_SENT';
            } else if (receivedPending.has(u.id)) {
                connectionStatus = 'PENDING_RECEIVED';
            }

            return {
                id: u.id,
                name: u.name,
                username: u.username || u.email.split('@')[0],
                email: u.email,
                role: u.role,
                department: u.department || 'Engineering',
                avatar_url: u.avatar_url,
                bio: u.bio,
                phone: u.phone,
                connection_status: connectionStatus
            };
        });
    }

    /**
     * Get single user profile by ID with connection info
     */
    static getUserById(targetUserId, currentUserId) {
        const user = db.queryOne(
            `SELECT id, name, username, email, role, department, avatar_url, bio, phone, created_at
             FROM users WHERE id = ?`,
            [targetUserId]
        );
        if (!user) throw new Error('User not found.');

        const isConnected = !!db.queryOne(
            'SELECT 1 FROM user_connections WHERE user_id = ? AND connected_user_id = ?',
            [currentUserId, targetUserId]
        );

        return {
            ...user,
            is_connected: isConnected
        };
    }

    /**
     * Admin role & billing rate update (Page 8 & 9)
     */
    static async updateUserRoleAndBilling(targetUserId, { role, department, costPerHour, billableRatePerHour }) {
        const user = db.queryOne('SELECT * FROM users WHERE id = ?', [targetUserId]);
        if (!user) throw new Error('User not found.');

        const now = new Date().toISOString();
        db.execute(
            `UPDATE users
             SET role = COALESCE(?, role),
                 department = COALESCE(?, department),
                 cost_per_hour = COALESCE(?, cost_per_hour),
                 billable_rate_per_hour = COALESCE(?, billable_rate_per_hour),
                 updated_at = ?
             WHERE id = ?`,
            [
                role ?? null,
                department ?? null,
                costPerHour ?? null,
                billableRatePerHour ?? null,
                now,
                targetUserId
            ]
        );

        const updated = db.queryOne('SELECT * FROM users WHERE id = ?', [targetUserId]);

        // Dual-sync to Firestore
        try {
            await FirebaseFirestoreService.syncUser(updated);
        } catch (fsErr) {
            console.warn('[Users Service] Firestore sync notice on role update:', fsErr.message);
        }

        return {
            id: updated.id,
            name: updated.name,
            username: updated.username,
            email: updated.email,
            role: updated.role,
            department: updated.department,
            cost_per_hour: updated.cost_per_hour,
            billable_rate_per_hour: updated.billable_rate_per_hour,
            updated_at: updated.updated_at
        };
    }
}

module.exports = UsersService;
