const fs = require('fs');
const path = require('path');

// 1. Update tasks.controller.js
const ctrlPath = path.join(__dirname, '../src/modules/tasks/tasks.controller.js');
let ctrlContent = fs.readFileSync(ctrlPath, 'utf8');

ctrlContent = ctrlContent.replace(
    /if \(!payload\.taskListId \|\| !payload\.name\) \{\s*return res\.status\(400\)\.json\(\{ success: false, error: 'taskListId and name are required\.' \}\);\s*\}/,
    `if (!payload.name) {\n            return res.status(400).json({ success: false, error: 'Task name is required.' });\n        }`
);

ctrlContent = ctrlContent.replace(
    /if \(!projectId \|\| !taskListId \|\| !name\) \{\s*return res\.status\(400\)\.json\(\{ success: false, error: 'projectId, taskListId and name are required\.' \}\);\s*\}/,
    `if (!projectId || !name) {\n            return res.status(400).json({ success: false, error: 'projectId and name are required.' });\n        }`
);

fs.writeFileSync(ctrlPath, ctrlContent, 'utf8');
console.log('✓ Updated tasks.controller.js');

// 2. Update tasks.service.js to auto-create fallback task_list if none exists
const srvPath = path.join(__dirname, '../src/modules/tasks/tasks.service.js');
let srvContent = fs.readFileSync(srvPath, 'utf8');

const targetResolve = `            if (!finalTaskListId) {
                const defaultList = database.prepare('SELECT id, phase_id FROM task_lists WHERE project_id = ? ORDER BY sequence ASC LIMIT 1').get(projectId);
                if (defaultList) {
                    finalTaskListId = defaultList.id;
                    if (!finalPhaseId) finalPhaseId = defaultList.phase_id;
                }
            }`;

const replacementResolve = `            if (!finalTaskListId) {
                const defaultList = database.prepare('SELECT id, phase_id FROM task_lists WHERE project_id = ? ORDER BY sequence ASC LIMIT 1').get(projectId);
                if (defaultList) {
                    finalTaskListId = defaultList.id;
                    if (!finalPhaseId) finalPhaseId = defaultList.phase_id;
                } else {
                    finalTaskListId = uuidv4();
                    database.prepare(
                        \`INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
                         VALUES (?, ?, ?, NULL, 'General Tasks', 'internal', 1, ?, ?)\`
                    ).run(finalTaskListId, portalId, projectId, now, now);
                }
            }`;

if (srvContent.includes(targetResolve)) {
    srvContent = srvContent.replace(targetResolve, replacementResolve);
    console.log('✓ Updated tasks.service.js default task_list resolution');
} else {
    const norm = srvContent.replace(/\r\n/g, '\n');
    if (norm.includes(targetResolve)) {
        srvContent = norm.replace(targetResolve, replacementResolve);
        console.log('✓ Updated tasks.service.js (normalized CRLF)');
    } else {
        console.warn('⚠️ Could not find targetResolve in tasks.service.js');
    }
}

fs.writeFileSync(srvPath, srvContent, 'utf8');
console.log('Done.');

