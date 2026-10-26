const db = require('./database');

function initInvitedMembers() {
    db.execute(`
        CREATE TABLE IF NOT EXISTS invited_members (
            id TEXT PRIMARY KEY,
            portal_id TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            status TEXT NOT NULL DEFAULT 'pending',
            invited_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    const now = new Date().toISOString();
    const invites = [
        { id: 'inv-1', email: 'jordan.lee@lifepms.com', name: 'Jordan Lee', role: 'employee' },
        { id: 'inv-2', email: 'sam.taylor@lifepms.com', name: 'Sam Taylor', role: 'manager' },
        { id: 'inv-3', email: 'divyansh.verma@lifepms.com', name: 'Divyansh Verma', role: 'admin' },
        { id: 'inv-4', email: 'ritikasharma49527@gmail.com', name: 'Ritika Sharma', role: 'employee' },
        { id: 'inv-5', email: 'backend.webmaska@gmail.com', name: 'Backend Webmaska', role: 'employee' }
    ];

    for (const inv of invites) {
        db.execute(`
            INSERT OR IGNORE INTO invited_members (id, portal_id, email, name, role, status, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', ?, ?, ?, 'pending', ?, ?)
        `, [inv.id, inv.email.toLowerCase(), inv.name, inv.role, now, now]);
    }

    // Initialized invited members
}

if (require.main === module) {
    initInvitedMembers();
}

module.exports = { initInvitedMembers };
