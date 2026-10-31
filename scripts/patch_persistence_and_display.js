const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(appPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Update loadProjectsList to merge backend and local storage
const oldLoadProjectsList = `async function loadProjectsList() {
    try {
        const res = await apiFetch('/api/v1/projects');
        if (res.success && res.data) {
            allProjectsCache = res.data;

            // If empty locally, attempt fetch from Firestore collection "projects"
            if ((!allProjectsCache || allProjectsCache.length === 0) && window.firebaseAuthClient?.fetchProjectsFromFirestore) {
                try {
                    const fbProjs = await window.firebaseAuthClient.fetchProjectsFromFirestore();
                    if (fbProjs && fbProjs.length > 0) {
                        allProjectsCache = fbProjs;
                        localStorage.setItem('life_pms_projects', JSON.stringify(allProjectsCache));
                    }
                } catch (e) {}
            } else if (allProjectsCache.length > 0 && window.firebaseAuthClient?.saveProjectToFirestore) {
                // Ensure projects are synced to Firestore
                allProjectsCache.forEach(p => window.firebaseAuthClient.saveProjectToFirestore(p).catch(() => {}));
            }

            const savedProjectId = sessionStorage.getItem('life_pms_project_id');
            if (savedProjectId && allProjectsCache.some(p => p.id === savedProjectId)) {
                currentProjectId = savedProjectId;
            } else if (allProjectsCache.length > 0 && !allProjectsCache.some(p => p.id === currentProjectId)) {
                currentProjectId = allProjectsCache[0].id;
            }
            renderSidebarProjects();
            updateNavbarProjectName();
            loadAllProjectsTable();
        }
    } catch (err) {
        console.error('Failed to load projects list:', err);
    }
}`;

const newLoadProjectsList = `async function loadProjectsList() {
    try {
        const res = await apiFetch('/api/v1/projects');
        let projs = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];
        const localProjs = JSON.parse(localStorage.getItem('life_pms_projects') || '[]');

        // Merge backend projects with locally stored projects (deduplicate by id)
        const projectMap = new Map();
        localProjs.forEach(p => { if (p && p.id) projectMap.set(p.id, p); });
        projs.forEach(p => { if (p && p.id) projectMap.set(p.id, { ...projectMap.get(p.id), ...p }); });

        let merged = Array.from(projectMap.values());

        // If empty, attempt fetch from Firestore collection "projects"
        if (merged.length === 0 && window.firebaseAuthClient?.fetchProjectsFromFirestore) {
            try {
                const fbProjs = await window.firebaseAuthClient.fetchProjectsFromFirestore();
                if (fbProjs && fbProjs.length > 0) {
                    fbProjs.forEach(p => { if (p && p.id) projectMap.set(p.id, p); });
                    merged = Array.from(projectMap.values());
                }
            } catch (e) {}
        }

        // Apply user scoping for non-admin users
        if (currentUser && currentUser.role !== 'admin') {
            const myId = currentUser.id;
            const myEmail = currentUser.email;
            merged = merged.filter(p => {
                const isPublic = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                const isOwner = p.owner_id === myId || p.ownerId === myId || p.owner_email === myEmail;
                let members = [];
                try {
                    members = Array.isArray(p.member_ids) ? p.member_ids : (typeof p.member_ids === 'string' ? JSON.parse(p.member_ids || '[]') : []);
                } catch (e) { members = []; }
                const isMember = members.includes(myId) || members.includes(myEmail);
                return isPublic || isOwner || isMember;
            });
        }

        allProjectsCache = merged;
        localStorage.setItem('life_pms_projects', JSON.stringify(merged));

        const savedProjectId = sessionStorage.getItem('life_pms_project_id');
        if (savedProjectId && allProjectsCache.some(p => p.id === savedProjectId)) {
            currentProjectId = savedProjectId;
        } else if (allProjectsCache.length > 0 && !allProjectsCache.some(p => p.id === currentProjectId)) {
            currentProjectId = allProjectsCache[0].id;
        }
        renderSidebarProjects();
        updateNavbarProjectName();
        loadAllProjectsTable();
    } catch (err) {
        console.error('Failed to load projects list:', err);
    }
}`;

if (code.includes(oldLoadProjectsList)) {
    code = code.replace(oldLoadProjectsList, newLoadProjectsList);
    console.log('✓ Patched loadProjectsList to merge and persist projects');
} else {
    console.warn('Could not find exact oldLoadProjectsList');
}

// 2. Update setupCreateProjectModal success handling
const oldCreateProjSuccess = `            if (res.success && res.data) {
                closeModal('modalCreateProject');
                form.reset();

                // Dual-sync created project directly to Cloud Firestore collection "projects"
                if (window.firebaseAuthClient?.saveProjectToFirestore) {
                    window.firebaseAuthClient.saveProjectToFirestore(res.data).catch(() => {});
                }

                // Refresh projects in state & UI
                await loadProjectsList();
                selectProject(res.data.id);
                loadAllProjectsTable();

                // Direct to project tasks
                switchActiveView('tasks');
                alert(\`✓ Project "\${name}" (\${keyPrefix}) created and saved successfully!\`);
            }`;

const newCreateProjSuccess = `            if (res.success && res.data) {
                closeModal('modalCreateProject');
                form.reset();

                const createdProj = {
                    ...res.data,
                    id: res.data.id,
                    name: res.data.name || name,
                    key_prefix: res.data.key_prefix || res.data.keyPrefix || keyPrefix,
                    keyPrefix: res.data.key_prefix || res.data.keyPrefix || keyPrefix,
                    owner_id: res.data.owner_id || res.data.ownerId || ownerId,
                    is_public: res.data.is_public !== undefined ? res.data.is_public : isPublic,
                    isPublic: res.data.is_public !== undefined ? res.data.is_public : isPublic,
                    start_date: res.data.start_date || startDate,
                    end_date: res.data.end_date || endDate,
                    member_ids: res.data.member_ids || [ownerId]
                };

                // Immediately update local storage so it is never lost
                let localProjs = JSON.parse(localStorage.getItem('life_pms_projects') || '[]');
                localProjs = localProjs.filter(p => p.id !== createdProj.id);
                localProjs.unshift(createdProj);
                localStorage.setItem('life_pms_projects', JSON.stringify(localProjs));

                // Immediately update memory cache
                allProjectsCache = allProjectsCache.filter(p => p.id !== createdProj.id);
                allProjectsCache.unshift(createdProj);

                currentProjectId = createdProj.id;
                sessionStorage.setItem('life_pms_project_id', currentProjectId);

                // Dual-sync created project directly to Cloud Firestore collection "projects"
                if (window.firebaseAuthClient?.saveProjectToFirestore) {
                    window.firebaseAuthClient.saveProjectToFirestore(createdProj).catch(() => {});
                }

                // Refresh UI immediately
                renderSidebarProjects();
                updateNavbarProjectName();
                loadAllProjectsTable();
                selectProject(createdProj.id);

                // Direct to project tasks
                switchActiveView('tasks');
                alert(\`✓ Project "\${createdProj.name}" created and saved successfully!\`);
            }`;

if (code.includes(oldCreateProjSuccess)) {
    code = code.replace(oldCreateProjSuccess, newCreateProjSuccess);
    console.log('✓ Patched setupCreateProjectModal to immediately save and display projects');
} else {
    console.warn('Could not find exact oldCreateProjSuccess');
}

// 3. Update setupAddTaskModal success handling
const oldAddTaskSuccess = `        if (res.success) {
            closeModal('modalAddTask');
            document.getElementById('newTaskName').value = '';
            document.getElementById('newTaskNote').value = '';

            // Dual-sync created task directly to Cloud Firestore collection "tasks"
            if (window.firebaseAuthClient?.saveTaskToFirestore && res.data) {
                window.firebaseAuthClient.saveTaskToFirestore(res.data).catch(() => {});
            }

            await loadCurrentTaskView();
            await loadGlobalDashboardStats();
        }`;

const newAddTaskSuccess = `        if (res.success) {
            closeModal('modalAddTask');
            document.getElementById('newTaskName').value = '';
            document.getElementById('newTaskNote').value = '';

            const taskItem = res.data || {
                id: 'task-' + Date.now().toString(36),
                name,
                projectId: projId,
                project_id: projId,
                taskListId: taskListId || 'list-general-internal',
                task_list_id: taskListId || 'list-general-internal',
                priority,
                start_date: startDate || new Date().toISOString().split('T')[0],
                end_date: endDate || '',
                owner_ids: ownerId ? [ownerId] : [],
                status_id: 'open',
                is_completed: 0,
                prefix_key: 'T-' + (allTasksCache.length + 1)
            };

            taskItem.projectId = taskItem.projectId || projId;
            taskItem.project_id = taskItem.project_id || projId;
            taskItem.taskListId = taskItem.taskListId || taskListId || 'list-general-internal';
            taskItem.task_list_id = taskItem.task_list_id || taskListId || 'list-general-internal';
            taskItem.owner_ids = taskItem.owner_ids || (ownerId ? [ownerId] : []);
            taskItem.prefix_key = taskItem.prefix_key || taskItem.prefixKey || ('T-' + (allTasksCache.length + 1));

            // Immediately save to local storage
            let localTasks = JSON.parse(localStorage.getItem('life_pms_tasks') || '[]');
            localTasks = localTasks.filter(t => t.id !== taskItem.id);
            localTasks.unshift(taskItem);
            localStorage.setItem('life_pms_tasks', JSON.stringify(localTasks));

            // Immediately add to memory cache
            allTasksCache = allTasksCache.filter(t => t.id !== taskItem.id);
            allTasksCache.unshift(taskItem);

            // Dual-sync created task directly to Cloud Firestore collection "tasks"
            if (window.firebaseAuthClient?.saveTaskToFirestore) {
                window.firebaseAuthClient.saveTaskToFirestore(taskItem).catch(() => {});
            }

            await loadCurrentTaskView();
            await loadGlobalDashboardStats();
            alert(\`✓ Task "\${taskItem.name}" created and saved successfully!\`);
        }`;

if (code.includes(oldAddTaskSuccess)) {
    code = code.replace(oldAddTaskSuccess, newAddTaskSuccess);
    console.log('✓ Patched setupAddTaskModal to immediately save and display tasks');
} else {
    console.warn('Could not find exact oldAddTaskSuccess');
}

// 4. Update loadTaskSheetView to merge backend and local tasks
const oldLoadTaskSheet = `    const [res, tlRes] = await Promise.all([
        apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\${currentTasksFilter === 'my' ? '?my=true' : ''}\`),
        apiFetch(\`/api/v1/task-lists/project/\${currentProjectId}\`).catch(() => ({ success: false }))
    ]);
    const tasks = res.data || [];
    allTasksCache = tasks;
    const taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data)) ? tlRes.data : allTaskListsCache;
    allTaskListsCache = taskLists;`;

const newLoadTaskSheet = `    const [res, tlRes] = await Promise.all([
        apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\${currentTasksFilter === 'my' ? '?my=true' : ''}\`),
        apiFetch(\`/api/v1/task-lists/project/\${currentProjectId}\`).catch(() => ({ success: false }))
    ]);
    let tasks = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];
    const localTasks = JSON.parse(localStorage.getItem('life_pms_tasks') || '[]');
    const localForProject = localTasks.filter(t => !t.projectId || !t.project_id || t.projectId === currentProjectId || t.project_id === currentProjectId);

    // Merge backend tasks with local tasks (deduplicate by id)
    const taskMap = new Map();
    localForProject.forEach(t => { if (t && t.id) taskMap.set(t.id, t); });
    tasks.forEach(t => { if (t && t.id) taskMap.set(t.id, { ...taskMap.get(t.id), ...t }); });

    tasks = Array.from(taskMap.values()).map(t => ({
        ...t,
        task_list_id: t.task_list_id || t.taskListId || 'list-general-internal',
        project_id: t.project_id || t.projectId || currentProjectId,
        prefix_key: t.prefix_key || t.prefixKey || (t.sequence_number ? \`T-\${t.sequence_number}\` : 'TASK-1'),
        owner_ids: Array.isArray(t.owner_ids) ? t.owner_ids : (Array.isArray(t.ownerIds) ? t.ownerIds : (t.assignee_id ? [t.assignee_id] : []))
    }));

    allTasksCache = tasks;
    let taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data) && tlRes.data.length > 0) ? tlRes.data : allTaskListsCache;
    if (!taskLists || taskLists.length === 0) {
        taskLists = [
            { id: 'list-general-internal', name: 'General (Internal)', flag: 'internal' },
            { id: 'list-general-external', name: 'General (Client Visible)', flag: 'external' }
        ];
    }
    allTaskListsCache = taskLists;`;

if (code.includes(oldLoadTaskSheet)) {
    code = code.replace(oldLoadTaskSheet, newLoadTaskSheet);
    console.log('✓ Patched loadTaskSheetView to merge and normalize tasks');
} else {
    console.warn('Could not find exact oldLoadTaskSheet');
}

// 5. Update handleStaticApi for tasks
const oldStaticTaskPost = `        // Create Task (POST /api/v1/tasks/project/...)
        if (method === 'POST') {
            const count = tasks.length + 1;
            const newTask = {
                id: 'task-' + Date.now().toString(36),
                projectId: currentProjectId,
                taskListId: body.taskListId || 'list-phase-system',
                prefix_key: 'AE1-T' + (40 + count),
                name: body.name || 'New Task',
                description: body.note || '',
                priority: body.priority || 'medium',
                status_id: 'open',
                is_completed: 0,
                start_date: body.startDate || new Date().toISOString().split('T')[0],
                end_date: body.endDate || '',
                owner_ids: body.ownerIds?.length ? body.ownerIds : (currentUser?.id ? [currentUser.id] : []),
                created_at: new Date().toISOString(),
                portalId: currentPortalId
            };
            tasks.unshift(newTask);
            localStorage.setItem('life_pms_tasks', JSON.stringify(tasks));

            // Sync task directly to Cloud Firestore collection "tasks"
            if (window.firebaseAuthClient?.saveTaskToFirestore) {
                window.firebaseAuthClient.saveTaskToFirestore(newTask).catch(() => {});
            }

            return { success: true, data: newTask };
        }`;

const newStaticTaskPost = `        // Create Task (POST /api/v1/tasks/project/...)
        if (method === 'POST') {
            const parts = endpoint.split('/');
            const targetProjId = parts[parts.indexOf('tasks') + 2] || currentProjectId;
            const count = tasks.length + 1;
            const newTask = {
                id: 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                projectId: targetProjId,
                project_id: targetProjId,
                taskListId: body.taskListId || 'list-general-internal',
                task_list_id: body.taskListId || 'list-general-internal',
                prefix_key: 'T-' + (40 + count),
                name: body.name || 'New Task',
                description: body.note || '',
                priority: body.priority || 'medium',
                status_id: 'open',
                is_completed: 0,
                start_date: body.startDate || new Date().toISOString().split('T')[0],
                end_date: body.endDate || '',
                owner_ids: body.ownerIds?.length ? body.ownerIds : (currentUser?.id ? [currentUser.id] : []),
                created_at: new Date().toISOString(),
                portalId: currentPortalId
            };
            tasks.unshift(newTask);
            localStorage.setItem('life_pms_tasks', JSON.stringify(tasks));

            // Sync task directly to Cloud Firestore collection "tasks"
            if (window.firebaseAuthClient?.saveTaskToFirestore) {
                window.firebaseAuthClient.saveTaskToFirestore(newTask).catch(() => {});
            }

            return { success: true, data: newTask };
        }`;

if (code.includes(oldStaticTaskPost)) {
    code = code.replace(oldStaticTaskPost, newStaticTaskPost);
    console.log('✓ Patched handleStaticApi POST task');
} else {
    console.warn('Could not find exact oldStaticTaskPost');
}

// 6. Update handleStaticApi GET tasks
const oldStaticTaskGet = `        // Filter by project
        const projectTasks = tasks.filter(t => !t.projectId || t.projectId === currentProjectId);
        return { success: true, data: projectTasks };`;

const newStaticTaskGet = `        // Filter by project
        const parts = endpoint.split('/');
        const filterProjId = parts[parts.indexOf('tasks') + 2] || currentProjectId;
        const projectTasks = tasks.filter(t => !filterProjId || !t.projectId || !t.project_id || t.projectId === filterProjId || t.project_id === filterProjId);
        return { success: true, data: projectTasks };`;

if (code.includes(oldStaticTaskGet)) {
    code = code.replace(oldStaticTaskGet, newStaticTaskGet);
    console.log('✓ Patched handleStaticApi GET tasks');
} else {
    console.warn('Could not find exact oldStaticTaskGet');
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(appPath, code, 'utf8');
console.log('✓ Saved changes to src/public/app.js');
