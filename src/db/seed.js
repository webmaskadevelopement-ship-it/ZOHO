const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { resolveAuthorizedRole } = require('../config/roles');
const { db: firestoreAdmin, hasAdminCredentials } = require('../config/firebase');

async function seed() {
    console.log('🌱 Idempotent bootstrap initialization for Life PMS...');

    const now = new Date().toISOString();

    // 1. Ensure Default Workspace Portal exists
    const portalId = 'portal-demo-zoho';
    const existingPortal = db.queryOne('SELECT id FROM portals WHERE id = ?', [portalId]);
    if (!existingPortal) {
        db.execute(
            `INSERT INTO portals (id, name, slug, custom_domain, currency, created_at, updated_at)
             VALUES (?, 'Life PMS Workspace', 'workspace', '', 'USD', ?, ?)`,
            [portalId, now, now]
        );
        console.log('✓ Initialized default workspace portal.');
    }

    const passwordHash = await bcrypt.hash('FirebaseManagedAuth2026!', 10);

    // 2. Canonical Real Accounts to Ensure (NO DUMMY PERSONAS)
    const canonicalUsers = [
        {
            email: 'webmaskadevelopement@gmail.com',
            name: 'Admin',
            role: 'admin',
            department: 'Executive'
        },
        {
            email: 'backend.webmaska@gmail.com',
            name: 'Manager',
            role: 'manager',
            department: 'Engineering'
        }
    ];

    for (const u of canonicalUsers) {
        const cleanEmail = u.email.toLowerCase().trim();
        const role = resolveAuthorizedRole(cleanEmail, u.role);
        let user = db.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);

        if (!user) {
            const newId = uuidv4();
            db.execute(
                `INSERT INTO users (id, email, password_hash, name, role, cost_per_hour, billable_rate_per_hour, department, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'active', ?, ?)`,
                [newId, cleanEmail, passwordHash, u.name, role, u.department, now, now]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
            console.log(`✓ Created user: ${cleanEmail} (${role})`);
        } else {
            // Update role to canonical role if different
            if (user.role !== role) {
                db.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, user.id]);
                console.log(`✓ Updated role for user: ${cleanEmail} -> ${role}`);
            }
        }

        // Ensure membership in default portal
        const membership = db.queryOne('SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?', [portalId, user.id]);
        if (!membership) {
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [uuidv4(), portalId, user.id, role, now]
            );
        }

        // Sync to Firestore if credentials exist
        if (firestoreAdmin && hasAdminCredentials) {
            try {
                await firestoreAdmin.collection('users').doc(cleanEmail).set({
                    uid: user.id,
                    email: cleanEmail,
                    name: user.name,
                    role,
                    status: 'active',
                    updatedAt: now
                }, { merge: true });
                console.log(`✓ Synced ${cleanEmail} to Firestore 'users' collection.`);
            } catch (fsErr) {
                console.warn(`[Firestore Sync] ${cleanEmail} notice:`, fsErr.message);
            }
        }
    }

    try {
        const seedEmployeeCredentials = require('../../scripts/seedEmployeeCredentials');
        await seedEmployeeCredentials();
    } catch (empErr) {
        console.warn('[Seed] Notice seeding employee credentials:', empErr.message);
    }
    console.log('✓ Idempotent bootstrap completed. Zero dummy projects or test personas seeded.');
}

if (require.main === module) {
    seed().then(() => {
        console.log('Done.');
        process.exit(0);
    }).catch(err => {
        console.error('Bootstrap error:', err);
        process.exit(1);
    });
}

module.exports = { seed };
