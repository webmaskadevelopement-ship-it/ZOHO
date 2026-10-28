const db = require('../src/db/database').getInstance();

console.log('--- PURGING ALL PENDING SAMPLE & DUMMY DATA ---');

// 1. Purge dummy user accounts
const dummyEmails = ['client.test@gmail.com'];
for (const email of dummyEmails) {
    const user = db.prepare('SELECT id, email FROM users WHERE LOWER(email) = ?').get(email.toLowerCase());
    if (user) {
        db.prepare('DELETE FROM portal_members WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
        console.log('✓ Removed dummy user:', email);
    }
}

// 2. Purge dummy submitted emails
const dummySubmissions = [
    'lead.prospect@acmecorp.com',
    'new.member.test@gmail.com'
];
for (const em of dummySubmissions) {
    const res = db.prepare('DELETE FROM submitted_emails WHERE LOWER(email) = ?').run(em.toLowerCase());
    if (res.changes > 0) console.log(`✓ Removed ${res.changes} dummy submission(s) for:`, em);
}

const corporateVisitors = db.prepare("DELETE FROM submitted_emails WHERE email LIKE '%@corporate.org'").run();
if (corporateVisitors.changes > 0) console.log(`✓ Removed ${corporateVisitors.changes} corporate.org visitor submissions.`);

// 3. Purge orphaned files and folders referencing non-existent projects
const deletedFiles = db.prepare('DELETE FROM files WHERE project_id NOT IN (SELECT id FROM projects)').run();
console.log(`✓ Removed ${deletedFiles.changes} orphaned files referencing deleted dummy projects.`);

const deletedFolders = db.prepare('DELETE FROM folders WHERE project_id NOT IN (SELECT id FROM projects)').run();
console.log(`✓ Removed ${deletedFolders.changes} orphaned folders referencing deleted dummy projects.`);

console.log('\n--- VERIFYING CLEAN STATE ---');
const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('Real Users remaining:', users);

const invites = db.prepare('SELECT id, name, email, role, status FROM invited_members').all();
console.log('Real Invites remaining:', invites);

const submissions = db.prepare('SELECT id, name, email FROM submitted_emails').all();
console.log('Real Submissions remaining:', submissions);

const projects = db.prepare('SELECT id, name FROM projects').all();
console.log('Projects remaining:', projects);

const tasks = db.prepare('SELECT id, name, prefix_key FROM tasks').all();
console.log('Tasks remaining:', tasks);

const files = db.prepare('SELECT count(*) as count FROM files').get();
console.log('Files count remaining:', files.count);
