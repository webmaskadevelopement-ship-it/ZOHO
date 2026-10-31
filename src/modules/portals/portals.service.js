const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class PortalsService {
    static createPortal({ name, slug, customDomain = null, logoUrl = null, currency = 'USD', businessHours, creatorUserId }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const safeSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase();

        const existing = db.queryOne('SELECT id FROM portals WHERE slug = ?', [safeSlug]);
        if (existing) {
            throw new Error(`Portal with slug "${safeSlug}" already exists.`);
        }

        const bHours = businessHours
            ? JSON.stringify(businessHours)
            : JSON.stringify({ workingDays: [1, 2, 3, 4, 5], startHour: "09:00", endHour: "18:00", timezone: "UTC" });

        return db.transaction(() => {
            // 1. Insert Portal
            db.execute(
                `INSERT INTO portals (id, name, slug, custom_domain, logo_url, business_hours, currency, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, safeSlug, customDomain, logoUrl, bHours, currency, now, now]
            );

            // 2. Add creator as admin
            const memberId = uuidv4();
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, 'admin', 'active', ?)`,
                [memberId, id, creatorUserId, now]
            );

            // 3. Log Audit
            this.logAudit({
                portalId: id,
                userId: creatorUserId,
                action: 'portal.created',
                entityType: 'portal',
                entityId: id,
                changes: { name, slug: safeSlug }
            });

            return db.queryOne('SELECT * FROM portals WHERE id = ?', [id]);
        });
    }

    static getPortalsForUser(userId) {
        return db.queryAll(
            `SELECT p.*, pm.role as user_portal_role
             FROM portal_members pm
             JOIN portals p ON pm.portal_id = p.id
             WHERE pm.user_id = ? AND pm.status = 'active'`,
            [userId]
        );
    }

    static getPortalById(portalId) {
        const portal = db.queryOne('SELECT * FROM portals WHERE id = ?', [portalId]);
        if (!portal) throw new Error('Portal not found.');
        return portal;
    }

    static updatePortal(portalId, { name, customDomain, logoUrl, businessHours, holidays, currency, settings, userId }) {
        const now = new Date().toISOString();
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (customDomain !== undefined) { updates.push('custom_domain = ?'); params.push(customDomain); }
        if (logoUrl !== undefined) { updates.push('logo_url = ?'); params.push(logoUrl); }
        if (businessHours !== undefined) { updates.push('business_hours = ?'); params.push(JSON.stringify(businessHours)); }
        if (holidays !== undefined) { updates.push('holidays = ?'); params.push(JSON.stringify(holidays)); }
        if (currency !== undefined) { updates.push('currency = ?'); params.push(currency); }
        if (settings !== undefined) { updates.push('settings = ?'); params.push(JSON.stringify(settings)); }

        if (updates.length === 0) return this.getPortalById(portalId);

        updates.push('updated_at = ?');
        params.push(now);
        params.push(portalId);

        db.execute(`UPDATE portals SET ${updates.join(', ')} WHERE id = ?`, params);

        if (userId) {
            this.logAudit({
                portalId,
                userId,
                action: 'portal.updated',
                entityType: 'portal',
                entityId: portalId,
                changes: { updates }
            });
        }

        return this.getPortalById(portalId);
    }

    // Portal Members
    static getMembers(portalId) {
        return db.queryAll(
            `SELECT pm.id as membership_id, pm.role as portal_role, pm.status as member_status, pm.created_at as joined_at,
                    u.id, u.email, u.name, u.role as global_role, u.department, u.cost_per_hour, u.billable_rate_per_hour, u.client_company_id
             FROM portal_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.portal_id = ?`,
            [portalId]
        );
    }

    static addMember(portalId, { userId, email, role = 'employee' }) {
        let user;
        if (userId) {
            user = db.queryOne('SELECT id, email, name FROM users WHERE id = ?', [userId]);
        } else if (email) {
            user = db.queryOne('SELECT id, email, name FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        }

        if (!user) {
            throw new Error('User not found. Ensure the user is registered before adding to portal.');
        }

        const existing = db.queryOne(
            'SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?',
            [portalId, user.id]
        );
        if (existing) {
            throw new Error('User is already a member of this portal.');
        }

        const memberId = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [memberId, portalId, user.id, role, now]
        );

        return db.queryOne(
            `SELECT pm.*, u.email, u.name FROM portal_members pm JOIN users u ON pm.user_id = u.id WHERE pm.id = ?`,
            [memberId]
        );
    }

    static updateMemberRole(portalId, memberUserId, newRole) {
        db.execute(
            'UPDATE portal_members SET role = ? WHERE portal_id = ? AND user_id = ?',
            [newRole, portalId, memberUserId]
        );
        return { success: true, portalId, userId: memberUserId, newRole };
    }

    static async inviteMember(portalId, { email, name, role = 'employee', inviterId, inviterName, baseUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.APP_BASE_URL || 'http://localhost:5000') }) {
        if (!email || !name) {
            throw new Error('Email and Name are required.');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email address format.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name.trim();
        const validRoles = ['admin', 'manager', 'employee', 'client'];
        const normalizedRole = validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'employee';

        const { resolveAuthorizedRole } = require('../../config/roles');
        const existingUser = db.queryOne('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?', [cleanEmail]);
        const canonicalRole = resolveAuthorizedRole(cleanEmail, existingUser ? existingUser.role : normalizedRole);
        const inviteStatus = existingUser ? 'active' : 'pending';

        const crypto = require('crypto');
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const existingInvite = db.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [cleanEmail]);
        let inviteId = existingInvite ? existingInvite.id : uuidv4();
        let token = existingInvite?.token || (uuidv4() + '-' + crypto.randomBytes(16).toString('hex'));
        let tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        if (existingInvite) {
            db.execute(
                `UPDATE invited_members 
                 SET name = ?, role = ?, status = ?, invited_by = ?, token = ?, token_hash = ?, expires_at = ?, updated_at = ? 
                 WHERE id = ?`,
                [cleanName, canonicalRole, inviteStatus, inviterId || 'system', token, tokenHash, expiresAt, now, inviteId]
            );
        } else {
            db.execute(
                `INSERT INTO invited_members (id, portal_id, email, name, role, status, invited_by, token, token_hash, expires_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [inviteId, portalId, cleanEmail, cleanName, canonicalRole, inviteStatus, inviterId || 'system', token, tokenHash, expiresAt, now, now]
            );
        }

        // Ensure user is registered in portal_members if existingUser exists
        if (existingUser) {
            const pm = db.queryOne('SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?', [portalId, existingUser.id]);
            if (!pm) {
                db.execute(
                    `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                     VALUES (?, ?, ?, ?, 'active', ?)`,
                    [uuidv4(), portalId, existingUser.id, canonicalRole, now]
                );
            }
        }

        // Firestore sync if connected
        try {
            const { db: firestoreDb } = require('../../config/firebase');
            if (firestoreDb && typeof firestoreDb.collection === 'function') {
                await firestoreDb.collection('invited_members').doc(inviteId).set({
                    id: inviteId,
                    portalId,
                    email: cleanEmail,
                    name: cleanName,
                    role: canonicalRole,
                    status: inviteStatus,
                    tokenHash,
                    token,
                    expiresAt,
                    invitedBy: inviterId || 'system',
                    updatedAt: now
                }, { merge: true });
            }
        } catch (e) {
            console.warn('[Firestore] Sync invited member notice:', e.message);
        }

        // Construct verified invite link with token and email
        const inviteLink = `${baseUrl}/login?token=${token}&inviteEmail=${encodeURIComponent(cleanEmail)}&inviteName=${encodeURIComponent(cleanName)}&role=${encodeURIComponent(canonicalRole)}`;

        // Send Email via EmailService
        const EmailService = require('../../services/emailService');
        let emailResult = { success: false, deliveredToInbox: false };
        try {
            emailResult = await EmailService.sendInvitationEmail({
                recipientEmail: cleanEmail,
                recipientName: cleanName,
                role: canonicalRole,
                portalName: 'Life PMS Workspace',
                projectName: 'Life PMS Projects',
                inviteLink,
                token,
                expiresAt,
                inviterName: inviterName || 'Project Administrator'
            });
        } catch (mailErr) {
            console.error('[EmailService] Invitation dispatch error:', mailErr.message);
            emailResult = { success: false, deliveredToInbox: false, error: mailErr.message };
        }

        return {
            success: true,
            inviteId,
            invitationId: inviteId,
            token,
            expiresAt,
            email: cleanEmail,
            name: cleanName,
            role: canonicalRole,
            inviteLink,
            messageId: emailResult.messageId || null,
            previewUrl: emailResult.previewUrl || null,
            deliveredToInbox: emailResult.deliveredToInbox || false,
            isDailyLimitExceeded: emailResult.isDailyLimitExceeded || false,
            sandboxOnly: emailResult.sandboxOnly || false,
            provider: emailResult.provider || null,
            emailDelivery: emailResult
        };
    }

    // Client Companies
    static getClientCompanies(portalId) {
        return db.queryAll('SELECT * FROM client_companies WHERE portal_id = ? ORDER BY name ASC', [portalId]);
    }

    static createClientCompany(portalId, { name, email, phone, address, currency = 'USD' }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO client_companies (id, portal_id, name, email, phone, address, currency, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, email, phone, address, currency, now]
        );
        return db.queryOne('SELECT * FROM client_companies WHERE id = ?', [id]);
    }

    // Leave Records
    static getLeaveRecords(portalId) {
        return db.queryAll(
            `SELECT lr.*, u.name as user_name, u.email as user_email
             FROM leave_records lr
             JOIN users u ON lr.user_id = u.id
             WHERE lr.portal_id = ?
             ORDER BY lr.start_date ASC`,
            [portalId]
        );
    }

    static createLeaveRecord(portalId, { userId, startDate, endDate, leaveType = 'vacation', status = 'approved' }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO leave_records (id, portal_id, user_id, start_date, end_date, leave_type, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, userId, startDate, endDate, leaveType, status, now]
        );
        return db.queryOne('SELECT * FROM leave_records WHERE id = ?', [id]);
    }

    // Audit Logs
    static logAudit({ portalId, userId, action, entityType, entityId, changes = {}, ipAddress = '' }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO audit_logs (id, portal_id, user_id, action, entity_type, entity_id, changes, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, userId, action, entityType, entityId, JSON.stringify(changes), ipAddress, now]
        );
    }

    static getAuditLogs(portalId, limit = 50) {
        return db.queryAll(
            `SELECT al.*, u.name as user_name, u.email as user_email
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.portal_id = ?
             ORDER BY al.created_at DESC
             LIMIT ?`,
            [portalId, limit]
        );
    }
}

module.exports = PortalsService;
