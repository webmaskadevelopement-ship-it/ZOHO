/**
 * Firebase Auth & Firestore Validation Module
 * Enforces email whitelist check (users / invited_members) and name matching.
 */

const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// Role normalizer: maps UI selections (Admin, Manager, Client, PM, Lead) to system roles
function normalizeRole(roleInput) {
    if (!roleInput) return 'employee';
    const r = roleInput.toLowerCase().trim();
    if (r === 'admin' || r === 'administrator') return 'admin';
    if (r === 'manager' || r === 'pm' || r === 'project manager') return 'manager';
    if (r === 'client' || r === 'stakeholder') return 'client';
    if (r === 'lead' || r === 'developer' || r === 'employee' || r === 'qa') return 'employee';
    return 'employee';
}

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
     * Validate login with Name, Email, and Role against Firestore and local database
     */
    static async validateLogin({ email, name, role, db = null, sqliteDb = null }) {
        if (!email || !name) {
            throw new Error('Both Name and Email are required.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name.trim();
        const mappedRole = normalizeRole(role);

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
            } catch (err) {
                // If live Firestore fails or is not connected, fallback to SQLite
            }
        }

        // 2. Fallback to SQLite database if not found in Firestore
        if (!user && !invited) {
            const dbRef = sqliteDb || require('../../../../src/db/database');
            user = dbRef.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
            if (!user) {
                invited = dbRef.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [cleanEmail]);
            }
        }

        // 3. Email Whitelist Validation (CRITICAL): Check if email exists in users or invited_members
        if (!user && !invited) {
            throw new Error('User not found. Please contact admin or use invited email.');
        }

        // 4. Name Match Validation (CRITICAL): Name entered should match name stored for that email (case-insensitive)
        if (user) {
            if (!namesMatch(user.name, cleanName)) {
                throw new Error('Name does not match the registered user for this email.');
            }

            // Update role if explicitly selected
            if (role && user.role !== mappedRole) {
                const dbRef = sqliteDb || require('../../../../src/db/database');
                try {
                    dbRef.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [mappedRole, new Date().toISOString(), user.id]);
                    user.role = mappedRole;
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
            const userRole = mappedRole || normalizeRole(invited.role);

            dbRef.execute(`
                INSERT INTO users (id, email, password_hash, name, role, department, created_at, updated_at)
                VALUES (?, ?, 'INVITED_AUTO_PROVISIONED', ?, ?, 'Team', ?, ?)
            `, [newId, cleanEmail, invited.name, userRole, now, now]);

            // Add to default portal
            dbRef.execute(`
                INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                VALUES (?, 'portal-demo-zoho', ?, ?, 'active', ?)
            `, [uuidv4(), newId, userRole, now]);

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
     * Validate Google Login: Check if email exists in users or invited_members
     */
    static async validateGoogleLogin({ email, name, idToken = null, role = 'employee', db = null, sqliteDb = null }) {
        if (!email) {
            throw new Error('Google email is required.');
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanName = name || cleanEmail.split('@')[0];
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
        if (!user && !invited) {
            const dbRef = sqliteDb || require('../../../../src/db/database');
            user = dbRef.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
            if (!user) {
                invited = dbRef.queryOne('SELECT * FROM invited_members WHERE LOWER(email) = ?', [cleanEmail]);
            }
        }

        // 3. If exists, allow login
        if (user) {
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

        // 4. If new user, check if email is in invites collection. If invited, auto-create user and allow.
        if (invited) {
            const dbRef = sqliteDb || require('../../../../src/db/database');
            const newId = uuidv4();
            const now = new Date().toISOString();
            const userRole = normalizeRole(invited.role || role);

            dbRef.execute(`
                INSERT INTO users (id, email, password_hash, name, role, department, created_at, updated_at)
                VALUES (?, ?, 'GOOGLE_AUTO_PROVISIONED', ?, ?, 'Team', ?, ?)
            `, [newId, cleanEmail, invited.name || cleanName, userRole, now, now]);

            dbRef.execute(`
                INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                VALUES (?, 'portal-demo-zoho', ?, ?, 'active', ?)
            `, [uuidv4(), newId, userRole, now]);

            dbRef.execute(`
                UPDATE invited_members SET status = 'accepted', updated_at = ? WHERE id = ?
            `, [now, invited.id]);

            user = dbRef.queryOne('SELECT * FROM users WHERE id = ?', [newId]);

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

        // 5. If not invited and not in users, block with "Not invited" message
        throw new Error('Not invited. Please contact admin or use invited email.');
    }
}

module.exports = AuthValidationService;
