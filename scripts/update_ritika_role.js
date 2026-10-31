const db = require('../src/db/database');
db.execute("UPDATE users SET role = 'employee' WHERE email = 'ritika@zoho.com'");
db.execute("UPDATE portal_members SET role = 'employee' WHERE user_id = (SELECT id FROM users WHERE email = 'ritika@zoho.com')");
console.log('Updated Ritika role to employee.');

