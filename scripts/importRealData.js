/**
 * Script to import real production data into Life PMS
 * Usage: node scripts/importRealData.js [optional_path_to_json]
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/db/database');
const DataIngestionService = require('../src/services/dataIngestionService');

async function run() {
    console.log('================================================================');
    console.log('📦 Life PMS - Real Production Data Importer');
    console.log('================================================================');

    const defaultPath = path.resolve(__dirname, '../data/templates/real_data_template.json');
    const targetFile = process.argv[2] || defaultPath;

    if (!fs.existsSync(targetFile)) {
        console.error(`❌ Error: Template file not found at ${targetFile}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(targetFile, 'utf8');
    const payload = JSON.parse(rawData);

    // Get default portal
    const database = db.getInstance();
    const portal = database.prepare("SELECT id FROM portals WHERE slug = 'acme' OR id = 'portal-demo-zoho' LIMIT 1").get();
    const portalId = portal ? portal.id : 'portal-demo-zoho';

    console.log(`📡 Ingesting into portal: ${portalId}`);
    console.log(`📄 Source file: ${targetFile}`);

    try {
        const results = await DataIngestionService.ingestPayload(portalId, payload);
        console.log('✅ Real data ingestion complete:');
        console.log(`   - Users Ingested:      ${results.usersCreated}`);
        console.log(`   - Projects Ingested:   ${results.projectsCreated}`);
        console.log(`   - Phases Ingested:     ${results.phasesCreated}`);
        console.log(`   - Task Lists Ingested: ${results.taskListsCreated}`);
        console.log(`   - Tasks Ingested:      ${results.tasksCreated}`);
        console.log(`   - Issues Ingested:     ${results.issuesCreated}`);
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('❌ Data Ingestion failed:', err.message);
        process.exit(1);
    }
}

run();
