const fs = require('fs');

let c = fs.readFileSync('src/modules/projects/projects.controller.js', 'utf8');

// Allow all authenticated roles to create projects and project groups
c = c.replace(
    "router.post('/', requireRole(['admin', 'manager']),",
    "router.post('/', requireRole(['admin', 'manager', 'employee', 'member', 'client']),"
);

c = c.replace(
    "router.post('/groups', requireRole(['admin', 'manager']),",
    "router.post('/groups', requireRole(['admin', 'manager', 'employee', 'member', 'client']),"
);

c = c.replace(
    "router.put('/:id', requireRole(['admin', 'manager']),",
    "router.put('/:id', requireRole(['admin', 'manager', 'employee', 'member', 'client']),"
);

fs.writeFileSync('src/modules/projects/projects.controller.js', c, 'utf8');
console.log('✓ Successfully updated projects.controller.js to allow all roles to create projects');

