const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../netlify/functions/api.js');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Replace AUTHORIZED_PDF_USERS in Route 6.1
const oldAuthUsers = `            const AUTHORIZED_PDF_USERS = [
                { id: 'usr-ravi', name: 'Ravi Bhadoria', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com', password: 'Zoho@Ravi#2026', role: 'employee', department: 'Development' },
                { id: 'usr-ananya', name: 'Ananya Gupta', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com', password: 'Zoho@Anan#2026', role: 'employee', department: 'UI/UX Design' },
                { id: 'usr-ineet', name: 'Ineet', username: 'ineet', email: 'ineet@zoho.com', password: 'Zoho@Inee#2026', role: 'employee', department: 'Quality Assurance' },
                { id: 'usr-nikhil', name: 'Nikhil', username: 'nikhil', email: 'nikhil@zoho.com', password: 'Zoho@Nikh#2026', role: 'employee', department: 'Engineering' },
                { id: 'usr-ritika', name: 'Ritika', username: 'ritika', email: 'ritika@zoho.com', password: 'Zoho@Riti#2026', role: 'employee', department: 'Product Management' },
                { id: 'usr-shweta', name: 'Shweta', username: 'shweta', email: 'shweta@zoho.com', password: 'Zoho@Shwe#2026', role: 'employee', department: 'Operations' },
                { id: 'usr-ekta', name: 'Ekta', username: 'ekta', email: 'ekta@zoho.com', password: 'Zoho@Ekta#2026', role: 'employee', department: 'Frontend' },
                { id: 'usr-abhishek', name: 'Abhishek', username: 'abhishek', email: 'abhishek@zoho.com', password: 'Zoho@Abhi#2026', role: 'employee', department: 'Backend Systems' },
                { id: 'usr-prince', name: 'Prince', username: 'prince', email: 'prince@zoho.com', password: 'Zoho@Prin#2026', role: 'employee', department: 'Cloud & DevOps' },
                { id: 'usr-ali', name: 'Ali', username: 'ali', email: 'ali@zoho.com', password: 'Zoho@Ali1#2026', role: 'employee', department: 'Mobile Engineering' },
                { id: 'usr-admin', name: 'Nikhil Kaushik', username: 'admin', email: 'webmaskadevelopement@gmail.com', password: 'Zoho@Admin#2026', role: 'admin', department: 'Executive', alternates: ['admin123', 'FirebaseManagedAuth2026!'] },
                { id: 'usr-manager', name: 'Tushar', username: 'manager', email: 'backend.webmaska@gmail.com', password: 'Zoho@Manager#2026', role: 'manager', department: 'Management', alternates: ['manager123', 'Zoho@Tush#2026', 'FirebaseManagedAuth2026!'] }
            ];`;

const newAuthUsers = `            const AUTHORIZED_PDF_USERS = [
                { id: 'efac5612-9ff8-4f2a-884d-46ff5e470584', uuid: 'efac5612-9ff8-4f2a-884d-46ff5e470584', slugId: 'usr-ravi', name: 'Ravi Bhadoria', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com', password: 'Zoho@Ravi#2026', role: 'employee', department: 'Development' },
                { id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', uuid: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', slugId: 'usr-ananya', name: 'Ananya Gupta', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com', password: 'Zoho@Anan#2026', role: 'employee', department: 'UI/UX Design' },
                { id: 'ce170463-92f6-4f03-b801-9b57b82e862f', uuid: 'ce170463-92f6-4f03-b801-9b57b82e862f', slugId: 'usr-ineet', name: 'Ineet', username: 'ineet', email: 'ineet@zoho.com', password: 'Zoho@Inee#2026', role: 'employee', department: 'Quality Assurance' },
                { id: 'f6419896-0f5b-4c42-a0c1-587d9829d647', uuid: 'f6419896-0f5b-4c42-a0c1-587d9829d647', slugId: 'usr-nikhil', name: 'Nikhil', username: 'nikhil', email: 'nikhil@zoho.com', password: 'Zoho@Nikh#2026', role: 'employee', department: 'Engineering' },
                { id: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', uuid: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', slugId: 'usr-ritika', name: 'Ritika', username: 'ritika', email: 'ritika@zoho.com', password: 'Zoho@Riti#2026', role: 'employee', department: 'Product Management' },
                { id: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', uuid: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', slugId: 'usr-shweta', name: 'Shweta', username: 'shweta', email: 'shweta@zoho.com', password: 'Zoho@Shwe#2026', role: 'employee', department: 'Operations' },
                { id: 'c5783c9c-172c-435a-840b-bb4a33f627f8', uuid: 'c5783c9c-172c-435a-840b-bb4a33f627f8', slugId: 'usr-ekta', name: 'Ekta', username: 'ekta', email: 'ekta@zoho.com', password: 'Zoho@Ekta#2026', role: 'employee', department: 'Frontend' },
                { id: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', uuid: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', slugId: 'usr-abhishek', name: 'Abhishek', username: 'abhishek', email: 'abhishek@zoho.com', password: 'Zoho@Abhi#2026', role: 'employee', department: 'Backend Systems' },
                { id: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', uuid: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', slugId: 'usr-prince', name: 'Prince', username: 'prince', email: 'prince@zoho.com', password: 'Zoho@Prin#2026', role: 'employee', department: 'Cloud & DevOps' },
                { id: '324a1d25-0fe8-46b8-88c0-13a41fe93331', uuid: '324a1d25-0fe8-46b8-88c0-13a41fe93331', slugId: 'usr-ali', name: 'Ali', username: 'ali', email: 'ali@zoho.com', password: 'Zoho@Ali1#2026', role: 'employee', department: 'Mobile Engineering' },
                { id: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', uuid: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', slugId: 'usr-admin', name: 'Nikhil Kaushik', username: 'admin', email: 'webmaskadevelopement@gmail.com', password: 'Zoho@Admin#2026', role: 'admin', department: 'Executive', alternates: ['admin123', 'FirebaseManagedAuth2026!'] },
                { id: '0e4352f0-b919-449a-b68a-2091efa145d4', uuid: '0e4352f0-b919-449a-b68a-2091efa145d4', slugId: 'usr-manager', name: 'Tushar', username: 'manager', email: 'backend.webmaska@gmail.com', password: 'Zoho@Manager#2026', role: 'manager', department: 'Management', alternates: ['manager123', 'Zoho@Tush#2026', 'FirebaseManagedAuth2026!'] }
            ];`;

if (code.includes(oldAuthUsers)) {
    code = code.replace(oldAuthUsers, newAuthUsers);
    console.log('✓ Updated AUTHORIZED_PDF_USERS with canonical UUIDs and slug IDs');
}

// 2. Add Helper functions isUserRecipient and isUserSender before Route 6.8
const oldApprovalsSection = `        // Route 6.8: My Approvals (GET /api/v1/requests/approvals)
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
        }`;

const newApprovalsSection = `        // User Directory & Matching Helpers for In-App Requests
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

        // Route 6.8: My Approvals (GET /api/v1/requests/approvals)
        if (cleanPath.includes('/requests/approvals') && event.httpMethod === 'GET') {
            const authUser = getAuthUser(event);
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
                saveStore(store);

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
        }`;

if (code.includes(oldApprovalsSection)) {
    code = code.replace(oldApprovalsSection, newApprovalsSection);
    console.log('✓ Replaced Route 6.8 & 6.9 in api.js with universal user matching');
} else {
    console.error('Failed to locate oldApprovalsSection in api.js');
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Done.');

