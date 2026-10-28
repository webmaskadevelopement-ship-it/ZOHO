const db = require('./database');

function initInvitedMembers() {
    db.execute(`
        CREATE TABLE IF NOT EXISTS invited_members (
            id TEXT PRIMARY KEY,
            portal_id TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            status TEXT NOT NULL DEFAULT 'pending',
            invited_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    // Clean bootstrap: no dummy/sample invites are seeded.
    // Legitimate invites are managed dynamically by workspace administrators.
}

if (require.main === module) {
    initInvitedMembers();
}

module.exports = { initInvitedMembers };
