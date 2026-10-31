const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Update logoutUser to not clear local database caches
const oldLogout = `async function logoutUser() {
    try {
        if (currentToken) {
            await fetch('/api/v1/auth/logout', { method: 'POST' });
        }
    } catch (err) {}
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
}`;

const newLogout = `async function logoutUser() {
    try {
        if (currentToken) {
            await fetch('/api/v1/auth/logout', { method: 'POST' });
        }
    } catch (err) {}
    localStorage.removeItem('life_pms_token');
    localStorage.removeItem('life_pms_user');
    localStorage.removeItem('life_pms_role');
    localStorage.removeItem('life_pms_current_user');
    sessionStorage.clear();
    window.location.href = '/login';
}`;

if (code.includes(oldLogout)) {
    code = code.replace(oldLogout, newLogout);
    console.log('✓ Patched logoutUser to preserve database caches');
}

// 2. Add User Matching Helpers at top of section 2
const helperDefs = `
const PDF_USERS_DIRECTORY_CLIENT = [
    { id: 'efac5612-9ff8-4f2a-884d-46ff5e470584', uuid: 'efac5612-9ff8-4f2a-884d-46ff5e470584', slugId: 'usr-ravi', name: 'Ravi Bhadoria', username: 'ravi.bhadoria', email: 'ravi.bhadoria@zoho.com', role: 'employee' },
    { id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', uuid: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', slugId: 'usr-ananya', name: 'Ananya Gupta', username: 'ananya.gupta', email: 'ananya.gupta@zoho.com', role: 'employee' },
    { id: 'ce170463-92f6-4f03-b801-9b57b82e862f', uuid: 'ce170463-92f6-4f03-b801-9b57b82e862f', slugId: 'usr-ineet', name: 'Ineet', username: 'ineet', email: 'ineet@zoho.com', role: 'employee' },
    { id: 'f6419896-0f5b-4c42-a0c1-587d9829d647', uuid: 'f6419896-0f5b-4c42-a0c1-587d9829d647', slugId: 'usr-nikhil', name: 'Nikhil', username: 'nikhil', email: 'nikhil@zoho.com', role: 'employee' },
    { id: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', uuid: '2eb4f501-5197-41be-a232-0ecbdf4e91f8', slugId: 'usr-ritika', name: 'Ritika', username: 'ritika', email: 'ritika@zoho.com', role: 'employee' },
    { id: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', uuid: '8df8b7cd-1563-4e2a-a7f4-552a69ed160e', slugId: 'usr-shweta', name: 'Shweta', username: 'shweta', email: 'shweta@zoho.com', role: 'employee' },
    { id: 'c5783c9c-172c-435a-840b-bb4a33f627f8', uuid: 'c5783c9c-172c-435a-840b-bb4a33f627f8', slugId: 'usr-ekta', name: 'Ekta', username: 'ekta', email: 'ekta@zoho.com', role: 'employee' },
    { id: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', uuid: 'b12a7c5d-4a90-40ad-b88f-16db239199b8', slugId: 'usr-abhishek', name: 'Abhishek', username: 'abhishek', email: 'abhishek@zoho.com', role: 'employee' },
    { id: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', uuid: 'f0ca2e5f-4528-4188-a00c-45e23a77c903', slugId: 'usr-prince', name: 'Prince', username: 'prince', email: 'prince@zoho.com', role: 'employee' },
    { id: '324a1d25-0fe8-46b8-88c0-13a41fe93331', uuid: '324a1d25-0fe8-46b8-88c0-13a41fe93331', slugId: 'usr-ali', name: 'Ali', username: 'ali', email: 'ali@zoho.com', role: 'employee' },
    { id: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', uuid: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', slugId: 'usr-admin', name: 'Nikhil Kaushik', username: 'admin', email: 'webmaskadevelopement@gmail.com', role: 'admin' },
    { id: '0e4352f0-b919-449a-b68a-2091efa145d4', uuid: '0e4352f0-b919-449a-b68a-2091efa145d4', slugId: 'usr-manager', name: 'Tushar', username: 'manager', email: 'backend.webmaska@gmail.com', role: 'manager' }
];

function findPdfUserClient(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).toLowerCase().trim();
    return PDF_USERS_DIRECTORY_CLIENT.find(u =>
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

    const targetUser = findPdfUserClient(uId) || findPdfUserClient(uEmail) || findPdfUserClient(uName);
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

    const reqReceiver = findPdfUserClient(rId) || findPdfUserClient(rEmail) || findPdfUserClient(rUser);
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

    const targetUser = findPdfUserClient(uId) || findPdfUserClient(uEmail) || findPdfUserClient(uName);
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

    const reqSender = findPdfUserClient(sId) || findPdfUserClient(sEmail) || findPdfUserClient(sUser);
    if (reqSender && targetUser && reqSender.id === targetUser.id) {
        return true;
    }
    return false;
}
`;

if (!code.includes('PDF_USERS_DIRECTORY_CLIENT')) {
    code = code.replace('// Static & Serverless Fallback Data Engine', helperDefs + '\n// Static & Serverless Fallback Data Engine');
    console.log('✓ Added client-side universal user matching helpers');
}

// 3. Update handleStaticApi for /api/v1/requests
const oldStaticRequests = `    // 24. In-App Requests System Fallback & Offline Persistence
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
        }`;

const newStaticRequests = `    // 24. In-App Requests System Fallback & Offline Persistence
    if (endpoint.startsWith('/api/v1/requests')) {
        let requests = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');

        // GET /api/v1/requests/approvals
        if (endpoint.includes('/approvals')) {
            let approvals = [...requests];
            if (currentUser && currentUser.role !== 'admin') {
                approvals = approvals.filter(r => isUserSender(r, currentUser) || isUserRecipient(r, currentUser));
            }
            return {
                success: true,
                count: approvals.length,
                data: approvals.map(r => {
                    const payload = r.payload || {};
                    const sUser = findPdfUserClient(r.sender_id) || findPdfUserClient(r.sender_email) || {};
                    const rUser = findPdfUserClient(r.receiver_id) || findPdfUserClient(r.receiver_email) || {};
                    return {
                        id: r.id,
                        request_type: r.request_type || 'PROJECT_INVITE',
                        target_entity_id: r.target_entity_id || payload.projectId,
                        status: r.status || 'PENDING',
                        created_at: r.created_at || new Date().toISOString(),
                        responded_at: r.responded_at || null,
                        payload: payload,
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
            };
        }

        // GET /api/v1/requests/incoming
        if (endpoint.includes('/incoming')) {
            const incoming = requests.filter(r => isUserRecipient(r, currentUser) && r.status === 'PENDING');
            return { success: true, count: incoming.length, data: incoming };
        }`;

if (code.includes(oldStaticRequests)) {
    code = code.replace(oldStaticRequests, newStaticRequests);
    console.log('✓ Patched handleStaticApi requests with universal matching');
}

// 4. Update setupInviteMemberModal in app.js
const oldInviteSubmit = `        const selectedOption = memberSelect.options[memberSelect.selectedIndex];
        const memberName = selectedOption ? selectedOption.text.split('(')[0].trim() : 'Team Member';
        const projName = projSelect.options[projSelect.selectedIndex]?.text || 'Project';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending In-App Invite...';
        }

        try {
            const res = await apiFetch('/api/v1/requests', {
                method: 'POST',
                body: JSON.stringify({
                    receiver_id: receiverId,
                    request_type: 'PROJECT_INVITE',
                    target_entity_id: projectId,
                    payload: {
                        projectId,
                        projectName: projName,
                        role,
                        message,
                        inviterName: currentUser?.name || 'Administrator',
                        inviterEmail: currentUser?.email
                    }
                })
            });

            if (res.success) {
                closeModal('modalInviteMember');
                if (messageInput) messageInput.value = '';
                alert(\`✓ In-App Project Invitation successfully sent to \${memberName}!\\n\\nThey will receive it directly within their application account to Accept or Decline.\`);
            } else {
                alert(res.error || 'Failed to send invitation.');
            }
        } catch (err) {
            alert('Invitation error: ' + err.message);
        } finally {`;

const newInviteSubmit = `        const selectedOption = memberSelect.options[memberSelect.selectedIndex];
        const memberName = selectedOption ? selectedOption.text.split('(')[0].trim() : 'Team Member';
        const receiverUsername = selectedOption?.getAttribute('data-username') || '';
        const receiverEmail = selectedOption?.getAttribute('data-email') || '';
        const projName = projSelect.options[projSelect.selectedIndex]?.text || 'Project';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending In-App Invite...';
        }

        const invitePayload = {
            receiver_id: receiverId,
            receiver_email: receiverEmail,
            receiver_username: receiverUsername,
            email: receiverEmail,
            username: receiverUsername,
            request_type: 'PROJECT_INVITE',
            target_entity_id: projectId,
            payload: {
                projectId,
                projectName: projName,
                role,
                message,
                receiverName: memberName,
                receiverEmail,
                receiverUsername,
                inviterName: currentUser?.name || 'Administrator',
                inviterEmail: currentUser?.email || '',
                inviterUsername: currentUser?.username || ''
            }
        };

        try {
            const res = await apiFetch('/api/v1/requests', {
                method: 'POST',
                body: JSON.stringify(invitePayload)
            });

            if (res.success) {
                closeModal('modalInviteMember');
                if (messageInput) messageInput.value = '';

                const reqItem = res.data || {
                    id: 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
                    sender_id: currentUser?.id,
                    sender_name: currentUser?.name || 'Administrator',
                    sender_email: currentUser?.email || '',
                    sender_username: currentUser?.username || '',
                    receiver_id: receiverId,
                    receiver_name: memberName,
                    receiver_email: receiverEmail,
                    receiver_username: receiverUsername,
                    request_type: 'PROJECT_INVITE',
                    target_entity_id: projectId,
                    project_name: projName,
                    payload: invitePayload.payload,
                    status: 'PENDING',
                    created_at: new Date().toISOString()
                };

                // Store in local storage
                let localReqs = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
                localReqs = localReqs.filter(r => r.id !== reqItem.id);
                localReqs.unshift(reqItem);
                localStorage.setItem('life_pms_in_app_requests', JSON.stringify(localReqs));

                // Dual-sync directly to Cloud Firestore collection "in_app_requests"
                if (window.firebaseAuthClient?.saveInAppRequestToFirestore) {
                    window.firebaseAuthClient.saveInAppRequestToFirestore(reqItem).catch(() => {});
                }

                alert(\`✓ In-App Project Invitation successfully sent to \${memberName}!\\n\\nThey will receive it directly within their application account to Accept or Decline.\`);
            } else {
                alert(res.error || 'Failed to send invitation.');
            }
        } catch (err) {
            alert('Invitation error: ' + err.message);
        } finally {`;

if (code.includes(oldInviteSubmit)) {
    code = code.replace(oldInviteSubmit, newInviteSubmit);
    console.log('✓ Patched setupInviteMemberModal with dual-sync to Firestore and rich payload');
}

// 5. Update fetchIncomingRequests in app.js
const oldFetchIncoming = `async function fetchIncomingRequests() {
    try {
        const res = await apiFetch('/api/v1/requests/incoming');
        if (res.success && Array.isArray(res.data)) {
            incomingRequestsCache = res.data;
            const count = incomingRequestsCache.length;
            const badge = document.getElementById('request-badge');
            const countTag = document.getElementById('requestsDropdownCount');

            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
            if (countTag) {
                countTag.textContent = \`\${count} Pending\`;
            }

            renderRequestsDropdown();
        }
    } catch (err) {
        console.warn('[Requests] Failed to fetch incoming requests:', err.message);
    }
}`;

const newFetchIncoming = `async function fetchIncomingRequests() {
    try {
        const res = await apiFetch('/api/v1/requests/incoming');
        let incoming = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];

        // Check local storage requests
        const localReqs = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
        const localIncoming = localReqs.filter(r => isUserRecipient(r, currentUser) && r.status === 'PENDING');

        const reqMap = new Map();
        localIncoming.forEach(r => { if (r && r.id) reqMap.set(r.id, r); });
        incoming.forEach(r => { if (r && r.id) reqMap.set(r.id, { ...reqMap.get(r.id), ...r }); });

        // Query Cloud Firestore collection "in_app_requests"
        if (window.firebaseAuthClient?.fetchInAppRequestsFromFirestore) {
            try {
                const fbReqs = await window.firebaseAuthClient.fetchInAppRequestsFromFirestore(currentUser);
                const fbIncoming = (fbReqs || []).filter(r => isUserRecipient(r, currentUser) && r.status === 'PENDING');
                fbIncoming.forEach(r => { if (r && r.id) reqMap.set(r.id, { ...reqMap.get(r.id), ...r }); });
            } catch (fbErr) {}
        }

        incomingRequestsCache = Array.from(reqMap.values());
        const count = incomingRequestsCache.length;
        const badge = document.getElementById('request-badge');
        const countTag = document.getElementById('requestsDropdownCount');

        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (countTag) {
            countTag.textContent = \`\${count} Pending\`;
        }

        renderRequestsDropdown();
    } catch (err) {
        console.warn('[Requests] Failed to fetch incoming requests:', err.message);
    }
}`;

if (code.includes(oldFetchIncoming)) {
    code = code.replace(oldFetchIncoming, newFetchIncoming);
    console.log('✓ Patched fetchIncomingRequests with multi-source merging (Backend + Local + Firestore)');
}

// 6. Update loadApprovalsView in app.js
const oldLoadApprovals = `    try {
        const res = await apiFetch('/api/v1/requests/approvals');
        if (res.success && Array.isArray(res.data)) {
            allApprovalsCache = res.data;
        } else {
            allApprovalsCache = [];
        }
    } catch (err) {
        console.warn('[Approvals] Error fetching approvals:', err.message);
        // Fallback to local cache if present
        allApprovalsCache = JSON.parse(localStorage.getItem('life_pms_approvals') || '[]');
    }

    updateApprovalsCounters();
    renderApprovalsTable();`;

const newLoadApprovals = `    try {
        const res = await apiFetch('/api/v1/requests/approvals');
        let approvals = (res && res.success && Array.isArray(res.data)) ? [...res.data] : [];

        // Merge with local storage
        const localReqs = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
        const reqMap = new Map();
        localReqs.forEach(r => {
            if (r && r.id) {
                if (currentUser?.role === 'admin' || isUserSender(r, currentUser) || isUserRecipient(r, currentUser)) {
                    reqMap.set(r.id, r);
                }
            }
        });
        approvals.forEach(r => { if (r && r.id) reqMap.set(r.id, { ...reqMap.get(r.id), ...r }); });

        // Merge with Cloud Firestore
        if (window.firebaseAuthClient?.fetchInAppRequestsFromFirestore) {
            try {
                const fbReqs = await window.firebaseAuthClient.fetchInAppRequestsFromFirestore(currentUser);
                (fbReqs || []).forEach(r => {
                    if (r && r.id) {
                        if (currentUser?.role === 'admin' || isUserSender(r, currentUser) || isUserRecipient(r, currentUser)) {
                            reqMap.set(r.id, { ...reqMap.get(r.id), ...r });
                        }
                    }
                });
            } catch (fbErr) {}
        }

        allApprovalsCache = Array.from(reqMap.values());
    } catch (err) {
        console.warn('[Approvals] Error fetching approvals:', err.message);
        allApprovalsCache = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
    }

    updateApprovalsCounters();
    renderApprovalsTable();`;

if (code.includes(oldLoadApprovals)) {
    code = code.replace(oldLoadApprovals, newLoadApprovals);
    console.log('✓ Patched loadApprovalsView with multi-source merging (Backend + Local + Firestore)');
}

// 7. Update handleRespondRequest & handleApprovalsRespond to update Firestore
const oldRespondApproval = `            // Sync project list so the newly accepted project is loaded into the user workspace
            if (action === 'ACCEPT') {
                if (typeof loadProjectsList === 'function') await loadProjectsList();
            }`;

const newRespondApproval = `            // Update in local storage
            let localReqs = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
            const rIdx = localReqs.findIndex(r => r.id === requestId);
            if (rIdx !== -1) {
                localReqs[rIdx].status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
                localReqs[rIdx].responded_at = new Date().toISOString();
                localStorage.setItem('life_pms_in_app_requests', JSON.stringify(localReqs));
            }

            // Update in Cloud Firestore
            if (window.firebaseAuthClient?.updateInAppRequestInFirestore) {
                window.firebaseAuthClient.updateInAppRequestInFirestore(requestId, {
                    status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
                    responded_at: new Date().toISOString()
                }).catch(() => {});
            }

            // Sync project list so the newly accepted project is loaded into the user workspace
            if (action === 'ACCEPT') {
                if (typeof loadProjectsList === 'function') await loadProjectsList();
            }`;

if (code.includes(oldRespondApproval)) {
    code = code.replace(oldRespondApproval, newRespondApproval);
    console.log('✓ Patched handleApprovalsRespond to dual-update local storage and Firestore');
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Done patching app.js');
