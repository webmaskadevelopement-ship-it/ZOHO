const fs = require('fs');

let code = fs.readFileSync('src/public/app.js', 'utf8');

// 1. Add subscribeToUserData in DOMContentLoaded
const syncMountCode = `
    // Step 2 & 3: Auth-Gated Cross-Device Synchronization Engine
    if (window.firebaseAuthClient?.subscribeToUserData) {
        window.firebaseAuthClient.subscribeToUserData({
            onHydrated: (collectionsData, timestamp) => {
                console.log('[App Sync] Hydration event received:', collectionsData);
                if (collectionsData.projects && collectionsData.projects.length > 0) {
                    allProjectsCache = collectionsData.projects;
                    localStorage.setItem('life_pms_projects', JSON.stringify(allProjectsCache));
                    renderSidebarProjects();
                    loadAllProjectsTable();
                }
                if (collectionsData.tasks && collectionsData.tasks.length > 0) {
                    allTasksCache = collectionsData.tasks;
                    localStorage.setItem('life_pms_tasks', JSON.stringify(allTasksCache));
                    loadCurrentTaskView();
                }
                if (collectionsData.requests) {
                    allApprovalsCache = collectionsData.requests;
                    renderApprovalsTable();
                }
            },
            onDataUpdate: (colName, items, timestamp) => {
                console.log('[App Sync] Real-time update for ' + colName + ':', items.length);
                if (colName === 'projects') {
                    allProjectsCache = items;
                    localStorage.setItem('life_pms_projects', JSON.stringify(items));
                    renderSidebarProjects();
                    loadAllProjectsTable();
                } else if (colName === 'tasks') {
                    allTasksCache = items;
                    localStorage.setItem('life_pms_tasks', JSON.stringify(items));
                    loadCurrentTaskView();
                } else if (colName === 'requests') {
                    allApprovalsCache = items;
                    renderApprovalsTable();
                    syncNotificationBadge();
                }
            }
        });
    }
`;

if (!code.includes('subscribeToUserData({')) {
    code = code.replace("await loadInitialData();", "await loadInitialData();" + syncMountCode);
}

// 2. Ensure taskMap in loadTaskSheetView checks in-memory cache and falls back safely
const oldTaskMap = `    // Merge backend tasks with local tasks (deduplicate by id)
    const taskMap = new Map();
    localForProject.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });
    tasks.forEach(t => { if (t && t.id) taskMap.set(t.id, { ...taskMap.get(t.id), ...t }); });`;

const newTaskMap = `    // Merge backend tasks with local tasks and memory cache (deduplicate by id)
    const taskMap = new Map();
    allTasksCache.forEach(t => { if (t && t.id && (!t.projectId || !t.project_id || t.projectId === currentProjectId || t.project_id === currentProjectId)) taskMap.set(t.id, t); });
    localForProject.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });
    tasks.forEach(t => { if (t && t.id) taskMap.set(t.id, { ...taskMap.get(t.id), ...t }); });
    if (taskMap.size === 0 && allTasksCache.length > 0) {
        allTasksCache.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });
    }`;

if (code.includes(oldTaskMap)) {
    code = code.replace(oldTaskMap, newTaskMap);
}

// 3. Connect project creation to saveUserRecord
const oldProjSync = `if (window.firebaseAuthClient?.saveProjectToFirestore) {
                    window.firebaseAuthClient.saveProjectToFirestore(createdProj).catch(() => {});
                }`;

const newProjSync = `if (window.firebaseAuthClient?.saveUserRecord) {
                    window.firebaseAuthClient.saveUserRecord('projects', createdProj.id, createdProj).catch(() => {});
                } else if (window.firebaseAuthClient?.saveProjectToFirestore) {
                    window.firebaseAuthClient.saveProjectToFirestore(createdProj).catch(() => {});
                }`;

if (code.includes(oldProjSync)) {
    code = code.replace(oldProjSync, newProjSync);
}

// 4. Connect task creation to saveUserRecord
const oldTaskSync = `if (window.firebaseAuthClient?.saveTaskToFirestore) {
                window.firebaseAuthClient.saveTaskToFirestore(taskItem).catch(() => {});
            }`;

const newTaskSync = `if (window.firebaseAuthClient?.saveUserRecord) {
                window.firebaseAuthClient.saveUserRecord('tasks', taskItem.id, taskItem).catch(() => {});
            } else if (window.firebaseAuthClient?.saveTaskToFirestore) {
                window.firebaseAuthClient.saveTaskToFirestore(taskItem).catch(() => {});
            }`;

if (code.includes(oldTaskSync)) {
    code = code.replace(oldTaskSync, newTaskSync);
}

// 5. Connect issue creation to saveUserRecord
const oldIssueSync = `if (window.firebaseAuthClient?.saveIssueToFirestore) {
                window.firebaseAuthClient.saveIssueToFirestore(issueItem).catch(() => {});
            }`;

const newIssueSync = `if (window.firebaseAuthClient?.saveUserRecord) {
                window.firebaseAuthClient.saveUserRecord('issues', issueItem.id, issueItem).catch(() => {});
            } else if (window.firebaseAuthClient?.saveIssueToFirestore) {
                window.firebaseAuthClient.saveIssueToFirestore(issueItem).catch(() => {});
            }`;

if (code.includes(oldIssueSync)) {
    code = code.replace(oldIssueSync, newIssueSync);
}

fs.writeFileSync('src/public/app.js', code, 'utf8');
console.log('src/public/app.js patched successfully!');
