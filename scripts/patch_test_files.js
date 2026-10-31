const fs = require('fs');
const path = require('path');

const emailTestFile = path.join(__dirname, '..', 'tests', 'email_sharing.test.js');
let emailCode = fs.readFileSync(emailTestFile, 'utf8');
emailCode = emailCode.replace(
    'let proj = db.queryOne("SELECT id FROM projects LIMIT 1");',
    'let proj = db.queryOne("SELECT id FROM projects WHERE owner_id = ? LIMIT 1", [adminUser.id]);'
);
fs.writeFileSync(emailTestFile, emailCode, 'utf8');
console.log('✓ Patched email_sharing.test.js');
