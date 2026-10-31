const db = require('../src/db/database');

const groups = [
    { id: 'general', name: 'General', desc: 'Standard workspace projects', color: '#3B82F6' },
    { id: 'internal', name: 'Internal Operations', desc: 'Internal agency and operational projects', color: '#10B981' },
    { id: 'client', name: 'Client Workflows', desc: 'Client deliverable projects', color: '#8B5CF6' },
    { id: 'marketing', name: 'Marketing / Creative', desc: 'Creative and media projects', color: '#EC4899' },
    { id: 'engineering', name: 'Engineering & Development', desc: 'Software engineering projects', color: '#F59E0B' }
];

const now = new Date().toISOString();
for (const g of groups) {
    db.execute(
        `INSERT OR IGNORE INTO project_groups (id, portal_id, name, description, color, created_at)
         VALUES (?, 'portal-demo-zoho', ?, ?, ?, ?)`,
        [g.id, g.name, g.desc, g.color, now]
    );
}

const all = db.queryAll('SELECT * FROM project_groups');
console.log('Current project_groups:', all);

