/**
 * Script to purge all sample user IDs (user-nikhil, user-dev, user-admin, etc.)
 * and update names to authentic Zoho accounts across SQLite database.
 */

const db = require('../src/db/database');

const ADMIN_ID = 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac'; // Nikhil Kaushik (webmaskadevelopement@gmail.com)
const MANAGER_ID = '0e4352f0-b919-449a-b68a-2091efa145d4'; // Tushar (backend.webmaska@gmail.com)

console.log('🔄 Starting deep purge of sample data and IDs across SQLite database...');

// 1. Update user names
db.execute(`
    UPDATE users SET name = 'Nikhil Kaushik' WHERE id = ?;
`, [ADMIN_ID]);
db.execute(`
    UPDATE users SET name = 'Tushar' WHERE id = ?;
`, [MANAGER_ID]);

// 2. Update tasks table owner_ids
// Replace "user-nikhil" with real admin ID
const tasksNikhil = db.queryAll('SELECT id, owner_ids FROM tasks WHERE owner_ids LIKE ?', ['%user-nikhil%']);
console.log(`Updating ${tasksNikhil.length} tasks with owner user-nikhil -> Nikhil Kaushik (${ADMIN_ID})...`);
for (const t of tasksNikhil) {
    const updated = t.owner_ids.replace(/"user-nikhil"/g, `"${ADMIN_ID}"`);
    db.execute('UPDATE tasks SET owner_ids = ? WHERE id = ?', [updated, t.id]);
}

// Replace "user-dev" with real manager ID
const tasksDev = db.queryAll('SELECT id, owner_ids FROM tasks WHERE owner_ids LIKE ?', ['%user-dev%']);
console.log(`Updating ${tasksDev.length} tasks with owner user-dev -> Tushar (${MANAGER_ID})...`);
for (const t of tasksDev) {
    const updated = t.owner_ids.replace(/"user-dev"/g, `"${MANAGER_ID}"`);
    db.execute('UPDATE tasks SET owner_ids = ? WHERE id = ?', [updated, t.id]);
}

// 3. Update teams member_ids
const teams = db.queryAll('SELECT id, member_ids FROM teams');
for (const team of teams) {
    let updated = team.member_ids
        .replace(/"user-admin"/g, `"${ADMIN_ID}"`)
        .replace(/"user-nikhil"/g, `"${ADMIN_ID}"`)
        .replace(/"user-dev"/g, `"${MANAGER_ID}"`)
        .replace(/"user-manager"/g, `"${MANAGER_ID}"`)
        .replace(/"user-qa"/g, `"${ADMIN_ID}"`);
    db.execute('UPDATE teams SET member_ids = ? WHERE id = ?', [updated, team.id]);
}

// 4. Update time_logs
db.execute('UPDATE time_logs SET user_id = ? WHERE user_id = ? OR user_id = ?', [ADMIN_ID, 'user-nikhil', 'user-admin']);

// 5. Update files versions and annotations
db.execute(`UPDATE files SET versions = replace(versions, 'user-admin', '${ADMIN_ID}') WHERE versions LIKE '%user-admin%'`);
db.execute(`UPDATE files SET annotations = replace(annotations, 'user-admin', '${ADMIN_ID}') WHERE annotations LIKE '%user-admin%'`);

// 6. Update wiki_pages
db.execute('UPDATE wiki_pages SET last_edited_by = ? WHERE last_edited_by = ?', [ADMIN_ID, 'user-admin']);

// 7. Update task_reminders
db.execute('UPDATE task_reminders SET recipient_id = ? WHERE recipient_id = ?', [ADMIN_ID, 'user-admin']);

// 8. Update rate_cards
db.execute('UPDATE rate_cards SET user_id = ? WHERE user_id = ?', [ADMIN_ID, 'user-admin']);

// 9. Update proof_annotations
db.execute('UPDATE proof_annotations SET author_id = ? WHERE author_id = ?', [ADMIN_ID, 'user-admin']);

// 10. Update submitted_emails metadata
db.execute(`UPDATE submitted_emails SET metadata = replace(metadata, '"user-admin"', '"${ADMIN_ID}"') WHERE metadata LIKE '%user-admin%'`);

// 11. Update issues description_html
db.execute(`UPDATE issues SET description_html = replace(description_html, 'Devon Vance', 'Tushar') WHERE description_html LIKE '%Devon Vance%'`);

// 12. Update invoices items
db.execute(`UPDATE invoices SET items = replace(items, 'Devon Vance', 'Tushar') WHERE items LIKE '%Devon Vance%'`);

// 13. Delete dummy notifications
db.execute(`
    DELETE FROM notifications 
    WHERE message LIKE '%Alex Chen%' 
       OR message LIKE '%Sarah Jenkins%' 
       OR message LIKE '%Quinn Adams%' 
       OR message LIKE '%Devon Vance%'
`);

// 14. Delete temporary test projects if any
db.execute("DELETE FROM projects WHERE id = '0e1c5d51-0a1c-4aa2-9802-18ca7135a2d3' OR key_prefix = 'WE-99'");

console.log('✅ Deep purge of sample data and IDs completed successfully!');
