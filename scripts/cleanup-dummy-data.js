/**
 * Selective Database Cleanup Script
 * Purges only known dummy/mock records (@lifepms.com, @acme.com, seed.js sample projects)
 * Retains legitimate real projects, tasks, issues, and user accounts.
 * Seeds/Upserts canonical Admin & Manager accounts.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../src/db/database');
const { resolveAuthorizedRole } = require('../src/config/roles');
const { db: firestoreAdmin, hasAdminCredentials } = require('../src/config/firebase');

async function runCleanup() {
    console.log('================================================================');
    console.log('🧹 Life PMS - Selective Database Cleanup & Role Alignment');
    console.log('================================================================');

    const now = new Date().toISOString();
    const portalId = 'portal-demo-zoho';

    // Disable foreign keys during batch purge
    db.exec('PRAGMA foreign_keys = OFF;');
    try {
        // 1. Ensure Default Portal
        const existingPortal = db.queryOne('SELECT id FROM portals WHERE id = ?', [portalId]);
        if (!existingPortal) {
            db.execute(
                `INSERT INTO portals (id, name, slug, custom_domain, currency, created_at, updated_at)
                 VALUES (?, 'Life PMS Workspace', 'workspace', '', 'USD', ?, ?)`,
                [portalId, now, now]
            );
        }

        // 2. Identify and Purge Dummy Users
        const dummyUserPatterns = [
            '%@lifepms.com',
            '%@acme.com',
            '%@brandacme.com',
            '%@example.com',
            '%@test.com'
        ];

        let purgedUsersCount = 0;
        const allUsers = db.queryAll('SELECT id, email, name, role FROM users');
        for (const u of allUsers) {
            const lowerEmail = (u.email || '').toLowerCase().trim();
            const isDummy = dummyUserPatterns.some(pat => {
                const domain = pat.replace('%', '');
                return lowerEmail.endsWith(domain);
            });

            if (isDummy) {
                db.execute('DELETE FROM portal_members WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM personal_access_tokens WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM comments WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM active_timers WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM leave_records WHERE user_id = ?', [u.id]);
                db.execute('DELETE FROM notifications WHERE recipient_id = ?', [u.id]);
                db.execute('DELETE FROM users WHERE id = ?', [u.id]);
                purgedUsersCount++;
                console.log(`   ❌ Removed dummy user: ${u.email} (${u.name})`);

                // Also remove from Firestore if connected
                if (firestoreAdmin && hasAdminCredentials) {
                    try {
                        await firestoreAdmin.collection('users').doc(lowerEmail).delete();
                    } catch (e) {}
                }
            }
        }

    // 3. Identify and Purge Dummy Invites
    let purgedInvitesCount = 0;
    const dummyInvitePatterns = [
        '%@lifepms.com',
        '%@acmecorp.com',
        '%@acmecorp.org',
        '%@corporate.org',
        '%@example.com',
        '%@test.com'
    ];
    const allInvites = db.queryAll('SELECT id, email FROM invited_members');
    for (const inv of allInvites) {
        const lowerEmail = (inv.email || '').toLowerCase().trim();
        const isDummy = dummyInvitePatterns.some(pat => {
            const domain = pat.replace('%', '');
            return lowerEmail.endsWith(domain);
        });

        if (isDummy) {
            db.execute('DELETE FROM invited_members WHERE id = ?', [inv.id]);
            purgedInvitesCount++;
            console.log(`   ❌ Removed dummy invite: ${inv.email}`);
            if (firestoreAdmin && hasAdminCredentials) {
                try {
                    await firestoreAdmin.collection('invited_members').doc(inv.id).delete();
                } catch (e) {}
            }
        }
    }

    // 4. Purge Known Dummy Seed Projects
    const dummyProjectIds = [
        'proj-zoho-core',
        'proj-mobile-app',
        'proj-design-system',
        'proj-analytics',
        'proj-compliance'
    ];

    let purgedProjectsCount = 0;
    for (const pid of dummyProjectIds) {
        const proj = db.queryOne('SELECT id, name FROM projects WHERE id = ?', [pid]);
        if (proj) {
            db.execute('DELETE FROM time_logs WHERE project_id = ?', [pid]);
            db.execute('DELETE FROM issues WHERE project_id = ?', [pid]);
            db.execute('DELETE FROM tasks WHERE project_id = ?', [pid]);
            db.execute('DELETE FROM task_lists WHERE project_id = ?', [pid]);
            db.execute('DELETE FROM phases WHERE project_id = ?', [pid]);
            db.execute('DELETE FROM projects WHERE id = ?', [pid]);
            purgedProjectsCount++;
            console.log(`   ❌ Removed dummy sample project: ${proj.name} (${pid})`);
            if (firestoreAdmin && hasAdminCredentials) {
                try {
                    await firestoreAdmin.collection('projects').doc(pid).delete();
                } catch (e) {}
            }
        }
    }

    // 5. Ensure and Upsert Canonical Admin & Manager Accounts
    const passwordHash = await bcrypt.hash('FirebaseManagedAuth2026!', 10);
    const canonicalAccounts = [
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

    for (const account of canonicalAccounts) {
        const email = account.email.toLowerCase().trim();
        const role = resolveAuthorizedRole(email, account.role);
        let user = db.queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [email]);

        if (!user) {
            const newId = uuidv4();
            db.execute(
                `INSERT INTO users (id, email, password_hash, name, role, cost_per_hour, billable_rate_per_hour, department, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'active', ?, ?)`,
                [newId, email, passwordHash, account.name, role, account.department, now, now]
            );
            user = db.queryOne('SELECT * FROM users WHERE id = ?', [newId]);
            console.log(`   ✓ Provisioned canonical user: ${email} (${role})`);
        } else {
            if (user.role !== role) {
                db.execute('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, user.id]);
                console.log(`   ✓ Updated canonical role: ${email} -> ${role}`);
            }
        }

        // Ensure portal membership
        const pm = db.queryOne('SELECT id FROM portal_members WHERE portal_id = ? AND user_id = ?', [portalId, user.id]);
        if (!pm) {
            db.execute(
                `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
                 VALUES (?, ?, ?, ?, 'active', ?)`,
                [uuidv4(), portalId, user.id, role, now]
            );
        }

        // Sync to Firestore
        if (firestoreAdmin && hasAdminCredentials) {
            try {
                await firestoreAdmin.collection('users').doc(email).set({
                    uid: user.id,
                    email,
                    name: account.name,
                    role,
                    status: 'active',
                    updatedAt: now
                }, { merge: true });
                console.log(`   ✓ Synced to Firestore users: ${email}`);
            } catch (err) {
                console.warn(`   [Firestore] ${email} sync notice:`, err.message);
            }
        }
    }

    // 5b. Reassign any orphaned foreign references in retained projects and issues to Admin
    const primaryAdmin = db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (primaryAdmin) {
        db.execute('UPDATE projects SET owner_id = ? WHERE owner_id NOT IN (SELECT id FROM users)', [primaryAdmin.id]);
        db.execute('UPDATE issues SET reporter_id = ? WHERE reporter_id NOT IN (SELECT id FROM users)', [primaryAdmin.id]);
        db.execute('UPDATE phases SET owner_id = ? WHERE owner_id IS NOT NULL AND owner_id NOT IN (SELECT id FROM users)', [primaryAdmin.id]);
    }

    // 6. Report Live Records Retained
    const retainedUsers = db.queryAll('SELECT id, email, name, role FROM users');
    const retainedProjects = db.queryAll('SELECT id, name, key_prefix FROM projects');
    const retainedTasksCount = db.queryOne('SELECT COUNT(*) as c FROM tasks')?.c || 0;
    const retainedIssuesCount = db.queryOne('SELECT COUNT(*) as c FROM issues')?.c || 0;

    console.log('================================================================');
    console.log('📊 CLEANUP SUMMARY:');
    console.log(`   - Dummy Users Removed:       ${purgedUsersCount}`);
    console.log(`   - Dummy Invites Removed:     ${purgedInvitesCount}`);
    console.log(`   - Dummy Projects Removed:    ${purgedProjectsCount}`);
    console.log('----------------------------------------------------------------');
    console.log(`   - Live Users Retained:       ${retainedUsers.length}`);
    retainedUsers.forEach(u => console.log(`       • ${u.email} (${u.role}) - ${u.name}`));
    console.log(`   - Live Projects Retained:    ${retainedProjects.length}`);
    retainedProjects.forEach(p => console.log(`       • [${p.key_prefix || 'PRJ'}] ${p.name}`));
    console.log(`   - Live Tasks Retained:       ${retainedTasksCount}`);
    console.log(`   - Live Issues Retained:      ${retainedIssuesCount}`);
    console.log('================================================================');

    return {
        purgedUsersCount,
        purgedInvitesCount,
        purgedProjectsCount,
        retainedUsersCount: retainedUsers.length,
        retainedProjectsCount: retainedProjects.length
    };
    } finally {
        db.exec('PRAGMA foreign_keys = ON;');
    }
}

if (require.main === module) {
    runCleanup().then(() => {
        console.log('✓ Selective cleanup execution completed successfully.');
        process.exit(0);
    }).catch(err => {
        console.error('❌ Cleanup failed:', err);
        process.exit(1);
    });
}

module.exports = { runCleanup };
