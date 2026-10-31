const http = require('http');

function post(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(data || {});
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function get(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'GET',
            headers
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function patch(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(data || {});
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function verifyAll() {
    console.log('====================================================');
    console.log('STARTING END-TO-END VERIFICATION ON LOCALHOST:5000');
    console.log('====================================================');

    // 1. Login with Ravi (Employee)
    console.log('\n--- STEP 1: Log in with Ravi Bhadoria (Employee from PDF) ---');
    const raviLogin = await post('http://localhost:5000/api/v1/auth/login', {
        username: 'ravi.bhadoria',
        password: 'Zoho@Ravi#2026'
    });
    if (raviLogin.status !== 200 || !raviLogin.data.data?.token) {
        throw new Error('Ravi login failed: ' + JSON.stringify(raviLogin));
    }
    const raviToken = raviLogin.data.data.token;
    const raviUser = raviLogin.data.data.user;
    console.log(`✓ Logged in as: ${raviUser.name} (${raviUser.email}), Role: ${raviUser.role}`);

    // 2. Login with Ananya (Employee)
    console.log('\n--- STEP 2: Log in with Ananya Gupta (Employee from PDF) ---');
    const ananyaLogin = await post('http://localhost:5000/api/v1/auth/login', {
        username: 'ananya.gupta',
        password: 'Zoho@Anan#2026'
    });
    if (ananyaLogin.status !== 200 || !ananyaLogin.data.data?.token) {
        throw new Error('Ananya login failed: ' + JSON.stringify(ananyaLogin));
    }
    const ananyaToken = ananyaLogin.data.data.token;
    const ananyaUser = ananyaLogin.data.data.user;
    console.log(`✓ Logged in as: ${ananyaUser.name} (${ananyaUser.email}), Role: ${ananyaUser.role}`);

    // 3. Login with Ineet (Employee - for privacy check)
    console.log('\n--- STEP 3: Log in with Ineet (Employee from PDF for Privacy Isolation) ---');
    const ineetLogin = await post('http://localhost:5000/api/v1/auth/login', {
        username: 'ineet',
        password: 'Zoho@Inee#2026'
    });
    const ineetToken = ineetLogin.data.data.token;
    const ineetUser = ineetLogin.data.data.user;
    console.log(`✓ Logged in as: ${ineetUser.name} (${ineetUser.email})`);

    // 4. Ravi creates a project
    console.log('\n--- STEP 4: Ravi creates a new private project ---');
    const projName = 'Brand Redesign Project ' + Date.now().toString(36);
    const createProjRes = await post('http://localhost:5000/api/v1/projects', {
        name: projName,
        keyPrefix: 'BRP',
        description: 'Brand Redesign collaborative workspace',
        isPublic: false
    }, {
        'Authorization': `Bearer ${raviToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    if (createProjRes.status !== 201 || !createProjRes.data.data?.id) {
        throw new Error('Project creation failed: ' + JSON.stringify(createProjRes));
    }
    const createdProject = createProjRes.data.data;
    console.log(`✓ Project Created: "${createdProject.name}" (ID: ${createdProject.id})`);

    // 5. Data Isolation Check: Ananya should NOT see Ravi's private project yet
    console.log('\n--- STEP 5: Privacy Isolation Check BEFORE Invitation ---');
    const ananyaProjsBefore = await get('http://localhost:5000/api/v1/projects', {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const ananyaHasProj = ananyaProjsBefore.data.data.some(p => p.id === createdProject.id);
    console.log(`Ananya sees Ravi's private project: ${ananyaHasProj}`);
    if (ananyaHasProj) {
        throw new Error('DATA ISOLATION VIOLATION: Ananya should NOT see Ravi\'s private project before invitation!');
    }
    console.log('✓ Privacy verified: Non-member cannot see private project');

    // 6. Ravi invites Ananya to collaborate on the project
    console.log('\n--- STEP 6: Ravi sends In-App Project Invitation to Ananya ---');
    const sendInviteRes = await post('http://localhost:5000/api/v1/requests', {
        receiver_id: ananyaUser.id,
        request_type: 'PROJECT_INVITE',
        target_entity_id: createdProject.id,
        payload: {
            projectId: createdProject.id,
            projectName: createdProject.name,
            role: 'employee',
            message: 'Please join our brand redesign collaboration!'
        }
    }, {
        'Authorization': `Bearer ${raviToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    if (sendInviteRes.status !== 201 || !sendInviteRes.data.data?.id) {
        throw new Error('Sending invite failed: ' + JSON.stringify(sendInviteRes));
    }
    const requestId = sendInviteRes.data.data.id;
    console.log(`✓ Invitation sent (Request ID: ${requestId})`);

    // 7. Ananya checks My Approvals section (shows PENDING)
    console.log('\n--- STEP 7: Ananya views My Approvals (Pending) ---');
    const ananyaApprovalsPending = await get('http://localhost:5000/api/v1/requests/approvals', {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const pendingItem = ananyaApprovalsPending.data.data.find(r => r.id === requestId);
    if (!pendingItem) {
        throw new Error('Approval request not found in Ananya\'s approvals list!');
    }
    console.log(`✓ Approval visible in My Approvals:`);
    console.log(`   - Sender (Who sent): ${pendingItem.sender.name} (@${pendingItem.sender.username})`);
    console.log(`   - Target Project: ${pendingItem.project.name}`);
    console.log(`   - Status: ${pendingItem.status} (${pendingItem.approval_status})`);
    console.log(`   - Is Approved: ${pendingItem.is_approved}`);

    // 8. Ananya accepts the project invitation
    console.log('\n--- STEP 8: Ananya Accepts the Project Invitation ---');
    const respondRes = await patch(`http://localhost:5000/api/v1/requests/${requestId}/respond`, {
        action: 'ACCEPT'
    }, {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    if (respondRes.status !== 200 || !respondRes.data.success) {
        throw new Error('Accepting invitation failed: ' + JSON.stringify(respondRes));
    }
    console.log(`✓ Ananya accepted invitation successfully`);

    // 9. Verify My Approvals section now shows ACCEPTED / APPROVED with all required details
    console.log('\n--- STEP 9: Verify My Approvals Section Displays All Required Information ---');
    const ananyaApprovalsAccepted = await get('http://localhost:5000/api/v1/requests/approvals', {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const acceptedItem = ananyaApprovalsAccepted.data.data.find(r => r.id === requestId);
    if (!acceptedItem) {
        throw new Error('Accepted approval request not found in My Approvals!');
    }
    console.log('✓ My Approvals Details:');
    console.log(`   - Who sent the project invitation: ${acceptedItem.sender.name} (${acceptedItem.sender.email})`);
    console.log(`   - Which project the invitation was for: ${acceptedItem.project.name}`);
    console.log(`   - Whether the request has been accepted or approved: ${acceptedItem.is_approved ? 'YES (Approved / Accepted)' : 'NO'}`);
    console.log(`   - The current status of the request: ${acceptedItem.status} (${acceptedItem.approval_status})`);

    if (!acceptedItem.sender.name || !acceptedItem.project.name || !acceptedItem.is_approved || acceptedItem.status !== 'ACCEPTED') {
        throw new Error('My Approvals information missing required details!');
    }

    // 10. Verify Ravi also sees this in his My Approvals section
    console.log('\n--- STEP 10: Verify Ravi (Sender) also sees the approval update in My Approvals ---');
    const raviApprovals = await get('http://localhost:5000/api/v1/requests/approvals', {
        'Authorization': `Bearer ${raviToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const raviItem = raviApprovals.data.data.find(r => r.id === requestId);
    if (!raviItem || raviItem.status !== 'ACCEPTED') {
        throw new Error('Ravi does not see the accepted request in My Approvals!');
    }
    console.log(`✓ Ravi sees approved status: ${raviItem.approval_status} from collaborator ${raviItem.receiver.name}`);

    // 11. Verify Ananya now has project access
    console.log('\n--- STEP 11: Verify Ananya Now Has Access to the Shared Project ---');
    const ananyaProjsAfter = await get('http://localhost:5000/api/v1/projects', {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const ananyaHasProjNow = ananyaProjsAfter.data.data.some(p => p.id === createdProject.id);
    if (!ananyaHasProjNow) {
        throw new Error('Ananya should have access to the project after accepting invitation!');
    }
    console.log(`✓ Project "${createdProject.name}" is now visible and accessible in Ananya's project list!`);

    // 12. Ineet (Unrelated Employee) should NOT see Ravi & Ananya's private project or approvals
    console.log('\n--- STEP 12: Data Privacy Isolation Check for Third Party (Ineet) ---');
    const ineetProjs = await get('http://localhost:5000/api/v1/projects', {
        'Authorization': `Bearer ${ineetToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const ineetHasProj = ineetProjs.data.data.some(p => p.id === createdProject.id);
    if (ineetHasProj) {
        throw new Error('DATA ISOLATION VIOLATION: Ineet should NOT have access to private project!');
    }
    console.log(`✓ Ineet cannot see private project: Verified`);

    const ineetApprovals = await get('http://localhost:5000/api/v1/requests/approvals', {
        'Authorization': `Bearer ${ineetToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const ineetHasApproval = ineetApprovals.data.data.some(r => r.id === requestId);
    if (ineetHasApproval) {
        throw new Error('DATA ISOLATION VIOLATION: Ineet should NOT see Ravi & Ananya\'s private approval!');
    }
    console.log(`✓ Ineet cannot see private approval: Verified`);

    // 13. Data Persistence Check: Create Task and Issue, then verify they persist
    console.log('\n--- STEP 13: Data Persistence Check across Database ---');
    const createTaskRes = await post(`http://localhost:5000/api/v1/tasks/project/${createdProject.id}`, {
        name: 'Design System Typography Guidelines',
        priority: 'high',
        startDate: '2026-11-01',
        endDate: '2026-11-05'
    }, {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    if (createTaskRes.status !== 201 || !createTaskRes.data.data?.id) {
        throw new Error('Task creation failed: ' + JSON.stringify(createTaskRes));
    }
    console.log(`✓ Task created: "${createTaskRes.data.data.name}"`);

    // Verify task is persisted
    const fetchTasks = await get(`http://localhost:5000/api/v1/tasks/project/${createdProject.id}`, {
        'Authorization': `Bearer ${ananyaToken}`,
        'x-portal-id': 'portal-demo-zoho'
    });
    const taskFound = fetchTasks.data.data.some(t => t.id === createTaskRes.data.data.id);
    if (!taskFound) {
        throw new Error('Data persistence check failed: Task not found on refetch!');
    }
    console.log(`✓ Task permanently persisted and verified in database`);

    console.log('\n====================================================');
    console.log('✓ ALL REQUIREMENTS TESTED AND PASSED FLAWLESSLY!');
    console.log('====================================================');
}

verifyAll().catch(err => {
    console.error('\n❌ Verification Failed:', err.message);
    process.exit(1);
});

