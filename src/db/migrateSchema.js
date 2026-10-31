const db = require('./database');

function runMigrations(providedDb) {
    const rawDb = providedDb || db.getInstance();
    // instance resolved above

    // Helper to safely add column if not exists
    function addColumnIfNotExists(table, column, colDef) {
        try {
            const tableInfo = rawDb.prepare(`PRAGMA table_info(${table})`).all();
            const exists = tableInfo.some(col => col.name === column);
            if (!exists) {
                rawDb.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef};`);
                console.log(`[Migration] Added column ${column} to ${table}`);
            }
        } catch (e) {
            console.error(`[Migration Error] adding ${column} to ${table}:`, e.message);
        }
    }

    // Projects columns
    addColumnIfNotExists('projects', 'color', "TEXT DEFAULT '#3B82F6'");
    addColumnIfNotExists('projects', 'template_id', 'TEXT');

    // Phases columns
    addColumnIfNotExists('phases', 'budget_allocated_hours', 'REAL DEFAULT 0.0');

    // Tasks columns
    addColumnIfNotExists('tasks', 'embedding_vector', "TEXT DEFAULT '[]'");
    addColumnIfNotExists('tasks', 'is_on_critical_path', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('tasks', 'associated_team', "TEXT DEFAULT ''");
    addColumnIfNotExists('tasks', 'work_hours', "TEXT DEFAULT '00:00'");
    addColumnIfNotExists('tasks', 'reminder', "TEXT DEFAULT 'None'");
    addColumnIfNotExists('tasks', 'assignee_id', 'TEXT');

    // Issues columns
    addColumnIfNotExists('issues', 'duplicate_of_issue_id', 'TEXT REFERENCES issues(id)');

    // Invoices columns
    addColumnIfNotExists('invoices', 'currency', "TEXT DEFAULT 'USD'");
    addColumnIfNotExists('invoices', 'tax_percentage', 'REAL DEFAULT 0.0');
    addColumnIfNotExists('invoices', 'paid_at', 'TEXT');

    // Invited Members columns
    addColumnIfNotExists('invited_members', 'token', 'TEXT');
    addColumnIfNotExists('invited_members', 'token_hash', 'TEXT');
    addColumnIfNotExists('invited_members', 'expires_at', 'TEXT');
    addColumnIfNotExists('invited_members', 'accepted_at', 'TEXT');
    addColumnIfNotExists('invited_members', 'project_id', 'TEXT');

    // Users columns
    addColumnIfNotExists('users', 'username', 'TEXT');
    addColumnIfNotExists('users', 'bio', 'TEXT');
    addColumnIfNotExists('users', 'phone', 'TEXT');

    // In-App Requests and User Connections Tables
    try {
        rawDb.exec(`
            CREATE TABLE IF NOT EXISTS in_app_requests (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                request_type TEXT NOT NULL CHECK(request_type IN (
                  'USER_CONNECTION',
                  'PROJECT_INVITE',
                  'TASK_HANDOFF',
                  'TEAM_INVITE',
                  'APPROVAL_REQUEST'
                )),
                target_entity_id TEXT,
                payload_json TEXT DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                responded_at DATETIME,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_requests_receiver_status ON in_app_requests(receiver_id, status);
            CREATE INDEX IF NOT EXISTS idx_requests_sender ON in_app_requests(sender_id);

            CREATE TABLE IF NOT EXISTS user_connections (
                user_id TEXT NOT NULL,
                connected_user_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, connected_user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (connected_user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_user_connections_lookup ON user_connections(user_id, connected_user_id);
        `);
        console.log('[Migration] Ensured in_app_requests and user_connections tables exist.');
    } catch (tblErr) {
        console.error('[Migration Error] creating in_app_requests / user_connections:', tblErr.message);
    }

    // Ensure default project groups exist in project_groups
    try {
        const now = new Date().toISOString();
        const groups = [
            { id: 'general', name: 'General', desc: 'Standard workspace projects', color: '#3B82F6' },
            { id: 'internal', name: 'Internal Operations', desc: 'Internal agency and operational projects', color: '#10B981' },
            { id: 'client', name: 'Client Workflows', desc: 'Client deliverable projects', color: '#8B5CF6' },
            { id: 'marketing', name: 'Marketing / Creative', desc: 'Creative and media projects', color: '#EC4899' },
            { id: 'engineering', name: 'Engineering & Development', desc: 'Software engineering projects', color: '#F59E0B' }
        ];
        const insertGroup = rawDb.prepare(`
            INSERT OR IGNORE INTO project_groups (id, portal_id, name, description, color, created_at)
            VALUES (?, 'portal-demo-zoho', ?, ?, ?, ?)
        `);
        for (const g of groups) {
            insertGroup.run(g.id, g.name, g.desc, g.color, now);
        }
    } catch (gErr) {
        console.warn('[Migration Warning] project_groups setup:', gErr.message);
    }

    // Backfill token_hash for existing tokens
    try {
        const crypto = require('crypto');
        const rows = rawDb.prepare("SELECT id, token FROM invited_members WHERE token_hash IS NULL AND token IS NOT NULL").all();
        if (rows && rows.length > 0) {
            const updateStmt = rawDb.prepare("UPDATE invited_members SET token_hash = ? WHERE id = ?");
            for (const row of rows) {
                const hash = crypto.createHash('sha256').update(row.token).digest('hex');
                updateStmt.run(hash, row.id);
            }
            console.log(`[Migration] Backfilled SHA-256 token_hash for ${rows.length} invitations.`);
        }
    } catch (hashErr) {
        console.warn('[Migration Warning] Backfilling token_hash:', hashErr.message);
    }
}

if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
