/**
 * Seed Script for Employee Credentials
 * Seeds the 10 canonical employees from the specification into:
 * 1. Local SQLite Database (data/life_pms.db)
 * 2. Default Workspace Portal (portal-demo-zoho)
 * 3. Zoho Project Firestore Users Collection (zoho-cda77)
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/db/database');
const { FirebaseFirestoreService } = require('../src/services/firebaseFirestoreService');

const EMPLOYEES = [
    { name: 'Ravi Bhadoria', username: 'ravi.bhadoria', password: 'Zoho@Ravi#2026', email: 'ravi.bhadoria@zoho.com', role: 'employee' },
    { name: 'Ananya Gupta', username: 'ananya.gupta', password: 'Zoho@Anan#2026', email: 'ananya.gupta@zoho.com', role: 'employee' },
    { name: 'Ineet', username: 'ineet', password: 'Zoho@Inee#2026', email: 'ineet@zoho.com', role: 'employee' },
    { name: 'Nikhil', username: 'nikhil', password: 'Zoho@Nikh#2026', email: 'nikhil@zoho.com', role: 'employee' },
    { name: 'Ritika', username: 'ritika', password: 'Zoho@Riti#2026', email: 'ritika@zoho.com', role: 'employee' },
    { name: 'Shweta', username: 'shweta', password: 'Zoho@Shwe#2026', email: 'shweta@zoho.com', role: 'employee' },
    { name: 'Ekta', username: 'ekta', password: 'Zoho@Ekta#2026', email: 'ekta@zoho.com', role: 'employee' },
    { name: 'Abhishek', username: 'abhishek', password: 'Zoho@Abhi#2026', email: 'abhishek@zoho.com', role: 'employee' },
    { name: 'Prince', username: 'prince', password: 'Zoho@Prin#2026', email: 'prince@zoho.com', role: 'employee' },
    { name: 'Ali', username: 'ali', password: 'Zoho@Ali1#2026', email: 'ali@zoho.com', role: 'employee' }
];

async function seedEmployeeCredentials() {
    console.log('🚀 Seeding 10 Employee Credentials into SQLite & Zoho Firestore...');
    const now = new Date().toISOString();
    const portalId = 'portal-demo-zoho';

    // Ensure default portal exists
    const portal = db.queryOne('SELECT id FROM portals WHERE id = ?', [portalId]);
    if (!portal) {
        db.execute(
            `INSERT INTO portals (id, name, slug, custom_domain, currency, created_at, updated_at)
             VALUES (?, 'Life PMS Workspace', 'workspace', '', 'USD', ?, ?)`,
            [portalId, now, now]
        );
    }

    const seededUsers = [];

    for (const emp of EMPLOYEES) {
        const cleanEmail = emp.email.toLowerCase().trim();
        const cleanUsername = emp.username.toLowerCase().trim();
        const passwordHash = await bcrypt.hash(emp.password, 10);

        let user = db.queryOne(
            'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
            [cleanEmail, cleanUsername]
        );

        if (!user) {
            const newId = uuidv4();
            db.execute(
                `INSERT INTO users (id, email, username, password_hash, name, role, department, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'Engineering', 'active', ?, ?)`,
                [newId, cleanEmail, cleanUsername, passwordHash, emp.name, emp.role, now, now]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
            console.log(`✓ Created Employee: ${emp.name} | User: ${cleanUsername} | Email: ${cleanEmail}`);
        } else {
            // Update credentials & username if needed
            db.execute(
                `UPDATE users
                 SET username = ?, password_hash = ?, name = ?, role = ?, updated_at = ?
                 WHERE id = ?`,
                [cleanUsername, passwordHash, emp.name, emp.role, now, user.id]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
            console.log(`✓ Updated Employee: ${emp.name} | User: ${cleanUsername}`);
        }

        // Ensure portal membership
        const pm = db.queryOne(
            'SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?',
            [portalId, user.id]
        );
        if (!pm) {
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [uuidv4(), portalId, user.id, emp.role, now]
            );
        }

        // Dual-Sync to Firestore
        try {
            await FirebaseFirestoreService.syncUser(user);
        } catch (fsErr) {
            console.warn(`[Firestore Sync Warning] ${emp.username}:`, fsErr.message);
        }

        seededUsers.push({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: user.role
        });
    }

    console.log(`🎉 Successfully seeded and synced all ${seededUsers.length} employee accounts!`);
    return seededUsers;
}

if (require.main === module) {
    seedEmployeeCredentials()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Seeding failed:', err);
            process.exit(1);
        });
}

module.exports = seedEmployeeCredentials;

