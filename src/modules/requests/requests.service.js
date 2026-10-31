const CentralSyncService = require('../../services/centralSyncService');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');
const { FirebaseFirestoreService } = require('../../services/firebaseFirestoreService');

class RequestsService {
    /**
     * Send a new in-app request
     */
    static async createRequest(senderUser, { receiver_id, username, email, request_type, target_entity_id = null, payload = {} }) {
        if (!request_type) {
            throw new Error('request_type is required.');
        }

        const validTypes = ['USER_CONNECTION', 'PROJECT_INVITE', 'TASK_HANDOFF', 'TEAM_INVITE', 'APPROVAL_REQUEST'];
        if (!validTypes.includes(request_type)) {
            throw new Error(`Invalid request_type. Must be one of: ${validTypes.join(', ')}`);
        }

        // 1. Resolve receiver
        let receiver = null;
        if (receiver_id) {
            receiver = db.queryOne('SELECT * FROM users WHERE id = ?', [receiver_id]);
        }
        if (!receiver && username) {
            receiver = db.queryOne('SELECT * FROM users WHERE LOWER(username) = ?', [username.toLowerCase().trim()]);
        }
        if (!receiver && email) {
            receiver = db.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [email.toLowerCase().trim()]);
        }
        if (!receiver) {
            throw new Error('Target recipient could not be found by receiver_id, username, or email.');
        }

        // Security & Access Control: Enforce strict PDF credentials whitelist
        const AUTHORIZED_PDF_IDENTIFIERS = [
            'ravi.bhadoria', 'ravi.bhadoria@zoho.com',
            'ananya.gupta', 'ananya.gupta@zoho.com',
            'ineet', 'ineet@zoho.com',
            'nikhil', 'nikhil@zoho.com',
            'ritika', 'ritika@zoho.com',
            'shweta', 'shweta@zoho.com',
            'ekta', 'ekta@zoho.com',
            'abhishek', 'abhishek@zoho.com',
            'prince', 'prince@zoho.com',
            'ali', 'ali@zoho.com',
            'admin', 'webmaskadevelopement@gmail.com',
            'manager', 'backend.webmaska@gmail.com',
            'ritika.sharma', 'ritikasharma49527@gmail.com',
            'varun', 'varunvashisth028@gmail.com',
            'webmaskafilms', 'webmaskafilms@gmail.com'
        ];
        const rUser = (receiver.username || '').toLowerCase().trim();
        const rMail = (receiver.email || '').toLowerCase().trim();
        const isAuth = AUTHORIZED_PDF_IDENTIFIERS.includes(rUser) || AUTHORIZED_PDF_IDENTIFIERS.includes(rMail);
        if (!isAuth) {
            throw new Error('Security Policy: Invitations can only be sent to authorized team members listed in the specification.');
        }

        // Prevent self-requests
        if (receiver.id === senderUser.id) {
            throw new Error('You cannot send an in-app request to yourself.');
        }

        // 2. Client Isolation Compliance (Step 4)
        // Users with the Client role cannot send or receive internal WBS task handoffs or view internal team roster requests
        // unless the target deliverable is explicitly flagged as external.
        const isClientInvolved = (senderUser.role === 'client' || receiver.role === 'client');
        if (isClientInvolved) {
            if (request_type === 'TASK_HANDOFF' && target_entity_id) {
                const task = db.queryOne('SELECT id, flag FROM tasks WHERE id = ?', [target_entity_id]);
                const isExternal = task && (task.flag === 'external');
                if (!isExternal) {
                    throw new Error('Client Isolation Policy: Clients cannot send or receive internal WBS task handoffs unless the deliverable is flagged as external.');
                }
            } else if (request_type === 'TEAM_INVITE') {
                throw new Error('Client Isolation Policy: Clients cannot participate in internal departmental team rosters.');
            }
        }

        // 3. Duplicate check for PENDING requests
        const entityId = target_entity_id ?? null;
        const existing = db.queryOne(
            `SELECT id FROM in_app_requests
             WHERE sender_id = ? AND receiver_id = ? AND request_type = ?
               AND (target_entity_id = ? OR (target_entity_id IS NULL AND ? IS NULL))
               AND status = 'PENDING'`,
            [senderUser.id, receiver.id, request_type, entityId, entityId]
        );
        if (existing) {
            throw new Error('A pending request of this type is already awaiting response from this user.');
        }

        // 4. Create request in SQLite
        const requestId = uuidv4();
        const now = new Date().toISOString();
        const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

        db.execute(
            `INSERT INTO in_app_requests (id, sender_id, receiver_id, request_type, target_entity_id, payload_json, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
            [requestId, senderUser.id, receiver.id, request_type, entityId, payloadJson, now]
        );

        const newRequest = db.queryOne('SELECT * FROM in_app_requests WHERE id = ?', [requestId]);

        // 5. Dual-sync to Zoho Firestore
        try {
            await FirebaseFirestoreService.createInAppRequest(newRequest, senderUser, receiver);
        } catch (fsErr) {
            console.warn('[Requests Service] Firestore sync notice on createRequest:', fsErr.message);
        }

        return {
            ...newRequest,
            payload: payload || {},
            receiver: {
                id: receiver.id,
                name: receiver.name,
                username: receiver.username,
                email: receiver.email
            }
        };
    }

    /**
     * Get all incoming PENDING requests for logged-in user
     */
    static getIncomingRequests(userId) {
        const rows = db.queryAll(
            `SELECT r.*,
                    u.name as sender_name,
                    u.username as sender_username,
                    u.email as sender_email,
                    u.avatar_url as sender_avatar,
                    u.role as sender_role,
                    u.department as sender_department
             FROM in_app_requests r
             JOIN users u ON r.sender_id = u.id
             WHERE r.receiver_id = ? AND r.status = 'PENDING'
             ORDER BY r.created_at DESC`,
            [userId]
        );

        return rows.map(r => ({
            ...r,
            payload: typeof r.payload_json === 'string' ? JSON.parse(r.payload_json || '{}') : r.payload_json
        }));
    }

    /**
     * Get all outgoing sent requests for logged-in user
     */
    static getSentRequests(userId) {
        const rows = db.queryAll(
            `SELECT r.*,
                    u.name as receiver_name,
                    u.username as receiver_username,
                    u.email as receiver_email,
                    u.avatar_url as receiver_avatar,
                    u.role as receiver_role
             FROM in_app_requests r
             JOIN users u ON r.receiver_id = u.id
             WHERE r.sender_id = ?
             ORDER BY r.created_at DESC`,
            [userId]
        );

        return rows.map(r => ({
            ...r,
            payload: typeof r.payload_json === 'string' ? JSON.parse(r.payload_json || '{}') : r.payload_json
        }));
    }

    /**
     * Respond to a request: ACCEPT or REJECT (Transactional Hook)
     */
    static async respondToRequest(requestId, userId, action) {
        const normalizedAction = (action || '').toUpperCase().trim();
        if (!['ACCEPT', 'REJECT'].includes(normalizedAction)) {
            throw new Error("action must be either 'ACCEPT' or 'REJECT'.");
        }

        const request = db.queryOne('SELECT * FROM in_app_requests WHERE id = ?', [requestId]);
        if (!request) {
            throw new Error('Request not found.');
        }

        // Verify receiver and status
        if (request.receiver_id !== userId) {
            throw new Error('Unauthorized: You can only respond to requests where you are the designated recipient.');
        }

        if (request.status !== 'PENDING') {
            throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
        }

        const sender = db.queryOne('SELECT * FROM users WHERE id = ?', [request.sender_id]);
        const receiver = db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
        const now = new Date().toISOString();
        let payload = {};
        try {
            payload = typeof request.payload_json === 'string' ? JSON.parse(request.payload_json || '{}') : (request.payload_json || {});
        } catch (e) {
            payload = {};
        }

        // Execute in SQLite Transaction
        db.transaction(() => {
            const nextStatus = normalizedAction === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

            db.execute(
                `UPDATE in_app_requests
                 SET status = ?, responded_at = ?
                 WHERE id = ?`,
                [nextStatus, now, requestId]
            );

            if (normalizedAction === 'ACCEPT') {
                switch (request.request_type) {
                    case 'USER_CONNECTION': {
                        // Insert symmetric rows into user_connections
                        db.execute(
                            `INSERT OR IGNORE INTO user_connections (user_id, connected_user_id, created_at)
                             VALUES (?, ?, ?)`,
                            [userId, request.sender_id, now]
                        );
                        db.execute(
                            `INSERT OR IGNORE INTO user_connections (user_id, connected_user_id, created_at)
                             VALUES (?, ?, ?)`,
                            [request.sender_id, userId, now]
                        );
                        break;
                    }

                    case 'PROJECT_INVITE': {
                        if (request.target_entity_id) {
                            const project = db.queryOne('SELECT id, member_ids, portal_id FROM projects WHERE id = ?', [request.target_entity_id]);
                            if (project) {
                                let memberIds = [];
                                try {
                                    memberIds = typeof project.member_ids === 'string' ? JSON.parse(project.member_ids || '[]') : (project.member_ids || []);
                                } catch (e) {
                                    memberIds = [];
                                }
                                if (!memberIds.includes(userId)) {
                                    memberIds.push(userId);
                                    db.execute('UPDATE projects SET member_ids = ?, updated_at = ? WHERE id = ?', [JSON.stringify(memberIds), now, project.id]);
                                }

                                // Ensure portal membership
                                const pm = db.queryOne('SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?', [project.portal_id || 'portal-demo-zoho', userId]);
                                if (!pm) {
                                    db.execute(
                                        `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                                         VALUES (?, ?, ?, ?, 'active', ?)`,
                                        [uuidv4(), project.portal_id || 'portal-demo-zoho', userId, payload.role || 'employee', now]
                                    );
                                }
                            }
                        }
                        break;
                    }

                    case 'TASK_HANDOFF': {
                        if (request.target_entity_id) {
                            db.execute(
                                `UPDATE tasks
                                 SET assignee_id = ?, owner_ids = ?, updated_at = ?
                                 WHERE id = ?`,
                                [userId, JSON.stringify([userId]), now, request.target_entity_id]
                            );
                        }
                        break;
                    }

                    case 'TEAM_INVITE': {
                        if (request.target_entity_id) {
                            const team = db.queryOne('SELECT id, member_ids FROM teams WHERE id = ?', [request.target_entity_id]);
                            if (team) {
                                let memberIds = [];
                                try {
                                    memberIds = typeof team.member_ids === 'string' ? JSON.parse(team.member_ids || '[]') : (team.member_ids || []);
                                } catch (e) {
                                    memberIds = [];
                                }
                                if (!memberIds.includes(userId)) {
                                    memberIds.push(userId);
                                    db.execute('UPDATE teams SET member_ids = ? WHERE id = ?', [JSON.stringify(memberIds), team.id]);
                                }
                            }
                        }
                        break;
                    }

                    case 'APPROVAL_REQUEST': {
                        if (request.target_entity_id) {
                            // If target is timesheet log
                            db.execute(
                                `UPDATE time_logs
                                 SET status = 'approved', approved_by = ?, updated_at = ?
                                 WHERE id = ?`,
                                [userId, now, request.target_entity_id]
                            );
                        }
                        break;
                    }
                }
            }
        });

        // Dual-sync to Firestore
        try {
            await FirebaseFirestoreService.respondToInAppRequest(requestId, normalizedAction, userId, request, sender, receiver);
        } catch (fsErr) {
            console.warn('[Requests Service] Firestore respond sync notice:', fsErr.message);
        }

        const updated = db.queryOne('SELECT * FROM in_app_requests WHERE id = ?', [requestId]);
        return {
            ...updated,
            action: normalizedAction,
            message: `Request successfully ${normalizedAction.toLowerCase()}ed.`
        };
    }

    /**
     * Cancel a pending outgoing request
     */
    static async cancelRequest(requestId, userId) {
        const request = db.queryOne('SELECT * FROM in_app_requests WHERE id = ?', [requestId]);
        if (!request) {
            throw new Error('Request not found.');
        }

        if (request.sender_id !== userId) {
            throw new Error('Unauthorized: You can only cancel outgoing requests sent by you.');
        }

        if (request.status !== 'PENDING') {
            throw new Error(`Cannot cancel request: already ${request.status.toLowerCase()}.`);
        }

        const now = new Date().toISOString();
        db.execute(
            `UPDATE in_app_requests
             SET status = 'CANCELLED', responded_at = ?
             WHERE id = ?`,
            [now, requestId]
        );

        // Dual-sync to Firestore
        try {
            await FirebaseFirestoreService.cancelInAppRequest(requestId, userId, request.receiver_id);
        } catch (fsErr) {
            console.warn('[Requests Service] Firestore cancel sync notice:', fsErr.message);
        }

        return {
            id: requestId,
            status: 'CANCELLED',
            message: 'Pending outgoing request cancelled.'
        };
    }

    /**
     * Get approvals list for logged-in user (My Approvals Section)
     * Supports user-wise data isolation:
     * - Admins/Managers see workspace approvals
     * - Employees/Members see approvals where they are the sender, receiver, or project owner
     */
    static getApprovalsForUser(userId, userRole = 'employee') {
        let sql = `
            SELECT r.*,
                   s.name as sender_name,
                   s.username as sender_username,
                   s.email as sender_email,
                   rec.name as receiver_name,
                   rec.username as receiver_username,
                   rec.email as receiver_email,
                   p.name as project_name,
                   p.key_prefix as project_prefix,
                   p.owner_id as project_owner_id
            FROM in_app_requests r
            JOIN users s ON r.sender_id = s.id
            JOIN users rec ON r.receiver_id = rec.id
            LEFT JOIN projects p ON r.target_entity_id = p.id
        `;
        let params = [];

        if (userRole !== 'admin') {
            sql += ` WHERE (r.sender_id = ? OR r.receiver_id = ? OR p.owner_id = ?)`;
            params = [userId, userId, userId];
        }

        sql += ` ORDER BY r.responded_at DESC, r.created_at DESC`;
        const rows = db.queryAll(sql, params);

        return rows.map(r => {
            let payload = {};
            try {
                payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json || '{}') : (r.payload_json || {});
            } catch (e) {
                payload = {};
            }
            return {
                id: r.id,
                request_type: r.request_type,
                target_entity_id: r.target_entity_id,
                status: r.status,
                created_at: r.created_at,
                responded_at: r.responded_at,
                payload,
                sender: {
                    id: r.sender_id,
                    name: r.sender_name,
                    username: r.sender_username,
                    email: r.sender_email
                },
                receiver: {
                    id: r.receiver_id,
                    name: r.receiver_name,
                    username: r.receiver_username,
                    email: r.receiver_email
                },
                project: {
                    id: r.target_entity_id,
                    name: r.project_name || payload.projectName || 'Project Workspace',
                    key_prefix: r.project_prefix || 'PRJ'
                },
                role: payload.role || 'employee',
                is_approved: r.status === 'ACCEPTED' || r.status === 'APPROVED',
                approval_status: r.status === 'ACCEPTED' ? 'Approved / Accepted' : (r.status === 'PENDING' ? 'Pending Approval' : (r.status === 'REJECTED' ? 'Rejected' : r.status))
            };
        });
    }
}

module.exports = RequestsService;
