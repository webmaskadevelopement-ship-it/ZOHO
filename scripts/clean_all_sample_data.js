// Script to remove ALL sample/dummy data from Life PMS database
// Leaves only authentic workspace accounts and clean empty tables ready for real user data

const db = require('../src/db/database');

console.log('=== REMOVING ALL SAMPLE DATA FROM DATABASE ===\n');

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

for (const tableName of tablesToClear) {
    try {
        const res = db.execute(`DELETE FROM "${tableName}"`);
        console.log(`✓ Cleared table: ${tableName}`);
    } catch (e) {
        console.warn(`! Note for ${tableName}: ${e.message}`);
    }
}

// Clean any dummy persona users (retain only authentic registered accounts)
const authenticEmails = [
    'webmaskadevelopement@gmail.com',
    'backend.webmaska@gmail.com',
    'ritikasharma49527@gmail.com',
    'varunvashisth028@gmail.com'
];

const allUsers = db.queryAll('SELECT id, email FROM users');
for (const u of allUsers) {
    const email = (u.email || '').toLowerCase().trim();
    if (!authenticEmails.includes(email)) {
        db.execute('DELETE FROM portal_members WHERE user_id = ?', [u.id]);
        db.execute('DELETE FROM users WHERE id = ?', [u.id]);
        console.log(`✓ Removed sample/test user: ${u.email}`);
    }
}

// Clean invited_members
db.execute('DELETE FROM invited_members WHERE LOWER(email) NOT IN (?, ?, ?, ?)', authenticEmails);
console.log('✓ Cleaned sample invited members');

console.log('\n=== DATABASE PURGE COMPLETE: ZERO SAMPLE DATA REMAINS ===');
