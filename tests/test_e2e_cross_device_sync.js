/**
 * End-to-End Multi-Device Cross-Device Synchronization Test
 * Validates:
 * 1. Device 1 creates Public & Private projects, tasks, issues
 * 2. Complete Serverless Container Recycling (cold start)
 * 3. Device 2 (same user) fetches from central cloud store and gets exact same data
 * 4. Device 3 (different user) verifies Public vs Private visibility scoping
 * 5. In-app collaboration invite, acceptance, and My Approvals status
 */

const assert = require('assert');
const { handler } = require('../netlify/functions/api');

function mockEvent(method, path, body = null, headers = {}) {
    return {
        httpMethod: method,
        path: '/api/v1' + path,
        headers: {
            'content-type': 'application/json',
            ...headers
        },
        body: body ? JSON.stringify(body) : null
    };
}

async function run() {
    console.log('--- STARTING MULTI-DEVICE CROSS-DEVICE SYNCHRONIZATION TEST ---');

    // 1. Device 1: Login as Ravi Bhadoria
    console.log('[Device 1 - Windows Laptop] Logging in as ravi.bhadoria@zoho.com...');
    const loginRes1 = await handler(mockEvent('POST', '/auth/login', {
        username: 'ravi.bhadoria',
        password: 'Zoho@Ravi#2026'
    }));
    const loginData1 = JSON.parse(loginRes1.body);
    assert.strictEqual(loginData1.success, true, 'Device 1 login must succeed');
    const token1 = loginData1.data.token;
    const authHeaders1 = { 'authorization': `Bearer ${token1}` };

    // Device 1: Create a Public Project
    console.log('[Device 1] Creating Public Project "E2E Cloud Sync Engine"...');
    const pubProjRes = await handler(mockEvent('POST', '/projects', {
        name: 'E2E Cloud Sync Engine',
        keyPrefix: 'SYNC',
        isPublic: 1,
        description: 'Public workspace project for all employees'
    }, authHeaders1));
    const pubProj = JSON.parse(pubProjRes.body).data;
    assert.ok(pubProj.id, 'Public project must have ID');

    // Device 1: Create a Private Project
    console.log('[Device 1] Creating Private Project "Ravi Confidential Vault"...');
    const privProjRes = await handler(mockEvent('POST', '/projects', {
        name: 'Ravi Confidential Vault',
        keyPrefix: 'VAULT',
        isPublic: 0,
        description: 'Private project strictly visible only to Ravi'
    }, authHeaders1));
    const privProj = JSON.parse(privProjRes.body).data;
    assert.ok(privProj.id, 'Private project must have ID');

    // Device 1: Add a Task to Public Project
    console.log('[Device 1] Adding Task to Public Project...');
    const taskRes = await handler(mockEvent('POST', `/tasks/project/${pubProj.id}`, {
        name: 'Verify Multi-Device Sync Pipeline',
        priority: 'high',
        startDate: '2026-10-31'
    }, authHeaders1));
    const taskData = JSON.parse(taskRes.body).data;
    assert.ok(taskData.id, 'Task must be created');

    // Device 1: Report an Issue
    console.log('[Device 1] Submitting Bug Report...');
    const issueRes = await handler(mockEvent('POST', '/issues', {
        projectId: pubProj.id,
        title: 'Network latency optimization',
        severity: 'critical'
    }, authHeaders1));
    assert.strictEqual(issueRes.statusCode, 201, 'Issue must be created');

    // 2. SIMULATE COMPLETE CONTAINER COLD-START (Wipe local memory & /tmp)
    console.log('\n[Simulating Netlify Serverless Cold Start & Container Spin-Down]');
    global._serverlessProjects = undefined;
    global._serverlessTasks = undefined;
    global._serverlessTaskLists = undefined;
    global._serverlessIssues = undefined;
    global._serverlessPhases = undefined;
    global._serverlessRequests = undefined;
    const fs = require('fs');
    try { fs.unlinkSync('/tmp/life_pms_serverless_data.json'); } catch(e) {}
    console.log('✓ Container memory and /tmp completely wiped clean.\n');

    // 3. Device 2: Login as Ravi Bhadoria on MacBook / Mobile Phone (Cold Container)
    console.log('[Device 2 - MacBook/Mobile Phone] Logging into SAME account (ravi.bhadoria)...');
    const loginRes2 = await handler(mockEvent('POST', '/auth/login', {
        username: 'ravi.bhadoria',
        password: 'Zoho@Ravi#2026'
    }));
    const token2 = JSON.parse(loginRes2.body).data.token;
    const authHeaders2 = { 'authorization': `Bearer ${token2}` };

    // Device 2: Fetch Projects
    console.log('[Device 2] Fetching projects on new device from cold container...');
    const dev2ProjectsRes = await handler(mockEvent('GET', '/projects', null, authHeaders2));
    const dev2Projects = JSON.parse(dev2ProjectsRes.body).data;
    console.log(`[Device 2] Retrieved ${dev2Projects.length} projects.`);
    
    const foundPub = dev2Projects.find(p => p.id === pubProj.id);
    const foundPriv = dev2Projects.find(p => p.id === privProj.id);
    assert.ok(foundPub, 'Device 2 must retrieve Public Project');
    assert.ok(foundPriv, 'Device 2 must retrieve Private Project created by same account');

    // Device 2: Fetch Tasks for Public Project
    console.log('[Device 2] Fetching tasks for project on new device...');
    const dev2TasksRes = await handler(mockEvent('GET', `/tasks/project/${pubProj.id}`, null, authHeaders2));
    const dev2Tasks = JSON.parse(dev2TasksRes.body).data;
    assert.ok(dev2Tasks.some(t => t.id === taskData.id), 'Device 2 must retrieve tasks created on Device 1');

    // 4. Device 3: Login as Ritika (different employee)
    console.log('\n[Device 3 - iPhone] Logging in as different employee (ritika@zoho.com)...');
    const loginRes3 = await handler(mockEvent('POST', '/auth/login', {
        username: 'ritika',
        password: 'Zoho@Riti#2026'
    }));
    const token3 = JSON.parse(loginRes3.body).data.token;
    const authHeaders3 = { 'authorization': `Bearer ${token3}` };

    console.log('[Device 3] Verifying Public vs Private Project Visibility Rules...');
    const dev3ProjectsRes = await handler(mockEvent('GET', '/projects', null, authHeaders3));
    const dev3Projects = JSON.parse(dev3ProjectsRes.body).data;
    
    const ritikaSeesPub = dev3Projects.some(p => p.id === pubProj.id);
    const ritikaSeesPriv = dev3Projects.some(p => p.id === privProj.id);
    assert.strictEqual(ritikaSeesPub, true, 'Ritika MUST see Public projects');
    assert.strictEqual(ritikaSeesPriv, false, 'Ritika MUST NOT see Ravi\'s Private project');
    console.log('✓ Public project visible to all; Private project strictly hidden from unauthorized user.');

    // 5. In-App Collaboration Workflow: Ravi invites Ritika to the Private Project
    console.log('\n[Device 1] Ravi invites Ritika to collaborate on Private Project...');
    const inviteRes = await handler(mockEvent('POST', '/requests', {
        receiver_id: '2eb4f501-5197-41be-a232-0ecbdf4e91f8',
        email: 'ritika@zoho.com',
        username: 'ritika',
        request_type: 'PROJECT_INVITE',
        target_entity_id: privProj.id,
        payload: {
            projectId: privProj.id,
            projectName: privProj.name,
            projectPrefix: privProj.key_prefix,
            role: 'employee'
        }
    }, authHeaders1));
    const inviteData = JSON.parse(inviteRes.body).data;
    assert.ok(inviteData.id, 'Invitation request must be created');

    // Device 3: Ritika fetches incoming requests
    console.log('[Device 3] Ritika receives incoming collaboration request on mobile phone...');
    const incRes = await handler(mockEvent('GET', '/requests/incoming', null, authHeaders3));
    const incRequests = JSON.parse(incRes.body).data;
    const receivedInvite = incRequests.find(r => r.id === inviteData.id);
    assert.ok(receivedInvite, 'Ritika must receive the invitation request');

    // Device 3: Ritika ACCEPTS the request
    console.log('[Device 3] Ritika clicks ACCEPT on invitation...');
    const respondRes = await handler(mockEvent('PATCH', `/requests/${inviteData.id}/respond`, {
        action: 'ACCEPT'
    }, authHeaders3));
    assert.strictEqual(respondRes.statusCode, 200, 'Acceptance must succeed');

    // Cold-start simulation again
    global._serverlessProjects = undefined;
    global._serverlessRequests = undefined;

    // Device 3: Now Ritika refreshes projects
    console.log('[Device 3] Ritika checks projects after accepting invite...');
    const updatedProjectsRes = await handler(mockEvent('GET', '/projects', null, authHeaders3));
    const updatedProjects = JSON.parse(updatedProjectsRes.body).data;
    const ritikaNowSeesPriv = updatedProjects.some(p => p.id === privProj.id);
    assert.strictEqual(ritikaNowSeesPriv, true, 'Ritika MUST now see the Private Project after accepting collaboration invite');

    // 6. Check My Approvals section
    console.log('\n[Verifying My Approvals Section on all devices]');
    const approvalsRes = await handler(mockEvent('GET', '/requests/approvals', null, authHeaders3));
    const approvals = JSON.parse(approvalsRes.body).data;
    const approvalItem = approvals.find(a => a.id === inviteData.id);
    assert.ok(approvalItem, 'Invitation must appear in My Approvals');
    assert.strictEqual(approvalItem.status, 'ACCEPTED');
    assert.strictEqual(approvalItem.is_approved, true);
    assert.ok(approvalItem.sender.name, 'Must show who sent invitation');
    assert.ok(approvalItem.project.name, 'Must show project invitation was for');
    console.log('✓ My Approvals section displays full details: Sender, Project, Status, Approval state.');

    console.log('\n🎉 ALL MULTI-DEVICE SYNCHRONIZATION AND VISIBILITY TESTS PASSED 100%!');
}

run().catch(err => {
    console.error('❌ E2E Test Failed:', err);
    process.exit(1);
});
