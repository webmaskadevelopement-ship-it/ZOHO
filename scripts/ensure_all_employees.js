const db = require('../src/db/database');
db.execute("UPDATE users SET role = 'employee' WHERE email LIKE '%@zoho.com'");
db.execute("UPDATE portal_members SET role = 'employee' WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@zoho.com')");
console.log('All 10 PDF team members set to role: employee');

