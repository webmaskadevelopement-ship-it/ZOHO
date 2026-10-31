const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/public/app.js');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    "if (inviteBtn) inviteBtn.style.display = (isClient || isEmployee) ? 'none' : 'flex';",
    "if (inviteBtn) inviteBtn.style.display = isClient ? 'none' : 'flex';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Updated applyRoleGuards to keep Invite button visible and active for employees');

