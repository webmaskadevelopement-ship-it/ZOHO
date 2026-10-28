const db = require('../src/db/database');

const tables = db.queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
console.log('Tables to inspect:', tables.map(t => t.name));

const dummyPatterns = [
  'user-nikhil', 'user-dev', 'user-qa', 'user-admin', 'user-manager',
  'user-client', 'user-sarah', 'user-chloe', 'user-divyansh', 'user-ritika', 'user-webmaska',
  'lifepms.com', 'Alex Chen', 'Sarah Jenkins', 'Devon Vance', 'Quinn Adams', 'Chloe Stakeholder'
];

for (const t of tables) {
  const tableName = t.name;
  const cols = db.queryAll(`PRAGMA table_info(${tableName})`);
  const textCols = cols.filter(c => c.type.includes('TEXT') || c.type.includes('CHAR') || c.type === '').map(c => c.name);
  for (const c of textCols) {
    for (const pat of dummyPatterns) {
      try {
        const count = db.queryOne(`SELECT COUNT(*) as count FROM "${tableName}" WHERE "${c}" LIKE ?`, [`%${pat}%`]);
        if (count && count.count > 0) {
          console.log(`Found ${count.count} rows in [${tableName}].[${c}] matching: "${pat}"`);
        }
      } catch (err) {
        // ignore
      }
    }
  }
}
