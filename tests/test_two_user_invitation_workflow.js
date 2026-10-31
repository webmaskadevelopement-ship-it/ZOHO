const assert = require('assert');
const netlifyHandler = require('../netlify/functions/api').handler;

function callHandler(httpMethod, path, body = null, headers = {}) {
    return new Promise((resolve) => {
        const event = {
            httpMethod,
            path,
            headers: {
                'content-type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : null,
            queryStringParameters: {}
        };
        const context = {};
        netlifyHandler(event, context).then((res) => {
            let data = {};
            try {
                data = JSON.parse(res.body);
            } catch (e) {
                data = res.body;
            }
            resolve({ statusCode: res.statusCode, data });
        }).catch(err => {
            resolve({ statusCode: 500, error: err.message });
        });
    });
}

async function runTwoUserInvitationWorkflow() {
    console.log('===============================================================');
    console.log('TESTING COMPLETE TWO-USER INVITATION WORKFLOW (NETLIFY SERVERLESS)');
    console.log('===============================================================\n');

    // 1. User A (Ravi) logs in
    console.log('1. User A (Ravi Bhadoria) logs in...');
    const loginA = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ravi.bhadoria',
        password: 'Zoho@Ravi#2026'
    });
    assert.strictEqual(loginA.statusCode, 200, 'Ravi login should return 200');
    assert.ok(loginA.data.data.token, 'Ravi should receive auth token');
    const tokenA = loginA.data.data.token;
    const userA = loginA.data.data.user;
    console.log(`   ✓ Logged in as: ${userA.name} (${userA.email}), ID: ${userA.id}`);

    // 2. Ravi creates a private project
    console.log('\n2. Ravi creates a project...');
    const createProj = await callHandler('POST', '/api/v1/projects', {
        name: 'Alpha Redesign ' + Date.now().toString(36),
        keyPrefix: 'ALP',
        isPublic: 0,
        description: 'Confidential project created by Ravi'
    }, { 'Authorization': `Bearer ${tokenA}` });
    assert.strictEqual(createProj.statusCode, 201, 'Project create should return 201');
    const project = createProj.data.data;
    console.log(`   ✓ Project created: "${project.name}" (ID: ${project.id})`);

    // 3. Ravi sends in-app invitation to User B (Ananya Gupta)
    console.log('\n3. Ravi invites User B (Ananya Gupta) to collaborate on the project...');
    const sendInvite = await callHandler('POST', '/api/v1/requests', {
        receiver_id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8', // UUID from UI dropdown
        receiver_email: 'ananya.gupta@zoho.com',
        receiver_username: 'ananya.gupta',
        request_type: 'PROJECT_INVITE',
        target_entity_id: project.id,
        payload: {
            projectId: project.id,
            projectName: project.name,
            projectPrefix: project.keyPrefix,
            role: 'employee',
            message: 'Hi Ananya, please join this project for UI/UX wireframes.',
            receiverName: 'Ananya Gupta',
            receiverEmail: 'ananya.gupta@zoho.com',
            receiverUsername: 'ananya.gupta',
            inviterName: userA.name,
            inviterEmail: userA.email
        }
    }, { 'Authorization': `Bearer ${tokenA}` });
    assert.strictEqual(sendInvite.statusCode, 201, 'Invite creation should return 201');
    const request = sendInvite.data.data;
    console.log(`   ✓ Invitation created (Request ID: ${request.id}, Status: ${request.status})`);

    // 4. Ravi views "My Approvals"
    console.log('\n4. Ravi views My Approvals (Sent status)...');
    const raviApprovals = await callHandler('GET', '/api/v1/requests/approvals', null, {
        'Authorization': `Bearer ${tokenA}`
    });
    assert.strictEqual(raviApprovals.statusCode, 200, 'Ravi approvals should return 200');
    const raviReq = raviApprovals.data.data.find(r => r.id === request.id);
    assert.ok(raviReq, 'Ravi should see the invitation in My Approvals');
    assert.strictEqual(raviReq.status, 'PENDING');
    assert.strictEqual(raviReq.approval_status, 'Pending Approval');
    console.log(`   ✓ Visible in Ravi's My Approvals:`);
    console.log(`     - Project: ${raviReq.project.name}`);
    console.log(`     - Receiver: ${raviReq.receiver.name} (${raviReq.receiver.email})`);
    console.log(`     - Status: ${raviReq.approval_status}`);

    // 5. Ravi signs out (simulated by dropping tokenA)
    console.log('\n5. Ravi signs out...');

    // 6. User B (Ananya Gupta) logs in
    console.log('\n6. User B (Ananya Gupta) logs in...');
    const loginB = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ananya.gupta',
        password: 'Zoho@Anan#2026'
    });
    assert.strictEqual(loginB.statusCode, 200, 'Ananya login should return 200');
    assert.ok(loginB.data.data.token, 'Ananya should receive auth token');
    const tokenB = loginB.data.data.token;
    const userB = loginB.data.data.user;
    console.log(`   ✓ Logged in as: ${userB.name} (${userB.email}), ID: ${userB.id}`);

    // 7. Ananya checks incoming requests (/api/v1/requests/incoming)
    console.log('\n7. Ananya checks incoming requests dropdown badge...');
    const ananyaIncoming = await callHandler('GET', '/api/v1/requests/incoming', null, {
        'Authorization': `Bearer ${tokenB}`
    });
    assert.strictEqual(ananyaIncoming.statusCode, 200, 'Incoming requests should return 200');
    const ananyaReq = ananyaIncoming.data.data.find(r => r.id === request.id);
    assert.ok(ananyaReq, 'Ananya MUST see the incoming invitation in her account!');
    console.log(`   ✓ INCOMING REQUEST FOUND in Ananya\'s account!`);
    console.log(`     - Sender: ${ananyaReq.sender_name || ananyaReq.sender.name} (${ananyaReq.sender_email || ananyaReq.sender.email})`);
    console.log(`     - Type: ${ananyaReq.request_type}`);
    console.log(`     - Message: ${ananyaReq.payload.message}`);

    // 8. Ananya checks "My Approvals" section
    console.log('\n8. Ananya checks "My Approvals" table...');
    const ananyaApprovals = await callHandler('GET', '/api/v1/requests/approvals', null, {
        'Authorization': `Bearer ${tokenB}`
    });
    assert.strictEqual(ananyaApprovals.statusCode, 200, 'Approvals should return 200');
    const ananyaApprovalItem = ananyaApprovals.data.data.find(r => r.id === request.id);
    assert.ok(ananyaApprovalItem, 'Ananya MUST see the approval item in My Approvals!');
    assert.strictEqual(ananyaApprovalItem.status, 'PENDING');
    assert.strictEqual(ananyaApprovalItem.approval_status, 'Pending Approval');
    console.log(`   ✓ MY APPROVALS RECORD FOUND for Ananya!`);
    console.log(`     - Who sent: ${ananyaApprovalItem.sender.name} (${ananyaApprovalItem.sender.email})`);
    console.log(`     - Which project: ${ananyaApprovalItem.project.name}`);
    console.log(`     - Current status: ${ananyaApprovalItem.approval_status}`);
    console.log(`     - Is Approved: ${ananyaApprovalItem.is_approved}`);

    // 9. Ananya accepts the request
    console.log('\n9. Ananya accepts the project invitation...');
    const acceptRes = await callHandler('PATCH', `/api/v1/requests/${request.id}/respond`, {
        action: 'ACCEPT'
    }, { 'Authorization': `Bearer ${tokenB}` });
    assert.strictEqual(acceptRes.statusCode, 200, 'Accepting request should return 200');
    console.log(`   ✓ Invitation accepted: ${acceptRes.data.data.status}`);

    // 10. Verify incoming requests is now 0 pending for Ananya
    console.log('\n10. Verify incoming requests is updated...');
    const incomingAfter = await callHandler('GET', '/api/v1/requests/incoming', null, {
        'Authorization': `Bearer ${tokenB}`
    });
    const stillPending = incomingAfter.data.data.some(r => r.id === request.id);
    assert.strictEqual(stillPending, false, 'Accepted request should no longer be in pending incoming list');
    console.log(`   ✓ Request cleared from pending incoming requests`);

    // 11. Verify My Approvals is updated to ACCEPTED / Approved
    console.log('\n11. Verify My Approvals shows Approved / Accepted status...');
    const approvalsAfter = await callHandler('GET', '/api/v1/requests/approvals', null, {
        'Authorization': `Bearer ${tokenB}`
    });
    const updatedApproval = approvalsAfter.data.data.find(r => r.id === request.id);
    assert.ok(updatedApproval, 'Approval item still exists in My Approvals history');
    assert.strictEqual(updatedApproval.status, 'ACCEPTED');
    assert.strictEqual(updatedApproval.is_approved, true);
    assert.strictEqual(updatedApproval.approval_status, 'Approved / Accepted');
    console.log(`   ✓ My Approvals updated: Status = ${updatedApproval.approval_status}, Is Approved = ${updatedApproval.is_approved}`);

    // 12. Verify Ananya now has access to the private project
    console.log('\n12. Verify Ananya now has access to the shared project...');
    const ananyaProjects = await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenB}`
    });
    const projectVisible = ananyaProjects.data.data.some(p => p.id === project.id);
    assert.strictEqual(projectVisible, true, 'Ananya MUST now see the shared project in her project list!');
    console.log(`   ✓ Project "${project.name}" is now accessible in Ananya's project list!`);

    // 13. Data Isolation Check for third user (Ineet)
    console.log('\n13. Data Isolation Check for third-party user (Ineet)...');
    const loginC = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ineet',
        password: 'Zoho@Inee#2026'
    });
    const tokenC = loginC.data.data.token;

    const ineetIncoming = await callHandler('GET', '/api/v1/requests/incoming', null, {
        'Authorization': `Bearer ${tokenC}`
    });
    const ineetSeesInvite = ineetIncoming.data.data.some(r => r.id === request.id);
    assert.strictEqual(ineetSeesInvite, false, 'Ineet should not receive Ananya\'s invite');

    const ineetApprovals = await callHandler('GET', '/api/v1/requests/approvals', null, {
        'Authorization': `Bearer ${tokenC}`
    });
    const ineetSeesApproval = ineetApprovals.data.data.some(r => r.id === request.id);
    assert.strictEqual(ineetSeesApproval, false, 'Ineet should not see private approvals');

    const ineetProjects = await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenC}`
    });
    const ineetSeesProj = ineetProjects.data.data.some(p => p.id === project.id);
    assert.strictEqual(ineetSeesProj, false, 'Ineet should not see Ravi & Ananya\'s private project');

    console.log('   ✓ Ineet cannot see private invite: Verified');
    console.log('   ✓ Ineet cannot see private approval: Verified');
    console.log('   ✓ Ineet cannot see private project: Verified');

    console.log('\n===============================================================');
    console.log('✓ ALL TWO-USER INVITATION & WORKFLOW TESTS PASSED PERFECTLY!');
    console.log('===============================================================');
}

runTwoUserInvitationWorkflow().catch(err => {
    console.error('\n❌ Test Failed:', err);
    process.exit(1);
});

