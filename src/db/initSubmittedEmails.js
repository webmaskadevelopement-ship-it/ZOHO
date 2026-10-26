const db = require('./database');

function initSubmittedEmailsTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS submitted_emails (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT,
            role TEXT DEFAULT 'employee',
            source TEXT NOT NULL,
            portal_id TEXT,
            metadata TEXT,
            firebase_synced INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_submitted_emails_email ON submitted_emails(email);
        CREATE INDEX IF NOT EXISTS idx_submitted_emails_created_at ON submitted_emails(created_at);
    `);
    console.log('[Database] submitted_emails table verified.');
}

if (require.main === module) {
    initSubmittedEmailsTable();
}

module.exports = { initSubmittedEmailsTable };
