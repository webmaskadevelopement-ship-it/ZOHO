/**
 * Firebase Auth & Firestore Validation Module
 * Enforces canonical RBAC role resolution and Google Sign-In provisioning.
 */

const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { resolveAuthorizedRole, normalizeRole } = require('../../config/roles');

// Clean human name comparison (case-insensitive, handles dots/underscores/dashes, ignores titles in parens)
function namesMatch(storedName, inputName) {
    if (!storedName || !inputName) return false;
    const s = storedName.toLowerCase().trim();
    const i = inputName.toLowerCase().trim();
    if (s === i) return true;
    const cleanS = s.replace(/\s*\(.*?\)\s*/g, '').trim();
    if (cleanS === i) return true;
    if (s.includes(i) || i.includes(cleanS)) return true;
    
    // Normalize separators like dots, underscores, dashes to spaces
    const normS = cleanS.replace(/[._\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const normI = i.replace(/[._\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (normS === normI) return true;
    if (normS.includes(normI) || normI.includes(normS)) return true;

    return false;
}

class AuthValidationService {
    /**
     * Validate legacy login with Name and Email (for backwards compatibility)
     */
    static async validateLogin({ email, name, role, db = null, sqliteDb = null }) {
        if (!email || !name) {
            throw new Error('Both Name and Email are required.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name.trim();

        let user = null;
        let invited = null;

        // 1. Try Firestore lookup if db instance provided
        if (db && typeof db.collection === 'function') {
            try {
                const userSnapshot = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
                if (!userSnapshot.empty) {
                    user = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
                } else {
                    const inviteSnapshot = await db.collection('invited_members').where('email', '==', cleanEmail).limit(1).get();
                    if (!inviteSnapshot.empty) {
                        invited = { id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() };
                    }
                }
            } catch (err) {}
        }

        // 2. Fallback to SQLite database if not found in Firestore
        if (!user && !invited) {
            const dbRef = sqliteDb || require('../../../../src/db/database');
            user = dbRef.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
            if (!user) {
                invited = dbRef.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [cleanEmail]);
            }
        }

        // 3. User existence validation
        if (!user && !invited) {
            throw new Error('User not found. Please contact admin or use invited email.');
        }

        const resolvedRole = resolveAuthorizedRole(cleanEmail, user?.role || invited?.role);

        // 4. Name Match Validation
        if (user) {
            if (!namesMatch(user.name, cleanName)) {
                throw new Error('Name does not match the registered user for this email.');
            }

            if (user.role !== resolvedRole) {
                const dbRef = sqliteDb || require('../../../../src/db/database');
                try {
                    dbRef.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [resolvedRole, new Date().toISOString(), user.id]);
                    user.role = resolvedRole;
                } catch (e) {}
            }
        } else if (invited) {
            if (!namesMatch(invited.name, cleanName)) {
                throw new Error('Name does not match the invited member name for this email.');
            }

            // Auto-provision invited member into users
            const dbRef = sqliteDb || require('../../../../src/db/database');
            const newId = uuidv4();
            const now = new Date().toISOString();

            dbRef.execute(`
                INSERT INTO users (id, email, password_hash, name, role, department, created_at, updated_at)
                VALUES (?, ?, 'INVITED_AUTO_PROVISIONED', ?, ?, 'Team', ?, ?)
            `, [newId, cleanEmail, invited.name, resolvedRole, now, now]);

            // Add to default portal
            dbRef.execute(`
                INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                VALUES (?, 'portal-demo-zoho', ?, ?, 'active', ?)
            `, [uuidv4(), newId, resolvedRole, now]);

            // Mark invite accepted
            dbRef.execute(`
                UPDATE invited_members SET status = 'accepted', updated_at = ? WHERE id = ?
            `, [now, invited.id]);

            user = dbRef.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
        }

        // 5. Generate Session JWT
        const jwtSecret = process.env.JWT_SECRET || 'zoho-pms-super-secret-dev-jwt-key-2026';
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role, name: user.name },
            jwtSecret,
            { expiresIn: '7d' }
        );

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                department: user.department || 'Team'
            },
            token
        };
    }

    /**
     * Validate Google Login: Resolves canonical role (admin, manager, or member)
     * Auto-provisions new Google-authenticated users without 'Not invited' restrictions.
     */
    static async validateGoogleLogin({ email, name, idToken = null, role = null, db = null, sqliteDb = null }) {
        if (!email) {
            throw new Error('Google email is required.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name || cleanEmail.split('@')[0];
        const now = new Date().toISOString();

        let user = null;
        let invited = null;

        // 1. Try Firestore lookup
        if (db && typeof db.collection === 'function') {
            try {
                const userSnapshot = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
                if (!userSnapshot.empty) {
                    user = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
                } else {
                    const inviteSnapshot = await db.collection('invited_members').where('email', '==', cleanEmail).limit(1).get();
                    if (!inviteSnapshot.empty) {
                        invited = { id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() };
                    }
                }
            } catch (err) {}
        }

        // 2. Fallback to SQLite database
        const dbRef = sqliteDb || require('../../../../src/db/database');
        if (!user) {
            user = dbRef.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
        }
        if (!invited) {
            invited = dbRef.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [cleanEmail]);
        }

        // 3. Resolve canonical role:
        // webmaskadevelopement@gmail.com -> admin
        // backend.webmaska@gmail.com -> manager
        // other valid Google account -> member (or existing role if already set)
        const resolvedRole = resolveAuthorizedRole(cleanEmail, user?.role || invited?.role);

        if (user) {
            // Update role if changed
            if (user.role !== resolvedRole) {
                try {
                    dbRef.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [resolvedRole, now, user.id]);
                    user.role = resolvedRole;
                } catch (e) {}
            }
            if (invited && invited.status === 'pending') {
                try {
                    dbRef.execute(`UPDATE invited_members SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`, [now, now, invited.id]);
                } catch (e) {}
            }
        } else {
            // Auto-provision brand new Google user into SQLite
            const newId = uuidv4();
            try {
                dbRef.execute(`
                    INSERT INTO users (id, email, password_hash, name, role, department, created_at, updated_at)
                    VALUES (?, ?, 'GOOGLE_AUTO_PROVISIONED', ?, ?, 'Team', ?, ?)
                `, [newId, cleanEmail, cleanName, resolvedRole, now, now]);

                dbRef.execute(`
                    INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                    VALUES (?, 'portal-demo-zoho', ?, ?, 'active', ?)
                `, [uuidv4(), newId, resolvedRole, now]);

                if (invited) {
                    dbRef.execute(`
                        UPDATE invited_members SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?
                    `, [now, now, invited.id]);
                }

                user = dbRef.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
            } catch (err) {
                user = { id: newId, email: cleanEmail, name: cleanName, role: resolvedRole, department: 'Team' };
            }
        }

        // 4. Upsert into Firestore `users` collection if connected
        if (db && typeof db.collection === 'function') {
            try {
                await db.collection('users').doc(cleanEmail).set({
                    uid: user?.id || cleanEmail,
                    email: cleanEmail,
                    name: cleanName,
                    role: resolvedRole,
                    status: 'active',
                    lastLoginAt: now,
                    updatedAt: now
                }, { merge: true });
            } catch (e) {}
        }

        // 5. Issue session JWT
        const jwtSecret = process.env.JWT_SECRET || 'zoho-pms-super-secret-dev-jwt-key-2026';
        const token = jwt.sign(
            { userId: user.id, email: cleanEmail, role: resolvedRole, name: cleanName },
            jwtSecret,
            { expiresIn: '7d' }
        );

        return {
            success: true,
            user: {
                id: user.id,
                email: cleanEmail,
                name: cleanName,
                role: resolvedRole,
                department: user.department || 'Team'
            },
            token
        };
    }
}

module.exports = AuthValidationService;
