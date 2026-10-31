const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'modules', 'projects', 'projects.service.js');
let code = fs.readFileSync(filePath, 'utf8');

if (!code.includes("const CentralSyncService = require('../../services/centralSyncService');")) {
    code = code.replace(
        "const WbsRollupEngine = require('../../engines/wbsRollupEngine');",
        "const WbsRollupEngine = require('../../engines/wbsRollupEngine');\nconst CentralSyncService = require('../../services/centralSyncService');"
    );
}

if (!code.includes("CentralSyncService.syncProject(created);")) {
    code = code.replace(
        "return this.getProjectById(finalPortalId, id);",
        `const created = this.getProjectById(finalPortalId, id);\n            CentralSyncService.syncProject(created).catch(() => {});\n            return created;`
    );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('✓ Successfully patched projects.service.js with CentralSyncService');
