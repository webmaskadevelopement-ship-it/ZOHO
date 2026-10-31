const db = require('../src/db/database');

const nonPdfEmails = [
    'ritikasharma49527@gmail.com',
    'varunvashisth028@gmail.com',
    'webmaskafilms@gmail.com'
];

console.log('Removing non-PDF users...');
for (const email of nonPdfEmails) {
    const user = db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (user) {
        db.execute('DELETE FROM portal_members WHERE user_id = ?', [user.id]);
        db.execute('DELETE FROM users WHERE id = ?', [user.id]);
        console.log(`Deleted user ${email}`);
    }
}

const remaining = db.queryAll('SELECT id, name, username, email, role, department FROM users');
console.log('Final remaining users in database (Total ' + remaining.length + '):');
remaining.forEach(u => console.log(`- ${u.name} (@${u.username}) <${u.email}> [${u.role}]`));

