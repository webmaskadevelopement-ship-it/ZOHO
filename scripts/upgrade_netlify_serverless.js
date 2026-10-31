const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '../netlify/functions/api.js');
let code = fs.readFileSync(apiPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// Replace Route 6.3 through 6.6 with the full persistent serverless implementation
const oldRoutesTarget = `        // Route 6.3: Projects (GET /api/v1/projects, POST /api/v1/projects)
        if (cleanPath.startsWith('/api/v1/projects') || cleanPath.startsWith('/api/projects')) {
            const authUser = getAuthUser(event);

            if (event.httpMethod === 'POST') {
                const newProject = {
                    id: 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    name: body.name || 'New Project',
                    key_prefix: body.keyPrefix || body.key_prefix || 'PRJ',
                    description: body.description || '',
                    is_public: body.isPublic ? 1 : 0,
                    owner_id: authUser?.id || 'usr-admin',
                    member_ids: [authUser?.id || 'usr-admin'],
                    portal_id: 'portal-demo-zoho',
                    created_at: new Date().toISOString()
                };

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newProject })
                };
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    data: []
                })
            };
        }

        // Route 6.4: My Approvals (GET /api/v1/requests/approvals)
        if (cleanPath.includes('/requests/approvals') && event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    count: 0,
                    data: []
                })
            };
        }

        // Route 6.5: In-App Requests (Incoming, Sent, Respond, Create)
        if (cleanPath.includes('/requests') && !cleanPath.includes('/approvals')) {
            const authUser = getAuthUser(event);

            if (cleanPath.includes('/respond') && event.httpMethod === 'PATCH') {
                const action = body.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            status: action,
                            message: \`Request successfully \${action.toLowerCase()}ed.\`
                        }
                    })
                };
            }

            if (event.httpMethod === 'POST') {
                const newReq = {
                    id: 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    sender_id: authUser?.id || 'usr-admin',
                    receiver_id: body.receiver_id || '',
                    request_type: body.request_type || 'PROJECT_INVITE',
                    target_entity_id: body.target_entity_id || body.payload?.projectId,
                    payload: body.payload || {},
                    status: 'PENDING',
                    created_at: new Date().toISOString()
                };
                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newReq })
                };
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, count: 0, data: [] })
            };
        }

        // Route 6.6: Global Dashboard Stats (GET /api/v1/views/dashboard/global)
        if (cleanPath.includes('/views/dashboard/global') && event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    data: {
                        totalProjects: 0,
                        openTasks: 0,
                        closedTasks: 0,
                        totalIssues: 0,
                        teamMembers: 10
                    }
                })
            };
        }`;

const newFullRoutes = `        // Serverless File/Memory-Backed Store for Resilient Persistence across Deployed Invocations
        const STORE_FILE = path.join('/tmp', 'life_pms_serverless_data.json');
        function getStore() {
            try {
                if (fs.existsSync(STORE_FILE)) {
                    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
                }
            } catch (e) {}
            return {
                projects: global._serverlessProjects || [],
                tasks: global._serverlessTasks || [],
                taskLists: global._serverlessTaskLists || [],
                issues: global._serverlessIssues || [],
                phases: global._serverlessPhases || [],
                requests: global._serverlessRequests || []
            };
        }

        function saveStore(store) {
            global._serverlessProjects = store.projects;
            global._serverlessTasks = store.tasks;
            global._serverlessTaskLists = store.taskLists;
            global._serverlessIssues = store.issues;
            global._serverlessPhases = store.phases;
            global._serverlessRequests = store.requests;
            try {
                fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
            } catch (e) {}
        }

        const store = getStore();

        // Route 6.3: Projects (GET /api/v1/projects, POST /api/v1/projects)
        if (cleanPath.startsWith('/api/v1/projects') || cleanPath.startsWith('/api/projects')) {
            const authUser = getAuthUser(event);

            if (event.httpMethod === 'POST') {
                const newProject = {
                    id: 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    name: body.name || 'New Project',
                    key_prefix: body.keyPrefix || body.key_prefix || 'PRJ',
                    keyPrefix: body.keyPrefix || body.key_prefix || 'PRJ',
                    description: body.description || '',
                    is_public: body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1,
                    isPublic: body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1,
                    owner_id: authUser?.id || 'usr-admin',
                    ownerId: authUser?.id || 'usr-admin',
                    member_ids: [authUser?.id || 'usr-admin'],
                    portal_id: 'portal-demo-zoho',
                    start_date: body.startDate || new Date().toISOString().split('T')[0],
                    end_date: body.endDate || '',
                    created_at: new Date().toISOString(),
                    stats: { openTaskCount: 0, closedTaskCount: 0, completionPercentage: 0 }
                };

                store.projects.unshift(newProject);

                // Auto-create default task lists for the new project
                store.taskLists.push(
                    { id: 'list-' + newProject.id + '-internal', projectId: newProject.id, name: 'General (Internal)', flag: 'internal' },
                    { id: 'list-' + newProject.id + '-external', projectId: newProject.id, name: 'General (Client Visible)', flag: 'external' }
                );

                saveStore(store);

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newProject })
                };
            }

            // GET Projects (Scoped by user permissions)
            let projs = store.projects;
            if (authUser && authUser.role !== 'admin') {
                projs = projs.filter(p => {
                    const isPub = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                    const isOwner = p.owner_id === authUser.id || p.ownerId === authUser.id || p.owner_email === authUser.email;
                    const members = Array.isArray(p.member_ids) ? p.member_ids : [];
                    const isMember = members.includes(authUser.id) || members.includes(authUser.email);
                    return isPub || isOwner || isMember;
                });
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    count: projs.length,
                    data: projs
                })
            };
        }

        // Route 6.4: Tasks (GET /api/v1/tasks/project/:id, POST /api/v1/tasks/project/:id, PATCH quick-status)
        if (cleanPath.includes('/tasks')) {
            const authUser = getAuthUser(event);

            // PATCH quick-status
            if (cleanPath.includes('/quick-status')) {
                const parts = cleanPath.split('/');
                const taskId = parts[parts.indexOf('tasks') + 1];
                const task = store.tasks.find(t => t.id === taskId);
                if (task) {
                    task.is_completed = body.isCompleted ? 1 : 0;
                    task.status_id = body.isCompleted ? 'completed' : 'open';
                    saveStore(store);
                }
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true })
                };
            }

            // POST /api/v1/tasks/project/:id
            if (event.httpMethod === 'POST') {
                const parts = cleanPath.split('/');
                const projId = parts[parts.indexOf('tasks') + 2] || body.projectId;
                const count = store.tasks.length + 1;
                const newTask = {
                    id: 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    projectId: projId,
                    project_id: projId,
                    name: body.name || 'New Task',
                    description: body.note || body.description || '',
                    priority: body.priority || 'medium',
                    status_id: 'open',
                    is_completed: 0,
                    start_date: body.startDate || new Date().toISOString().split('T')[0],
                    end_date: body.endDate || '',
                    taskListId: body.taskListId || 'list-' + projId + '-internal',
                    task_list_id: body.taskListId || 'list-' + projId + '-internal',
                    owner_ids: body.ownerIds?.length ? body.ownerIds : (authUser?.id ? [authUser.id] : []),
                    prefix_key: 'T-' + (40 + count),
                    created_at: new Date().toISOString()
                };

                store.tasks.unshift(newTask);
                saveStore(store);

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newTask })
                };
            }

            // GET /api/v1/tasks/project/:id
            const parts = cleanPath.split('/');
            const targetProjId = parts[parts.indexOf('tasks') + 2];
            let projTasks = store.tasks;
            if (targetProjId) {
                projTasks = projTasks.filter(t => t.projectId === targetProjId || t.project_id === targetProjId || (!t.projectId && !t.project_id));
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    count: projTasks.length,
                    data: projTasks
                })
            };
        }

        // Route 6.5: Task Lists (GET /api/v1/task-lists/project/:id)
        if (cleanPath.includes('/task-lists')) {
            const parts = cleanPath.split('/');
            const projId = parts[parts.indexOf('task-lists') + 2];
            let lists = store.taskLists.filter(tl => !projId || tl.projectId === projId);
            if (lists.length === 0) {
                lists = [
                    { id: 'list-' + (projId || 'gen') + '-internal', projectId: projId, name: 'General (Internal)', flag: 'internal' },
                    { id: 'list-' + (projId || 'gen') + '-external', projectId: projId, name: 'General (Client Visible)', flag: 'external' }
                ];
            }
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, data: lists })
            };
        }

        // Route 6.6: Phases (GET /api/v1/phases/project/:id)
        if (cleanPath.includes('/phases')) {
            const parts = cleanPath.split('/');
            const projId = parts[parts.indexOf('phases') + 2];
            let phases = store.phases.filter(p => !projId || p.projectId === projId);
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, data: phases })
            };
        }

        // Route 6.7: Issues (GET /api/v1/issues, POST /api/v1/issues)
        if (cleanPath.includes('/issues')) {
            if (event.httpMethod === 'POST') {
                const newIssue = {
                    id: 'issue-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    projectId: body.projectId,
                    title: body.title || 'Reported Issue',
                    severity: body.severity || 'medium',
                    description: body.description || '',
                    status: 'open',
                    prefix_key: 'BUG-' + (store.issues.length + 101),
                    created_at: new Date().toISOString()
                };
                store.issues.unshift(newIssue);
                saveStore(store);
                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newIssue })
                };
            }
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, count: store.issues.length, data: store.issues })
            };
        }

        // Route 6.8: My Approvals (GET /api/v1/requests/approvals)
        if (cleanPath.includes('/requests/approvals') && event.httpMethod === 'GET') {
            const authUser = getAuthUser(event);
            let approvals = store.requests;
            if (authUser && authUser.role !== 'admin') {
                approvals = approvals.filter(r => {
                    return r.sender_id === authUser.id || r.receiver_id === authUser.id ||
                           (r.sender && (r.sender.id === authUser.id || r.sender.email === authUser.email)) ||
                           (r.receiver && (r.receiver.id === authUser.id || r.receiver.email === authUser.email));
                });
            }
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    count: approvals.length,
                    data: approvals.map(r => {
                        const payload = r.payload || {};
                        return {
                            id: r.id,
                            request_type: r.request_type || 'PROJECT_INVITE',
                            target_entity_id: r.target_entity_id || payload.projectId,
                            status: r.status || 'PENDING',
                            created_at: r.created_at || new Date().toISOString(),
                            responded_at: r.responded_at || null,
                            payload,
                            sender: r.sender || {
                                id: r.sender_id,
                                name: payload.inviterName || 'Administrator',
                                email: payload.inviterEmail || 'admin@zoho.com',
                                username: payload.inviterUsername || 'admin'
                            },
                            receiver: r.receiver || {
                                id: r.receiver_id,
                                name: payload.receiverName || 'Team Member',
                                email: payload.receiverEmail || '',
                                username: payload.receiverUsername || ''
                            },
                            project: r.project || {
                                id: r.target_entity_id || payload.projectId,
                                name: payload.projectName || 'Project Workspace',
                                key_prefix: payload.projectPrefix || 'PRJ'
                            },
                            role: payload.role || 'employee',
                            is_approved: r.status === 'ACCEPTED' || r.status === 'APPROVED',
                            approval_status: r.status === 'ACCEPTED' ? 'Approved / Accepted' : (r.status === 'PENDING' ? 'Pending Approval' : (r.status === 'REJECTED' ? 'Rejected' : r.status))
                        };
                    })
                })
            };
        }

        // Route 6.9: In-App Requests (Incoming, Sent, Respond, Create)
        if (cleanPath.includes('/requests') && !cleanPath.includes('/approvals')) {
            const authUser = getAuthUser(event);

            if (cleanPath.includes('/respond') && event.httpMethod === 'PATCH') {
                const parts = cleanPath.split('/');
                const reqId = parts[parts.indexOf('requests') + 1];
                const action = body.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
                const reqItem = store.requests.find(r => r.id === reqId);
                if (reqItem) {
                    reqItem.status = action;
                    reqItem.responded_at = new Date().toISOString();

                    // If ACCEPT and PROJECT_INVITE: add receiver to project's member_ids
                    if (action === 'ACCEPTED' && reqItem.target_entity_id) {
                        const proj = store.projects.find(p => p.id === reqItem.target_entity_id);
                        if (proj) {
                            proj.member_ids = proj.member_ids || [];
                            const receiverId = reqItem.receiver_id || authUser?.id;
                            if (receiverId && !proj.member_ids.includes(receiverId)) {
                                proj.member_ids.push(receiverId);
                            }
                        }
                    }
                    saveStore(store);
                }
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            status: action,
                            message: \`Request successfully \${action.toLowerCase()}ed.\`
                        }
                    })
                };
            }

            if (event.httpMethod === 'POST') {
                const newReq = {
                    id: 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    sender_id: authUser?.id || 'usr-admin',
                    receiver_id: body.receiver_id || '',
                    request_type: body.request_type || 'PROJECT_INVITE',
                    target_entity_id: body.target_entity_id || body.payload?.projectId,
                    payload: body.payload || {},
                    status: 'PENDING',
                    created_at: new Date().toISOString(),
                    sender: {
                        id: authUser?.id,
                        name: authUser?.name || 'Administrator',
                        email: authUser?.email || 'admin@zoho.com',
                        username: authUser?.username || 'admin'
                    },
                    receiver: {
                        id: body.receiver_id,
                        name: body.payload?.receiverName || 'Collaborator',
                        email: body.payload?.receiverEmail || body.email || '',
                        username: body.payload?.receiverUsername || body.username || ''
                    },
                    project: {
                        id: body.target_entity_id || body.payload?.projectId,
                        name: body.payload?.projectName || 'Project Workspace',
                        key_prefix: body.payload?.projectPrefix || 'PRJ'
                    }
                };

                store.requests.unshift(newReq);
                saveStore(store);

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newReq })
                };
            }

            if (cleanPath.includes('/incoming')) {
                const incoming = store.requests.filter(r => {
                    const isForMe = r.receiver_id === authUser?.id || (r.receiver && (r.receiver.id === authUser?.id || r.receiver.email === authUser?.email));
                    return isForMe && r.status === 'PENDING';
                });
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, count: incoming.length, data: incoming })
                };
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({ success: true, count: store.requests.length, data: store.requests })
            };
        }

        // Route 6.10: Global Dashboard Stats (GET /api/v1/views/dashboard/global)
        if (cleanPath.includes('/views/dashboard/global') && event.httpMethod === 'GET') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    data: {
                        totalProjects: store.projects.length,
                        openTasks: store.tasks.filter(t => !t.is_completed).length,
                        closedTasks: store.tasks.filter(t => t.is_completed).length,
                        totalIssues: store.issues.length,
                        teamMembers: 10
                    }
                })
            };
        }`;

if (code.includes(oldRoutesTarget)) {
    code = code.replace(oldRoutesTarget, newFullRoutes);
    if (isCRLF) code = code.replace(/\n/g, '\r\n');
    fs.writeFileSync(apiPath, code, 'utf8');
    console.log('✓ Successfully upgraded netlify/functions/api.js with persistent serverless storage');
} else {
    console.error('Target oldRoutesTarget not found in netlify/functions/api.js');
}
