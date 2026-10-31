const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/public/app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Patch loadTaskSheetView
const targetSheet = `async function loadTaskSheetView() {
    const [res, tlRes] = await Promise.all([
        apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\${currentTasksFilter === 'my' ? '?my=true' : ''}\`),`;

const replacementSheet = `async function loadTaskSheetView() {
    if (!currentProjectId) {
        currentProjectId = sessionStorage.getItem('life_pms_project_id') || allProjectsCache[0]?.id || '';
    }
    if (!currentProjectId && allProjectsCache.length === 0) {
        await loadProjectsList();
        if (allProjectsCache.length > 0) {
            currentProjectId = allProjectsCache[0].id;
        }
    }
    updateNavbarProjectName();

    const tbody = document.getElementById('taskSheetTbody');
    const totalCountEl = document.getElementById('taskSheetTotalCount');

    if (!currentProjectId) {
        if (totalCountEl) totalCountEl.innerHTML = '<span>Total Count : <strong style="color:var(--text-primary); margin-left:4px;">0</strong></span>';
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 28px; color: var(--text-secondary);">No project selected. Click <strong>+ New Project</strong> or select a project from the sidebar to view tasks.</td></tr>';
        return;
    }

    const [res, tlRes] = await Promise.all([
        apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\${currentTasksFilter === 'my' ? '?my=true' : ''}\`),`;

if (content.includes(targetSheet)) {
    content = content.replace(targetSheet, replacementSheet);
    console.log('✓ Patched loadTaskSheetView');
} else {
    // Try with CRLF normalized
    const normContent = content.replace(/\r\n/g, '\n');
    if (normContent.includes(targetSheet)) {
        content = normContent.replace(targetSheet, replacementSheet);
        console.log('✓ Patched loadTaskSheetView (normalized CRLF)');
    } else {
        console.warn('⚠️ Could not find targetSheet in app.js');
    }
}

// 2. Patch setupAddTaskModal newTaskProject change listener
const targetProjChange = `            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }`;

const replacementProjChange = `            projSelect.innerHTML = allProjectsCache.map(p =>
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

if (content.includes(targetProjChange)) {
    content = content.replace(targetProjChange, replacementProjChange);
    console.log('✓ Patched newTaskProject change listener');
} else {
    console.warn('⚠️ Could not find targetProjChange in app.js');
}

// 3. Patch setupAddTaskModal submit handler to sync currentProjectId
const targetTaskSubmit = `        const res = await apiFetch(\`/api/v1/tasks/project/\${projId}\`, {`;
const replacementTaskSubmit = `        currentProjectId = projId;
        sessionStorage.setItem('life_pms_project_id', currentProjectId);
        updateNavbarProjectName();

        const res = await apiFetch(\`/api/v1/tasks/project/\${projId}\`, {`;

if (content.includes(targetTaskSubmit)) {
    content = content.replace(targetTaskSubmit, replacementTaskSubmit);
    console.log('✓ Patched setupAddTaskModal submit handler');
} else {
    console.warn('⚠️ Could not find targetTaskSubmit in app.js');
}

// 4. Patch handleRespondRequest to call loadCurrentTaskView
const targetRespond = `if (typeof loadTasksView === 'function') await loadTasksView();`;
const replacementRespond = `if (typeof loadCurrentTaskView === 'function') await loadCurrentTaskView();`;

if (content.includes(targetRespond)) {
    content = content.replace(targetRespond, replacementRespond);
    console.log('✓ Patched handleRespondRequest loadCurrentTaskView');
} else {
    console.warn('⚠️ Could not find targetRespond in app.js');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All patches written to src/public/app.js.');

