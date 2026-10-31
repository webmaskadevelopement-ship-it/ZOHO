const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '..', 'netlify', 'functions', 'api.js');
let code = fs.readFileSync(apiPath, 'utf8');

// Normalize line endings to \n for consistent replacement
const isCrlf = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// Find start of store section
const storeMarker = '// Serverless File/Memory-Backed Store for Resilient Persistence across Deployed Invocations';
const storeIdx = code.indexOf(storeMarker);
if (storeIdx === -1) {
    console.error('Could not find storeMarker in api.js');
    process.exit(1);
}

// Find Route 6.10 end
const route10Marker = '// Route 6.10: Global Dashboard Stats (GET /api/v1/views/dashboard/global)';
const route10Idx = code.indexOf(route10Marker);
if (route10Idx === -1) {
    console.error('Could not find route10Marker in api.js');
    process.exit(1);
}

// Find Route 7 start
const route7Marker = '// Route 7: Return 404 for unhandled routes so frontend client-side router/mock handles them';
const route7Idx = code.indexOf(route7Marker);
if (route7Idx === -1) {
    console.error('Could not find route7Marker in api.js');
    process.exit(1);
}

const replacementSection = `// Authorized Workspace Users Directory (PDF Specifications)
        const PDF_USERS_DIRECTORY = [
            { id: 'efac5612-9ff8-4f2a-884d-46ff5e470584', uuid: 'efac5612-9ff8-4f2a-884d-46ff5e470584', slugId: 'usr-ravi', name: 'Ravi Bhadoria', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com', role: 'employee', department: 'Development' },
            { id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', uuid: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', slugId: 'usr-ananya', name: 'Ananya Gupta', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com', role: 'employee', department: 'UI/UX Design' },
            { id: 'ce170463-92f6-4f03-b801-9b57b82e862f', uuid: 'ce170463-92f6-4f03-b801-9b57b82e862f', slugId: 'usr-ineet', name: 'Ineet', username: 'ineet', email: 'ineet@zoho.com', role: 'employee', department: 'Quality Assurance' },
            { id: 'f6419896-0f5b-4c42-a0c1-587d9829d647', uuid: 'f6419896-0f5b-4c42-a0c1-587d9829d647', slugId: 'usr-nikhil', name: 'Nikhil', username: 'nikhil', email: 'nikhil@zoho.com', role: 'employee', department: 'Engineering' },
            { id: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', uuid: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', slugId: 'usr-ritika', name: 'Ritika', username: 'ritika', email: 'ritika@zoho.com', role: 'employee', department: 'Product Management' },
            { id: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', uuid: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', slugId: 'usr-shweta', name: 'Shweta', username: 'shweta', email: 'shweta@zoho.com', role: 'employee', department: 'Operations' },
            { id: 'c5783c9c-172c-435a-840b-bb4a33f627f8', uuid: 'c5783c9c-172c-435a-840b-bb4a33f627f8', slugId: 'usr-ekta', name: 'Ekta', username: 'ekta', email: 'ekta@zoho.com', role: 'employee', department: 'Frontend' },
            { id: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', uuid: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', slugId: 'usr-abhishek', name: 'Abhishek', username: 'abhishek', email: 'abhishek@zoho.com', role: 'employee', department: 'Backend Systems' },
            { id: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', uuid: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', slugId: 'usr-prince', name: 'Prince', username: 'prince', email: 'prince@zoho.com', role: 'employee', department: 'Cloud & DevOps' },
            { id: '324a1d25-0fe8-46b8-88c0-13a41fe93331', uuid: '324a1d25-0fe8-46b8-88c0-13a41fe93331', slugId: 'usr-ali', name: 'Ali', username: 'ali', email: 'ali@zoho.com', role: 'employee', department: 'Mobile Engineering' },
            { id: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', uuid: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', slugId: 'usr-admin', name: 'Nikhil Kaushik', username: 'admin', email: 'webmaskadevelopement@gmail.com', role: 'admin', department: 'Executive' },
            { id: '0e4352f0-b919-449a-b68a-2091efa145d4', uuid: '0e4352f0-b919-449a-b68a-2091efa145d4', slugId: 'usr-manager', name: 'Tushar', username: 'manager', email: 'backend.webmaska@gmail.com', role: 'manager', department: 'Management' }
        ];

        function findPdfUser(identifier) {
            if (!identifier) return null;
            const clean = String(identifier).toLowerCase().trim();
            return PDF_USERS_DIRECTORY.find(u =>
                u.id.toLowerCase() === clean ||
                u.uuid.toLowerCase() === clean ||
                u.slugId.toLowerCase() === clean ||
                u.email.toLowerCase() === clean ||
                u.username.toLowerCase() === clean ||
                u.name.toLowerCase() === clean
            );
        }

        function isUserProjectOwnerOrMember(proj, user) {
            if (!proj || !user) return false;
            const uId = String(user.id || user.userId || '').toLowerCase();
            const uEmail = String(user.email || '').toLowerCase().trim();
            const uName = String(user.username || '').toLowerCase().trim();

            const targetUser = findPdfUser(uId) || findPdfUser(uEmail) || findPdfUser(uName);
            const validIds = new Set([uId, uEmail, uName].filter(Boolean));
            if (targetUser) {
                validIds.add(targetUser.id.toLowerCase());
                validIds.add(targetUser.uuid.toLowerCase());
                validIds.add(targetUser.slugId.toLowerCase());
                validIds.add(targetUser.email.toLowerCase());
                validIds.add(targetUser.username.toLowerCase());
            }

            const pOwnerId = String(proj.owner_id || proj.ownerId || '').toLowerCase();
            const pOwnerEmail = String(proj.owner_email || proj.ownerEmail || '').toLowerCase();
            const pOwnerUser = String(proj.owner_username || proj.ownerUsername || '').toLowerCase();

            if (pOwnerId && validIds.has(pOwnerId)) return true;
            if (pOwnerEmail && validIds.has(pOwnerEmail)) return true;
            if (pOwnerUser && validIds.has(pOwnerUser)) return true;

            // Check members
            let members = [];
            try {
                members = Array.isArray(proj.member_ids) ? proj.member_ids : (Array.isArray(proj.memberIds) ? proj.memberIds : (typeof proj.member_ids === 'string' ? JSON.parse(proj.member_ids || '[]') : []));
            } catch (e) { members = []; }

            for (const m of members) {
                const mStr = String(m).toLowerCase();
                if (validIds.has(mStr)) return true;
                const mUser = findPdfUser(mStr);
                if (mUser && targetUser && mUser.id === targetUser.id) return true;
            }
            return false;
        }

        function isUserRecipient(req, user) {
            if (!req || !user) return false;
            const uId = String(user.id || user.userId || '').toLowerCase();
            const uEmail = String(user.email || '').toLowerCase().trim();
            const uName = String(user.username || '').toLowerCase().trim();

            const targetUser = findPdfUser(uId) || findPdfUser(uEmail) || findPdfUser(uName);
            const validIds = new Set([uId]);
            const validEmails = new Set([uEmail]);
            const validUsernames = new Set([uName]);
            if (targetUser) {
                validIds.add(targetUser.id.toLowerCase());
                validIds.add(targetUser.uuid.toLowerCase());
                validIds.add(targetUser.slugId.toLowerCase());
                validEmails.add(targetUser.email.toLowerCase());
                validUsernames.add(targetUser.username.toLowerCase());
            }

            const rId = String(req.receiver_id || req.receiverId || req.receiver?.id || '').toLowerCase();
            const rEmail = String(req.receiver_email || req.receiverEmail || req.receiver?.email || req.payload?.receiverEmail || req.email || '').toLowerCase().trim();
            const rUser = String(req.receiver_username || req.receiverUsername || req.receiver?.username || req.payload?.receiverUsername || req.username || '').toLowerCase().trim();

            if (rId && validIds.has(rId)) return true;
            if (rEmail && validEmails.has(rEmail)) return true;
            if (rUser && validUsernames.has(rUser)) return true;

            const reqReceiver = findPdfUser(rId) || findPdfUser(rEmail) || findPdfUser(rUser);
            if (reqReceiver && targetUser && reqReceiver.id === targetUser.id) {
                return true;
            }
            return false;
        }

        function isUserSender(req, user) {
            if (!req || !user) return false;
            const uId = String(user.id || user.userId || '').toLowerCase();
            const uEmail = String(user.email || '').toLowerCase().trim();
            const uName = String(user.username || '').toLowerCase().trim();

            const targetUser = findPdfUser(uId) || findPdfUser(uEmail) || findPdfUser(uName);
            const validIds = new Set([uId]);
            const validEmails = new Set([uEmail]);
            const validUsernames = new Set([uName]);
            if (targetUser) {
                validIds.add(targetUser.id.toLowerCase());
                validIds.add(targetUser.uuid.toLowerCase());
                validIds.add(targetUser.slugId.toLowerCase());
                validEmails.add(targetUser.email.toLowerCase());
                validUsernames.add(targetUser.username.toLowerCase());
            }

            const sId = String(req.sender_id || req.senderId || req.sender?.id || '').toLowerCase();
            const sEmail = String(req.sender_email || req.senderEmail || req.sender?.email || req.payload?.inviterEmail || '').toLowerCase().trim();
            const sUser = String(req.sender_username || req.senderUsername || req.sender?.username || req.payload?.inviterUsername || '').toLowerCase().trim();

            if (sId && validIds.has(sId)) return true;
            if (sEmail && validEmails.has(sEmail)) return true;
            if (sUser && validUsernames.has(sUser)) return true;

            const reqSender = findPdfUser(sId) || findPdfUser(sEmail) || findPdfUser(sUser);
            if (reqSender && targetUser && reqSender.id === targetUser.id) {
                return true;
            }
            return false;
        }

        // Multi-Tier Central Persistent Store across All Devices and Serverless Containers
        const STORE_FILE = path.join('/tmp', 'life_pms_serverless_data.json');
        let _blobStore = null;

        function getNetlifyBlobStore() {
            if (_blobStore) return _blobStore;
            try {
                const { getStore } = require('@netlify/blobs');
                _blobStore = getStore({
                    name: 'life_pms_production_database',
                    consistency: 'strong'
                });
                return _blobStore;
            } catch (e) {
                return null;
            }
        }

        async function loadStore() {
            // 1. Try Netlify Blobs (Central persistent storage across devices & function invocations)
            const bStore = getNetlifyBlobStore();
            if (bStore) {
                try {
                    const data = await bStore.get('master_store', { type: 'json' });
                    if (data && typeof data === 'object') {
                        return {
                            projects: Array.isArray(data.projects) ? data.projects : [],
                            tasks: Array.isArray(data.tasks) ? data.tasks : [],
                            taskLists: Array.isArray(data.taskLists) ? data.taskLists : [],
                            issues: Array.isArray(data.issues) ? data.issues : [],
                            phases: Array.isArray(data.phases) ? data.phases : [],
                            requests: Array.isArray(data.requests) ? data.requests : []
                        };
                    }
                } catch (e) {
                    console.warn('[Netlify Blobs Read Notice]:', e.message);
                }
            }

            // 2. Fallback to /tmp filesystem
            try {
                if (fs.existsSync(STORE_FILE)) {
                    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
                    if (parsed && typeof parsed === 'object') {
                        return {
                            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
                            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
                            taskLists: Array.isArray(parsed.taskLists) ? parsed.taskLists : [],
                            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                            phases: Array.isArray(parsed.phases) ? parsed.phases : [],
                            requests: Array.isArray(parsed.requests) ? parsed.requests : []
                        };
                    }
                }
            } catch (e) { }

            // 3. Fallback to in-memory store
            return {
                projects: global._serverlessProjects || [],
                tasks: global._serverlessTasks || [],
                taskLists: global._serverlessTaskLists || [],
                issues: global._serverlessIssues || [],
                phases: global._serverlessPhases || [],
                requests: global._serverlessRequests || []
            };
        }

        async function saveStore(s) {
            global._serverlessProjects = s.projects;
            global._serverlessTasks = s.tasks;
            global._serverlessTaskLists = s.taskLists;
            global._serverlessIssues = s.issues;
            global._serverlessPhases = s.phases;
            global._serverlessRequests = s.requests;

            // 1. Write to /tmp
            try {
                fs.writeFileSync(STORE_FILE, JSON.stringify(s), 'utf8');
            } catch (e) { }

            // 2. Write to Netlify Blobs (Central persistent storage across devices & function invocations)
            const bStore = getNetlifyBlobStore();
            if (bStore) {
                try {
                    await bStore.setJSON('master_store', s);
                } catch (e) {
                    console.warn('[Netlify Blobs Write Notice]:', e.message);
                }
            }
        }

        // Route 6.3: Projects (GET /api/v1/projects, POST /api/v1/projects)
        if (cleanPath.includes('/projects')) {
            const authUser = getAuthUser(event);
            const store = await loadStore();

            if (event.httpMethod === 'POST') {
                const isPub = (body.isPublic === 1 || body.isPublic === true || body.is_public === 1 || body.is_public === true) ? 1 : 0;
                const ownerUser = findPdfUser(authUser?.id) || findPdfUser(authUser?.email) || findPdfUser(authUser?.username) || findPdfUser(body.ownerId);

                const ownerId = ownerUser ? ownerUser.id : (authUser?.id || body.ownerId || 'usr-admin');
                const ownerEmail = ownerUser ? ownerUser.email : (authUser?.email || body.ownerEmail || '');
                const ownerUsername = ownerUser ? ownerUser.username : (authUser?.username || body.ownerUsername || '');
                const ownerName = ownerUser ? ownerUser.name : (authUser?.name || body.ownerName || 'User');

                const newProject = {
                    id: 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    name: body.name || 'New Project',
                    key_prefix: body.keyPrefix || body.key_prefix || 'PRJ',
                    keyPrefix: body.keyPrefix || body.key_prefix || 'PRJ',
                    description: body.description || '',
                    is_public: isPub,
                    isPublic: isPub,
                    owner_id: ownerId,
                    ownerId: ownerId,
                    owner_email: ownerEmail,
                    ownerEmail: ownerEmail,
                    owner_username: ownerUsername,
                    ownerUsername: ownerUsername,
                    owner_name: ownerName,
                    ownerName: ownerName,
                    member_ids: [ownerId, ownerUser?.slugId, ownerUser?.uuid, ownerEmail].filter(Boolean),
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

                await saveStore(store);

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newProject })
                };
            }

            // GET Projects (Scoped by Public vs Private Visibility Rules)
            let projs = store.projects;
            if (authUser && authUser.role !== 'admin') {
                projs = projs.filter(p => {
                    const isPub = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                    if (isPub) return true; // Public projects visible to all registered users
                    return isUserProjectOwnerOrMember(p, authUser); // Private projects strictly visible ONLY to creator & members
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
            const store = await loadStore();

            // PATCH quick-status
            if (cleanPath.includes('/quick-status')) {
                const parts = cleanPath.split('/');
                const taskId = parts[parts.indexOf('tasks') + 1];
                const task = store.tasks.find(t => t.id === taskId);
                if (task) {
                    task.is_completed = body.isCompleted ? 1 : 0;
                    task.status_id = body.isCompleted ? 'completed' : 'open';
                    await saveStore(store);
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
                await saveStore(store);

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
            const store = await loadStore();
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
            const store = await loadStore();
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
            const store = await loadStore();
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
                await saveStore(store);
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
            const store = await loadStore();
            let approvals = store.requests;
            if (authUser && authUser.role !== 'admin') {
                approvals = approvals.filter(r => isUserSender(r, authUser) || isUserRecipient(r, authUser));
            }
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    count: approvals.length,
                    data: approvals.map(r => {
                        const payload = r.payload || {};
                        const sUser = findPdfUser(r.sender_id) || findPdfUser(r.sender_email) || {};
                        const rUser = findPdfUser(r.receiver_id) || findPdfUser(r.receiver_email) || {};
                        return {
                            id: r.id,
                            request_type: r.request_type || 'PROJECT_INVITE',
                            target_entity_id: r.target_entity_id || payload.projectId,
                            status: r.status || 'PENDING',
                            created_at: r.created_at || new Date().toISOString(),
                            responded_at: r.responded_at || null,
                            payload,
                            sender: r.sender || {
                                id: r.sender_id || sUser.id,
                                name: r.sender_name || sUser.name || payload.inviterName || 'Administrator',
                                email: r.sender_email || sUser.email || payload.inviterEmail || 'admin@zoho.com',
                                username: r.sender_username || sUser.username || payload.inviterUsername || 'admin'
                            },
                            receiver: r.receiver || {
                                id: r.receiver_id || rUser.id,
                                name: r.receiver_name || rUser.name || payload.receiverName || 'Team Member',
                                email: r.receiver_email || rUser.email || payload.receiverEmail || '',
                                username: r.receiver_username || rUser.username || payload.receiverUsername || ''
                            },
                            project: r.project || {
                                id: r.target_entity_id || payload.projectId,
                                name: r.project_name || payload.projectName || 'Project Workspace',
                                key_prefix: r.project_prefix || payload.projectPrefix || 'PRJ'
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
            const store = await loadStore();

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
                            if (reqItem.receiver_email && !proj.member_ids.includes(reqItem.receiver_email)) {
                                proj.member_ids.push(reqItem.receiver_email);
                            }
                            if (reqItem.receiver_username && !proj.member_ids.includes(reqItem.receiver_username)) {
                                proj.member_ids.push(reqItem.receiver_username);
                            }
                        }
                    }
                    await saveStore(store);
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
                const recUser = findPdfUser(body.receiver_id) || findPdfUser(body.email) || findPdfUser(body.username) || findPdfUser(body.payload?.receiverEmail) || findPdfUser(body.payload?.receiverUsername);

                const receiverId = recUser ? recUser.id : (body.receiver_id || '');
                const receiverName = recUser ? recUser.name : (body.payload?.receiverName || 'Team Member');
                const receiverEmail = recUser ? recUser.email : (body.payload?.receiverEmail || body.email || '');
                const receiverUsername = recUser ? recUser.username : (body.payload?.receiverUsername || body.username || '');

                const senderName = authUser?.name || 'Administrator';
                const senderEmail = authUser?.email || 'admin@zoho.com';
                const senderUsername = authUser?.username || 'admin';

                const newReq = {
                    id: 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    sender_id: authUser?.id || 'usr-admin',
                    sender_name: senderName,
                    sender_email: senderEmail,
                    sender_username: senderUsername,
                    receiver_id: receiverId,
                    receiver_name: receiverName,
                    receiver_email: receiverEmail,
                    receiver_username: receiverUsername,
                    request_type: body.request_type || 'PROJECT_INVITE',
                    target_entity_id: body.target_entity_id || body.payload?.projectId,
                    project_name: body.payload?.projectName || 'Project Workspace',
                    project_prefix: body.payload?.projectPrefix || 'PRJ',
                    payload: {
                        ...(body.payload || {}),
                        receiverName,
                        receiverEmail,
                        receiverUsername,
                        inviterName: senderName,
                        inviterEmail: senderEmail,
                        inviterUsername: senderUsername
                    },
                    status: 'PENDING',
                    created_at: new Date().toISOString(),
                    responded_at: null,
                    sender: {
                        id: authUser?.id || 'usr-admin',
                        name: senderName,
                        email: senderEmail,
                        username: senderUsername
                    },
                    receiver: {
                        id: receiverId,
                        name: receiverName,
                        email: receiverEmail,
                        username: receiverUsername
                    },
                    project: {
                        id: body.target_entity_id || body.payload?.projectId,
                        name: body.payload?.projectName || 'Project Workspace',
                        key_prefix: body.payload?.projectPrefix || 'PRJ'
                    }
                };

                store.requests.unshift(newReq);
                await saveStore(store);

                return {
                    statusCode: 201,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: true, data: newReq })
                };
            }

            if (cleanPath.includes('/incoming')) {
                const incoming = store.requests.filter(r => isUserRecipient(r, authUser) && r.status === 'PENDING');
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
            const store = await loadStore();
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
        }
`;

const updatedCode = code.substring(0, storeIdx) + replacementSection + '\n        ' + code.substring(route7Idx);
const finalCode = isCrlf ? updatedCode.replace(/\n/g, '\r\n') : updatedCode;
fs.writeFileSync(apiPath, finalCode, 'utf8');
console.log('Successfully patched netlify/functions/api.js with persistent store & public/private scoping!');
