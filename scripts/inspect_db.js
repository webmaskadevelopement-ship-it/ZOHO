const db = require('../src/db/database');

const tables = db.queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
console.log('Tables in database:');
for (const t of tables) {
    const count = db.queryOne(`SELECT count(*) as c FROM "${t.name}"`).c;
    console.log(`- ${t.name}: ${count} rows`);
}
