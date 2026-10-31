const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/public/app.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix setupAddIssueModal
const wrongIssueBlock = `        if (projSelect && allProjectsCache.length > 0) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');

            projSelect.onchange = async () => {
                const selPid = projSelect.value;
                const tlSelect = document.getElementById('newTaskListSelect');
                if (selPid && tlSelect) {
                    try {
                        const tlRes = await apiFetch(\`/api/v1/task-lists/project/\${selPid}\`);
                        if (tlRes.success && tlRes.data && tlRes.data.length > 0) {
                            tlSelect.innerHTML = tlRes.data.map(tl => \`<option value="\${tl.id}">\${escapeHtml(tl.name)}</option>\`).join('');
                        }
                    } catch (e) {}
                }
            };
        }`;

const rightIssueBlock = `        if (projSelect && allProjectsCache.length > 0) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }`;

if (content.includes(wrongIssueBlock)) {
    content = content.replace(wrongIssueBlock, rightIssueBlock);
    console.log('✓ Cleaned up setupAddIssueModal');
}

// Add to setupAddTaskModal
const targetAddTaskProj = `        const projSelect = document.getElementById('newTaskProject');
        if (projSelect) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }`;

const replacementAddTaskProj = `        const projSelect = document.getElementById('newTaskProject');
        if (projSelect) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');

            projSelect.onchange = async () => {
                const selPid = projSelect.value;
                const tlSelect = document.getElementById('newTaskListSelect');
                if (selPid && tlSelect) {
                    try {
                        const tlRes = await apiFetch(\`/api/v1/task-lists/project/\${selPid}\`);
                        if (tlRes.success && tlRes.data && tlRes.data.length > 0) {
                            tlSelect.innerHTML = tlRes.data.map(tl => \`<option value="\${tl.id}">\${escapeHtml(tl.name)}</option>\`).join('');
                        }
                    } catch (e) {}
                }
            };
        }`;

if (content.includes(targetAddTaskProj)) {
    content = content.replace(targetAddTaskProj, replacementAddTaskProj);
    console.log('✓ Added onchange to setupAddTaskModal');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');

