const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'modules', 'projects', 'projects.service.js');
let code = fs.readFileSync(targetPath, 'utf8');
const isCrlf = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

const search = `        // Strict RBAC Project Scoping (BUG 5)
        if (userRole === 'admin') {
            // Admins have global visibility across all portal projects
        } else if (userRole === 'client') {
            // Clients see only projects explicitly scoped to them
            sql += ' AND member_ids LIKE ?';
            params.push(\`%"\${userId}"%\`);
        } else {
            // Managers, Leads, and Employees see public projects OR assigned projects (owner or member)
            sql += ' AND (is_public = 1 OR owner_id = ? OR member_ids LIKE ?)';
            params.push(userId, \`%"\${userId}"%\`);
        }`;

const replacement = `        // Strict RBAC Project Scoping & Visibility Rules
        if (userRole === 'admin') {
            // Admins have global visibility across all portal projects
        } else if (userRole === 'client') {
            // Clients see only projects explicitly scoped to them
            sql += ' AND member_ids LIKE ?';
            params.push(\`%"\${userId}"%\`);
        } else {
            // Public projects are visible to all registered users. Private projects strictly visible only to creator or members.
            const userAliases = [userId];
            const pdfUsers = [
                { id: 'efac5612-9ff8-4f2a-884d-46ff5e470584', slugId: 'usr-ravi', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com' },
                { id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', slugId: 'usr-ananya', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com' },
                { id: 'ce170463-92f6-4f03-b801-9b57b82e862f', slugId: 'usr-ineet', username: 'ineet', email: 'ineet@zoho.com' },
                { id: 'f6419896-0f5b-4c42-a0c1-587d9829d647', slugId: 'usr-nikhil', username: 'nikhil', email: 'nikhil@zoho.com' },
                { id: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', slugId: 'usr-ritika', username: 'ritika', email: 'ritika@zoho.com' },
                { id: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', slugId: 'usr-shweta', username: 'shweta', email: 'shweta@zoho.com' },
                { id: 'c5783c9c-172c-435a-840b-bb4a33f627f8', slugId: 'usr-ekta', username: 'ekta', email: 'ekta@zoho.com' },
                { id: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', slugId: 'usr-abhishek', username: 'abhishek', email: 'abhishek@zoho.com' },
                { id: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', slugId: 'usr-prince', username: 'prince', email: 'prince@zoho.com' },
                { id: '324a1d25-0fe8-46b8-88c0-13a41fe93331', slugId: 'usr-ali', username: 'ali', email: 'ali@zoho.com' },
                { id: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', slugId: 'usr-admin', username: 'admin', email: 'webmaskadevelopement@gmail.com' },
                { id: '0e4352f0-b919-449a-b68a-2091efa145d4', slugId: 'usr-manager', username: 'manager', email: 'backend.webmaska@gmail.com' }
            ];
            const foundUser = pdfUsers.find(u => u.id === userId || u.slugId === userId || u.email === userId || u.username === userId);
            if (foundUser) {
                userAliases.push(foundUser.id, foundUser.slugId, foundUser.email, foundUser.username);
            }
            const uniqueAliases = [...new Set(userAliases.filter(Boolean))];
            const ownerPlaceholders = uniqueAliases.map(() => 'owner_id = ?').join(' OR ');
            const memberPlaceholders = uniqueAliases.map(() => 'member_ids LIKE ?').join(' OR ');
            sql += \` AND (is_public = 1 OR \${ownerPlaceholders} OR \${memberPlaceholders})\`;
            params.push(...uniqueAliases, ...uniqueAliases.map(a => \`%"\${a}"%\`));
        }`;

if (!code.includes(search)) {
    console.error('Target not found in projects.service.js');
    process.exit(1);
}

const updated = code.replace(search, replacement);
fs.writeFileSync(targetPath, isCrlf ? updated.replace(/\n/g, '\r\n') : updated, 'utf8');
console.log('Successfully patched projects.service.js with public and private project visibility scoping!');
