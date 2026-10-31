const db = require('../src/db/database');

const tablesToPurge = [
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
    'sla_breach_logs'
];

console.log('Purging test records and ensuring zero sample data...');
for (const tbl of tablesToPurge) {
    try {
        db.execute(`DELETE FROM "${tbl}"`);
        console.log(`✓ Purged table: ${tbl}`);
    } catch (e) {
        console.warn(`! Note on ${tbl}: ${e.message}`);
    }
}

// Verify users table contains ONLY authorized PDF users + admin/manager
const users = db.queryAll('SELECT id, name, username, email, role FROM users ORDER BY name ASC');
console.log(`\nRemaining Users (Total ${users.length}):`);
users.forEach(u => console.log(`- ${u.name} (@${u.username}) <${u.email}> [${u.role}]`));

// Verify 0 projects, 0 tasks, 0 issues
const pCount = db.queryOne('SELECT COUNT(*) as c FROM projects').c;
const tCount = db.queryOne('SELECT COUNT(*) as c FROM tasks').c;
const iCount = db.queryOne('SELECT COUNT(*) as c FROM issues').c;
const rCount = db.queryOne('SELECT COUNT(*) as c FROM in_app_requests').c;

console.log(`\nSample Data Check:`);
console.log(`- Projects: ${pCount}`);
console.log(`- Tasks: ${tCount}`);
console.log(`- Issues: ${iCount}`);
console.log(`- Requests: ${rCount}`);

if (pCount === 0 && tCount === 0 && iCount === 0 && rCount === 0) {
    console.log('\n✓ Clean database ready: ZERO sample data. Ready for user input.');
} else {
    console.error('\n❌ Warning: some sample data remains.');
}
