const db = require('./database');

function runMigrations() {
    const rawDb = db.getInstance();

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

    // Issues columns
    addColumnIfNotExists('issues', 'duplicate_of_issue_id', 'TEXT REFERENCES issues(id)');

    // Invoices columns
    addColumnIfNotExists('invoices', 'currency', "TEXT DEFAULT 'USD'");
    addColumnIfNotExists('invoices', 'tax_percentage', 'REAL DEFAULT 0.0');
    addColumnIfNotExists('invoices', 'paid_at', 'TEXT');
}

if (require.main === module) {
    runMigrations();
}

module.exports = runMigrations;
