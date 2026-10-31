const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(appPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Update loadProjectIssues to merge backend and local issues
const oldLoadProjectIssues = `async function loadProjectIssues() {
    let url = \`/api/v1/issues/project/\${currentProjectId}\`;
    if (currentIssuesFilter === 'blocker') {
        url += '?severity=blocker';
    } else if (currentIssuesFilter === 'open') {
        url += '?statusId=open';
    } else if (currentIssuesFilter === 'closed') {
        url += '?statusId=closed';
    }
    const res = await apiFetch(url);
    const issues = res.data || [];
    allIssuesCache = issues;`;

const newLoadProjectIssues = `async function loadProjectIssues() {
    let url = \`/api/v1/issues/project/\${currentProjectId}\`;
    if (currentIssuesFilter === 'blocker') {
        url += '?severity=blocker';
    } else if (currentIssuesFilter === 'open') {
        url += '?statusId=open';
    } else if (currentIssuesFilter === 'closed') {
        url += '?statusId=closed';
    }
    const res = await apiFetch(url);
    let issues = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];
    const localIssues = JSON.parse(localStorage.getItem('life_pms_issues') || '[]');
    const localForProject = localIssues.filter(i => !i.projectId || !i.project_id || i.projectId === currentProjectId || i.project_id === currentProjectId);

    const issueMap = new Map();
    localForProject.forEach(i => { if (i && i.id) issueMap.set(i.id, i); });
    issues.forEach(i => { if (i && i.id) issueMap.set(i.id, { ...issueMap.get(i.id), ...i }); });

    issues = Array.from(issueMap.values());
    allIssuesCache = issues;`;

if (code.includes(oldLoadProjectIssues)) {
    code = code.replace(oldLoadProjectIssues, newLoadProjectIssues);
    console.log('✓ Patched loadProjectIssues to merge issues');
}

// 2. Update setupAddIssueModal to immediately store issue
const oldAddIssueSuccess = `        if (res.success) {
            closeModal('modalAddIssue');
            document.getElementById('newIssueTitle').value = '';
            document.getElementById('newIssueDescription').value = '';
            await loadProjectIssues();
            await loadGlobalDashboardStats();
        }`;

const newAddIssueSuccess = `        if (res.success) {
            closeModal('modalAddIssue');
            document.getElementById('newIssueTitle').value = '';
            document.getElementById('newIssueDescription').value = '';

            const issueItem = res.data || {
                id: 'issue-' + Date.now().toString(36),
                projectId: projId,
                project_id: projId,
                title,
                severity,
                classification,
                description,
                status: 'open',
                prefix_key: 'BUG-' + (allIssuesCache.length + 101),
                created_at: new Date().toISOString()
            };

            let localIssues = JSON.parse(localStorage.getItem('life_pms_issues') || '[]');
            localIssues = localIssues.filter(i => i.id !== issueItem.id);
            localIssues.unshift(issueItem);
            localStorage.setItem('life_pms_issues', JSON.stringify(localIssues));

            allIssuesCache = allIssuesCache.filter(i => i.id !== issueItem.id);
            allIssuesCache.unshift(issueItem);

            await loadProjectIssues();
            await loadGlobalDashboardStats();
            alert(\`✓ Bug report "\${title}" submitted successfully!\`);
        }`;

if (code.includes(oldAddIssueSuccess)) {
    code = code.replace(oldAddIssueSuccess, newAddIssueSuccess);
    console.log('✓ Patched setupAddIssueModal to immediately store issue');
}

// 3. Update loadProjectPhasesSheet to merge backend and local phases
const oldLoadPhases = `async function loadProjectPhasesSheet(projectId) {
    const res = await apiFetch(\`/api/v1/phases/project/\${projectId}\`);
    const phases = res.data || [];
    allPhasesCache = phases;`;

const newLoadPhases = `async function loadProjectPhasesSheet(projectId) {
    const res = await apiFetch(\`/api/v1/phases/project/\${projectId}\`);
    let phases = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];
    const localPhases = JSON.parse(localStorage.getItem('life_pms_phases') || '[]');
    const localForProject = localPhases.filter(p => !p.projectId || !p.project_id || p.projectId === projectId || p.project_id === projectId);

    const phaseMap = new Map();
    localForProject.forEach(p => { if (p && p.id) phaseMap.set(p.id, p); });
    phases.forEach(p => { if (p && p.id) phaseMap.set(p.id, { ...phaseMap.get(p.id), ...p }); });

    phases = Array.from(phaseMap.values());
    allPhasesCache = phases;`;

if (code.includes(oldLoadPhases)) {
    code = code.replace(oldLoadPhases, newLoadPhases);
    console.log('✓ Patched loadProjectPhasesSheet to merge phases');
}

// 4. Update setupAddPhaseModal to immediately store phase
const oldAddPhaseSuccess = `        if (res.success) {
            closeModal('modalAddPhase');
            document.getElementById('newPhaseName').value = '';
            document.getElementById('newPhaseDescription').value = '';
            await loadProjectPhasesSheet(currentProjectId);
            await loadGlobalDashboardStats();
        }`;

const newAddPhaseSuccess = `        if (res.success) {
            closeModal('modalAddPhase');
            document.getElementById('newPhaseName').value = '';
            document.getElementById('newPhaseDescription').value = '';

            const phaseItem = res.data || {
                id: 'phase-' + Date.now().toString(36),
                projectId: currentProjectId,
                project_id: currentProjectId,
                name,
                description,
                start_date: startDate,
                end_date: endDate,
                budget,
                flag,
                status: 'open',
                created_at: new Date().toISOString()
            };

            let localPhases = JSON.parse(localStorage.getItem('life_pms_phases') || '[]');
            localPhases = localPhases.filter(p => p.id !== phaseItem.id);
            localPhases.unshift(phaseItem);
            localStorage.setItem('life_pms_phases', JSON.stringify(localPhases));

            allPhasesCache = allPhasesCache.filter(p => p.id !== phaseItem.id);
            allPhasesCache.unshift(phaseItem);

            await loadProjectPhasesSheet(currentProjectId);
            await loadGlobalDashboardStats();
            alert(\`✓ Phase "\${name}" created successfully!\`);
        }`;

if (code.includes(oldAddPhaseSuccess)) {
    code = code.replace(oldAddPhaseSuccess, newAddPhaseSuccess);
    console.log('✓ Patched setupAddPhaseModal to immediately store phase');
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(appPath, code, 'utf8');
console.log('Done.');
