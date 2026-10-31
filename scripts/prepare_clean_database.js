/**
 * Master Database Preparation & Purge Script
 * 1. Purges ALL sample/mock/test projects, tasks, task lists, phases, issues, time logs, and in-app requests.
 * 2. Leaves 0 sample data so the user can enter real data themselves.
 * 3. Configures all authentic user accounts (Admin, Manager, 10 Employees) with exact usernames and passwords.
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/db/database');
const { FirebaseFirestoreService } = require('../src/services/firebaseFirestoreService');

async function run() {
    console.log('=== PREPARING CLEAN DATABASE WITH ZERO SAMPLE DATA ===\n');

    // 1. Wipe sample tables
    const tablesToClear = [
        'projects',
        'phases',
        'task_lists',
        'tasks',
        'issues',
        'time_logs',
        'active_timers',
        'expenses',
        'invoices',
        'comments',
        'files',
        'wiki_pages',
        'discussions',
        'chat_rooms',
        'notifications',
        'in_app_requests',
        'user_connections',
        'audit_logs',
        'custom_views',
        'task_dependencies',
        'task_relations',
        'task_reminders',
        'task_votes',
        'sla_breach_logs',
        'folders',
        'proof_annotations',
        'tags',
        'entity_tags',
        'public_shares',
        'submitted_emails',
        'client_companies',
        'teams',
        'project_groups',
        'leave_records',
        'webhook_deliveries',
        'active_sessions',
        'personal_access_tokens'
    ];

    for (const t of tablesToClear) {
        try {
            db.execute(`DELETE FROM "${t}"`);
            console.log(`✓ Cleared sample table: ${t}`);
        } catch (e) {
            console.warn(`! Note on clearing ${t}: ${e.message}`);
        }
    }

    const now = new Date().toISOString();
    const portalId = 'portal-demo-zoho';

    // 2. Ensure default portal exists
    let portal = db.queryOne('SELECT id FROM portals WHERE id = ?', [portalId]);
    if (!portal) {
        db.execute(
            `INSERT INTO portals (id, name, slug, custom_domain, currency, created_at, updated_at)
             VALUES (?, 'Life PMS Workspace', 'workspace', '', 'USD', ?, ?)`,
            [portalId, now, now]
        );
        console.log('✓ Created default portal: portal-demo-zoho');
    }

    // 3. Authentic Accounts Definition
    const AUTHENTIC_USERS = [
        {
            email: 'webmaskadevelopement@gmail.com',
            username: 'admin',
            name: 'Nikhil Kaushik',
            role: 'admin',
            department: 'Executive',
            password: 'FirebaseManagedAuth2026!'
        },
        {
            email: 'backend.webmaska@gmail.com',
            username: 'manager',
            name: 'Tushar',
            role: 'manager',
            department: 'Engineering',
            password: 'FirebaseManagedAuth2026!'
        },
        {
            email: 'ritikasharma49527@gmail.com',
            username: 'ritika.sharma',
            name: 'Ritika Sharma',
            role: 'member',
            department: 'Operations',
            password: 'FirebaseManagedAuth2026!'
        },
        {
            email: 'varunvashisth028@gmail.com',
            username: 'varun',
            name: 'Varun Sharma',
            role: 'member',
            department: 'Engineering',
            password: 'FirebaseManagedAuth2026!'
        },
        {
            email: 'webmaskafilms@gmail.com',
            username: 'webmaskafilms',
            name: 'Webmaska Films',
            role: 'member',
            department: 'Media',
            password: 'FirebaseManagedAuth2026!'
        },
        // 10 Employees
        {
            email: 'ravi.bhadoria@zoho.com',
            username: 'ravi.bhadoria',
            name: 'Ravi Bhadoria',
            role: 'employee',
            department: 'Engineering',
            password: 'Zoho@Ravi#2026'
        },
        {
            email: 'ananya.gupta@zoho.com',
            username: 'ananya.gupta',
            name: 'Ananya Gupta',
            role: 'employee',
            department: 'Design',
            password: 'Zoho@Anan#2026'
        },
        {
            email: 'ineet@zoho.com',
            username: 'ineet',
            name: 'Ineet',
            role: 'employee',
            department: 'QA & Testing',
            password: 'Zoho@Inee#2026'
        },
        {
            email: 'nikhil@zoho.com',
            username: 'nikhil',
            name: 'Nikhil',
            role: 'employee',
            department: 'Engineering',
            password: 'Zoho@Nikh#2026'
        },
        {
            email: 'ritika@zoho.com',
            username: 'ritika',
            name: 'Ritika',
            role: 'employee',
            department: 'Operations',
            password: 'Zoho@Riti#2026'
        },
        {
            email: 'shweta@zoho.com',
            username: 'shweta',
            name: 'Shweta',
            role: 'employee',
            department: 'Design',
            password: 'Zoho@Shwe#2026'
        },
        {
            email: 'ekta@zoho.com',
            username: 'ekta',
            name: 'Ekta',
            role: 'employee',
            department: 'Marketing',
            password: 'Zoho@Ekta#2026'
        },
        {
            email: 'abhishek@zoho.com',
            username: 'abhishek',
            name: 'Abhishek',
            role: 'employee',
            department: 'Engineering',
            password: 'Zoho@Abhi#2026'
        },
        {
            email: 'prince@zoho.com',
            username: 'prince',
            name: 'Prince',
            role: 'employee',
            department: 'DevOps',
            password: 'Zoho@Prin#2026'
        },
        {
            email: 'ali@zoho.com',
            username: 'ali',
            name: 'Ali',
            role: 'employee',
            department: 'Frontend',
            password: 'Zoho@Ali1#2026'
        }
    ];

    const authenticEmails = AUTHENTIC_USERS.map(u => u.email.toLowerCase());

    // 4. Remove any unauthorized or non-authentic users
    const existingUsers = db.queryAll('SELECT id, email FROM users');
    for (const eu of existingUsers) {
        const cleanEmail = (eu.email || '').toLowerCase().trim();
        if (!authenticEmails.includes(cleanEmail)) {
            db.execute('DELETE FROM portal_members WHERE user_id = ?', [eu.id]);
            db.execute('DELETE FROM users WHERE id = ?', [eu.id]);
            console.log(`✓ Removed leftover non-authentic user: ${cleanEmail}`);
        }
    }

    // 5. Upsert authentic users with proper hashes and usernames
    for (const u of AUTHENTIC_USERS) {
        const cleanEmail = u.email.toLowerCase().trim();
        const cleanUsername = u.username.toLowerCase().trim();
        const hash = await bcrypt.hash(u.password, 10);

        let user = db.queryOne(
            'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?',
            [cleanEmail, cleanUsername]
        );

        if (!user) {
            const newId = uuidv4();
            db.execute(
                `INSERT INTO users (id, email, username, password_hash, name, role, department, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [newId, cleanEmail, cleanUsername, hash, u.name, u.role, u.department, now, now]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
            console.log(`✓ Created user: ${u.name} (username: ${cleanUsername}, email: ${cleanEmail})`);
        } else {
            db.execute(
                `UPDATE users
                 SET email = ?, username = ?, password_hash = ?, name = ?, role = ?, department = ?, status = 'active', updated_at = ?
                 WHERE id = ?`,
                [cleanEmail, cleanUsername, hash, u.name, u.role, u.department, now, user.id]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
            console.log(`✓ Updated user: ${u.name} (username: ${cleanUsername}, email: ${cleanEmail})`);
        }

        // Ensure membership in portal
        const pm = db.queryOne(
            'SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?',
            [portalId, user.id]
        );
        if (!pm) {
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [uuidv4(), portalId, user.id, u.role, now]
            );
        }

        // Sync to Firestore non-blocking
        FirebaseFirestoreService.syncUser(user).catch(() => {});
    }

    console.log('\n=== VERIFICATION: DATABASE STATUS ===');
    console.log('Projects count:', db.queryOne('SELECT count(*) as c FROM projects').c);
    console.log('Tasks count:', db.queryOne('SELECT count(*) as c FROM tasks').c);
    console.log('Task lists count:', db.queryOne('SELECT count(*) as c FROM task_lists').c);
    console.log('Phases count:', db.queryOne('SELECT count(*) as c FROM phases').c);
    console.log('Issues count:', db.queryOne('SELECT count(*) as c FROM issues').c);
    console.log('In-app requests count:', db.queryOne('SELECT count(*) as c FROM in_app_requests').c);
    console.log('Authentic users count:', db.queryOne('SELECT count(*) as c FROM users').c);
    console.log('\n=== READY FOR USER-ENTERED DATA. ZERO SAMPLE ROWS EXIST. ===\n');
}

run().catch(err => {
    console.error('Error preparing database:', err);
    process.exit(1);
});

