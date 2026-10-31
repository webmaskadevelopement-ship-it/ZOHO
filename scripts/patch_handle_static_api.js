const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(appPath, 'utf8');

// 1. Update GET /api/v1/projects in handleStaticApi with user isolation
const oldProjsReturn = `        return { success: true, data: projs };
    }

    // 2. Task Lists`;

const newProjsReturn = `        if (currentUser && currentUser.role !== 'admin') {
            const myId = currentUser.id;
            const myEmail = currentUser.email;
            projs = projs.filter(p => {
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
        return { success: true, data: projs };
    }

    // 2. Task Lists`;

if (code.includes(oldProjsReturn)) {
    code = code.replace(oldProjsReturn, newProjsReturn);
    console.log('✓ Added user scoping to GET projects in handleStaticApi');
}

// 2. Add in-app requests & directory support in handleStaticApi before // Default safe response
const oldDefaultSafe = `    // Default safe response
    return { success: true, data: [] };`;

const requestsStaticLogic = `    // 24. In-App Requests System Fallback & Offline Persistence
    if (endpoint.startsWith('/api/v1/requests')) {
        let requests = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');

        // GET /api/v1/requests/approvals
        if (endpoint.includes('/approvals')) {
            let approvals = [...requests];
            if (currentUser && currentUser.role !== 'admin') {
                const myId = currentUser.id;
                const myEmail = currentUser.email;
                approvals = approvals.filter(r => {
                    return r.sender_id === myId || r.receiver_id === myId ||
                           (r.sender && (r.sender.id === myId || r.sender.email === myEmail)) ||
                           (r.receiver && (r.receiver.id === myId || r.receiver.email === myEmail)) ||
                           (r.payload && (r.payload.inviterEmail === myEmail || r.payload.receiverEmail === myEmail));
                });
            }
            return {
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
                        payload: payload,
                        sender: r.sender || {
                            id: r.sender_id,
                            name: payload.inviterName || 'Administrator',
                            email: payload.inviterEmail || 'admin@zoho.com',
                            username: payload.inviterUsername || 'admin'
                        },
                        receiver: r.receiver || {
                            id: r.receiver_id,
                            name: payload.receiverName || 'Team Member',
                            email: payload.receiverEmail || 'employee@zoho.com',
                            username: payload.receiverUsername || 'employee'
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
            };
        }

        // GET /api/v1/requests/incoming
        if (endpoint.includes('/incoming')) {
            const myId = currentUser?.id;
            const myEmail = currentUser?.email;
            const incoming = requests.filter(r => {
                const isForMe = r.receiver_id === myId || (r.receiver && (r.receiver.id === myId || r.receiver.email === myEmail)) || (r.payload && r.payload.receiverEmail === myEmail);
                return isForMe && r.status === 'PENDING';
            });
            return { success: true, count: incoming.length, data: incoming };
        }

        // GET /api/v1/requests/sent
        if (endpoint.includes('/sent')) {
            const myId = currentUser?.id;
            const sent = requests.filter(r => r.sender_id === myId || (r.sender && r.sender.id === myId));
            return { success: true, count: sent.length, data: sent };
        }

        // PATCH /api/v1/requests/:id/respond
        if (endpoint.includes('/respond') && method === 'PATCH') {
            const parts = endpoint.split('/');
            const reqId = parts[parts.indexOf('requests') + 1];
            const action = body.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
            const reqIdx = requests.findIndex(r => r.id === reqId);
            if (reqIdx !== -1) {
                requests[reqIdx].status = action;
                requests[reqIdx].responded_at = new Date().toISOString();
                localStorage.setItem('life_pms_in_app_requests', JSON.stringify(requests));

                // If ACCEPT and PROJECT_INVITE: grant project access
                if (action === 'ACCEPTED' && requests[reqIdx].target_entity_id) {
                    const targetProjId = requests[reqIdx].target_entity_id;
                    let projs = JSON.parse(localStorage.getItem('life_pms_projects') || '[]');
                    const pIdx = projs.findIndex(p => p.id === targetProjId);
                    if (pIdx !== -1) {
                        let members = [];
                        try {
                            members = Array.isArray(projs[pIdx].member_ids) ? projs[pIdx].member_ids : (typeof projs[pIdx].member_ids === 'string' ? JSON.parse(projs[pIdx].member_ids || '[]') : []);
                        } catch (e) { members = []; }
                        const receiverId = requests[reqIdx].receiver_id || currentUser?.id;
                        if (receiverId && !members.includes(receiverId)) {
                            members.push(receiverId);
                            projs[pIdx].member_ids = members;
                            localStorage.setItem('life_pms_projects', JSON.stringify(projs));
                            if (window.firebaseAuthClient?.saveProjectToFirestore) {
                                window.firebaseAuthClient.saveProjectToFirestore(projs[pIdx]).catch(() => {});
                            }
                        }
                    }
                }
            }
            return { success: true, data: { status: action } };
        }

        // DELETE /api/v1/requests/:id
        if (method === 'DELETE') {
            const parts = endpoint.split('/');
            const reqId = parts[parts.indexOf('requests') + 1];
            requests = requests.filter(r => r.id !== reqId);
            localStorage.setItem('life_pms_in_app_requests', JSON.stringify(requests));
            return { success: true };
        }

        // POST /api/v1/requests
        if (method === 'POST') {
            const newReq = {
                id: 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                sender_id: currentUser?.id || 'admin',
                receiver_id: body.receiver_id || '',
                request_type: body.request_type || 'PROJECT_INVITE',
                target_entity_id: body.target_entity_id || body.payload?.projectId,
                payload: body.payload || {},
                status: 'PENDING',
                created_at: new Date().toISOString(),
                responded_at: null,
                sender: {
                    id: currentUser?.id,
                    name: currentUser?.name || 'Administrator',
                    email: currentUser?.email || 'admin@zoho.com',
                    username: currentUser?.username || 'admin'
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
                },
                role: body.payload?.role || 'employee',
                is_approved: false,
                approval_status: 'Pending Approval'
            };
            requests.unshift(newReq);
            localStorage.setItem('life_pms_in_app_requests', JSON.stringify(requests));
            return { success: true, data: newReq };
        }

        return { success: true, data: requests };
    }

    // 25. Users Directory Fallback (Exact 10 Authorized PDF Employees)
    if (endpoint.includes('/users/directory')) {
        const authorizedEmployees = [
            { id: 'usr-ravi', name: 'Ravi Bhadoria', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com', role: 'employee', department: 'Development', status: 'active' },
            { id: 'usr-ananya', name: 'Ananya Gupta', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com', role: 'employee', department: 'UI/UX Design', status: 'active' },
            { id: 'usr-ineet', name: 'Ineet', username: 'ineet', email: 'ineet@zoho.com', role: 'employee', department: 'Quality Assurance', status: 'active' },
            { id: 'usr-nikhil', name: 'Nikhil', username: 'nikhil', email: 'nikhil@zoho.com', role: 'employee', department: 'Engineering', status: 'active' },
            { id: 'usr-ritika', name: 'Ritika', username: 'ritika', email: 'ritika@zoho.com', role: 'employee', department: 'Product Management', status: 'active' },
            { id: 'usr-shweta', name: 'Shweta', username: 'shweta', email: 'shweta@zoho.com', role: 'employee', department: 'Operations', status: 'active' },
            { id: 'usr-ekta', name: 'Ekta', username: 'ekta', email: 'ekta@zoho.com', role: 'employee', department: 'Frontend', status: 'active' },
            { id: 'usr-abhishek', name: 'Abhishek', username: 'abhishek', email: 'abhishek@zoho.com', role: 'employee', department: 'Backend Systems', status: 'active' },
            { id: 'usr-prince', name: 'Prince', username: 'prince', email: 'prince@zoho.com', role: 'employee', department: 'Cloud & DevOps', status: 'active' },
            { id: 'usr-ali', name: 'Ali', username: 'ali', email: 'ali@zoho.com', role: 'employee', department: 'Mobile Engineering', status: 'active' }
        ];
        return {
            success: true,
            count: authorizedEmployees.length,
            data: authorizedEmployees.map(u => ({
                ...u,
                connection_status: u.id === currentUser?.id ? 'SELF' : 'NONE'
            }))
        };
    }

    // Default safe response
    return { success: true, data: [] };`;

if (code.includes(oldDefaultSafe)) {
    code = code.replace(oldDefaultSafe, requestsStaticLogic);
    console.log('✓ Added requests and directory fallback logic to handleStaticApi');
}

fs.writeFileSync(appPath, code, 'utf8');
console.log('Done.');

