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

async function runCrossDeviceAndVisibilityTest() {
    console.log('========================================================================');
    console.log('TEST: CROSS-DEVICE DATA SYNCHRONIZATION & PUBLIC/PRIVATE VISIBILITY');
    console.log('========================================================================\n');

    // -------------------------------------------------------------------------
    // PHASE 1: Device 1 (MacBook) - User A (Ravi) logs in and creates data
    // -------------------------------------------------------------------------
    console.log('--- PHASE 1: DEVICE 1 (MacBook) - Ravi Bhadoria Logs In & Creates Data ---');
    const loginRavi = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ravi.bhadoria',
        password: 'Zoho@Ravi#2026'
    });
    assert.strictEqual(loginRavi.statusCode, 200, 'Ravi login should succeed');
    const tokenRavi = loginRavi.data.data.token;
    const userRavi = loginRavi.data.data.user;
    console.log(`✓ Device 1 Login: ${userRavi.name} (${userRavi.email})`);

    // Create 1 Public Project
    const uniqueSuffix = Date.now().toString(36);
    const pubProjName = `Public Portal ${uniqueSuffix}`;
    const createPub = await callHandler('POST', '/api/v1/projects', {
        name: pubProjName,
        keyPrefix: 'PUB',
        isPublic: 1,
        description: 'Company-wide public project'
    }, { 'Authorization': `Bearer ${tokenRavi}` });
    assert.strictEqual(createPub.statusCode, 201, 'Public project creation should succeed');
    const pubProject = createPub.data.data;
    console.log(`✓ Device 1 Created Public Project: "${pubProject.name}" (is_public: ${pubProject.is_public})`);

    // Create 1 Private Project
    const privProjName = `Ravi Secret Research ${uniqueSuffix}`;
    const createPriv = await callHandler('POST', '/api/v1/projects', {
        name: privProjName,
        keyPrefix: 'SEC',
        isPublic: 0,
        description: 'Ravi confidential project'
    }, { 'Authorization': `Bearer ${tokenRavi}` });
    assert.strictEqual(createPriv.statusCode, 201, 'Private project creation should succeed');
    const privProject = createPriv.data.data;
    console.log(`✓ Device 1 Created Private Project: "${privProject.name}" (is_public: ${privProject.is_public})`);

    // Create Task in Private Project
    const createTask = await callHandler('POST', `/api/v1/tasks/project/${privProject.id}`, {
        name: 'Implement Encrypted Storage',
        priority: 'high',
        startDate: '2026-11-01'
    }, { 'Authorization': `Bearer ${tokenRavi}` });
    assert.strictEqual(createTask.statusCode, 201, 'Task creation should succeed');
    const task = createTask.data.data;
    console.log(`✓ Device 1 Created Task: "${task.name}" in project "${privProject.name}"`);

    // Create Issue in Private Project
    const createIssue = await callHandler('POST', '/api/v1/issues', {
        projectId: privProject.id,
        title: 'Buffer overflow in encryption module',
        severity: 'critical',
        description: 'Needs urgent fix'
    }, { 'Authorization': `Bearer ${tokenRavi}` });
    assert.strictEqual(createIssue.statusCode, 201, 'Issue creation should succeed');
    const issue = createIssue.data.data;
    console.log(`✓ Device 1 Created Issue: "${issue.title}" (Bug ID: ${issue.prefix_key})`);

    // -------------------------------------------------------------------------
    // PHASE 2: Device 2 (Windows PC / Mobile) - Ravi logs in from a brand new device
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2: DEVICE 2 (Windows PC) - Ravi Logs In On A New Device ---');
    // Fresh login (simulating new session on fresh device)
    const loginRaviDev2 = await callHandler('POST', '/api/v1/auth/login', {
        email: 'ravi.bhadoria@zoho.com',
        password: 'Zoho@Ravi#2026'
    });
    assert.strictEqual(loginRaviDev2.statusCode, 200, 'Ravi login on Device 2 should succeed');
    const tokenRaviDev2 = loginRaviDev2.data.data.token;

    // Fetch projects on Device 2
    const projsDev2 = await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenRaviDev2}`
    });
    assert.strictEqual(projsDev2.statusCode, 200);
    const raviProjs = projsDev2.data.data;

    // Verify both Public and Private projects are retrieved on Device 2
    const foundPubOnDev2 = raviProjs.find(p => p.id === pubProject.id);
    const foundPrivOnDev2 = raviProjs.find(p => p.id === privProject.id);

    assert.ok(foundPubOnDev2, 'Device 2 MUST synchronize Public Project');
    assert.ok(foundPrivOnDev2, 'Device 2 MUST synchronize Private Project for its owner');
    console.log(`✓ Cross-Device Sync Verified on Device 2:`);
    console.log(`  - Public Project visible: "${foundPubOnDev2.name}"`);
    console.log(`  - Private Project visible: "${foundPrivOnDev2.name}"`);

    // Verify Tasks synced on Device 2
    const tasksDev2 = await callHandler('GET', `/api/v1/tasks/project/${privProject.id}`, null, {
        'Authorization': `Bearer ${tokenRaviDev2}`
    });
    assert.strictEqual(tasksDev2.statusCode, 200);
    const foundTaskOnDev2 = tasksDev2.data.data.find(t => t.id === task.id);
    assert.ok(foundTaskOnDev2, 'Device 2 MUST synchronize tasks');
    console.log(`  - Tasks synchronized: "${foundTaskOnDev2.name}" (${foundTaskOnDev2.prefix_key})`);

    // Verify Issues synced on Device 2
    const issuesDev2 = await callHandler('GET', '/api/v1/issues', null, {
        'Authorization': `Bearer ${tokenRaviDev2}`
    });
    assert.strictEqual(issuesDev2.statusCode, 200);
    const foundIssueOnDev2 = issuesDev2.data.data.find(i => i.id === issue.id);
    assert.ok(foundIssueOnDev2, 'Device 2 MUST synchronize issues');
    console.log(`  - Issues synchronized: "${foundIssueOnDev2.title}" (${foundIssueOnDev2.prefix_key})`);

    // -------------------------------------------------------------------------
    // PHASE 3: Public and Private Project Visibility Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 3: PUBLIC & PRIVATE PROJECT VISIBILITY CHECK ---');

    // User B (Ananya) logs in
    const loginAnanya = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ananya.gupta',
        password: 'Zoho@Anan#2026'
    });
    const tokenAnanya = loginAnanya.data.data.token;
    console.log(`✓ User B Logged In: Ananya Gupta (${loginAnanya.data.data.user.email})`);

    const ananyaProjsRes = await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenAnanya}`
    });
    const ananyaProjs = ananyaProjsRes.data.data;

    const ananyaSeesPub = ananyaProjs.find(p => p.id === pubProject.id);
    const ananyaSeesPriv = ananyaProjs.find(p => p.id === privProject.id);

    // Rule: Public projects must be visible to all registered users
    assert.ok(ananyaSeesPub, 'RULE CHECK: Public project MUST be visible to Ananya');
    console.log(`✓ PUBLIC PROJECT RULE: Visible to other user Ananya ("${ananyaSeesPub.name}")`);

    // Rule: Private projects must ONLY be visible to creator
    assert.strictEqual(ananyaSeesPriv, undefined, 'RULE CHECK: Private project MUST NOT be visible to Ananya');
    console.log(`✓ PRIVATE PROJECT RULE: Hidden from other user Ananya (Ravi's private project is strictly protected)`);

    // Third User (Ineet) logs in
    const loginIneet = await callHandler('POST', '/api/v1/auth/login', {
        username: 'ineet',
        password: 'Zoho@Inee#2026'
    });
    const tokenIneet = loginIneet.data.data.token;
    console.log(`\n✓ User C Logged In: Ineet (${loginIneet.data.data.user.email})`);

    const ineetProjsRes = await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenIneet}`
    });
    const ineetProjs = ineetProjsRes.data.data;
    const ineetSeesPub = ineetProjs.find(p => p.id === pubProject.id);
    const ineetSeesPriv = ineetProjs.find(p => p.id === privProject.id);

    assert.ok(ineetSeesPub, 'RULE CHECK: Public project MUST be visible to Ineet');
    assert.strictEqual(ineetSeesPriv, undefined, 'RULE CHECK: Private project MUST NOT be visible to Ineet');
    console.log(`✓ PUBLIC PROJECT RULE: Visible to Ineet ("${ineetSeesPub.name}")`);
    console.log(`✓ PRIVATE PROJECT RULE: Hidden from Ineet`);

    // -------------------------------------------------------------------------
    // PHASE 4: Collaboration Acceptance Grants Access to Private Project
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 4: COLLABORATION ACCESS CONTROL ---');
    console.log('Ravi invites Ananya to collaborate on his private project...');
    const inviteRes = await callHandler('POST', '/api/v1/requests', {
        receiver_id: 'cf3817b6-562e-4c65-9d17-b4eb1ada5cd8',
        receiver_email: 'ananya.gupta@zoho.com',
        request_type: 'PROJECT_INVITE',
        target_entity_id: privProject.id,
        payload: {
            projectId: privProject.id,
            projectName: privProject.name,
            role: 'employee',
            message: 'Ananya, please join my private research project.'
        }
    }, { 'Authorization': `Bearer ${tokenRavi}` });
    assert.strictEqual(inviteRes.statusCode, 201);
    const reqId = inviteRes.data.data.id;

    console.log('Ananya accepts the collaboration invitation...');
    const acceptRes = await callHandler('PATCH', `/api/v1/requests/${reqId}/respond`, {
        action: 'ACCEPT'
    }, { 'Authorization': `Bearer ${tokenAnanya}` });
    assert.strictEqual(acceptRes.statusCode, 200);

    // Verify Ananya now has access
    const ananyaProjsAfter = (await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenAnanya}`
    })).data.data;
    const ananyaNowSeesPriv = ananyaProjsAfter.find(p => p.id === privProject.id);
    assert.ok(ananyaNowSeesPriv, 'Ananya MUST have access to private project after accepting invitation');
    console.log(`✓ Accepted Collaborator Access: Ananya now can access "${ananyaNowSeesPriv.name}"`);

    // Verify Ineet STILL has NO access
    const ineetProjsAfter = (await callHandler('GET', '/api/v1/projects', null, {
        'Authorization': `Bearer ${tokenIneet}`
    })).data.data;
    const ineetStillNoPriv = ineetProjsAfter.find(p => p.id === privProject.id);
    assert.strictEqual(ineetStillNoPriv, undefined, 'Ineet MUST NOT have access to private project');
    console.log(`✓ Data Isolation Maintained: Ineet still cannot access the private project`);

    console.log('\n========================================================================');
    console.log('✓ ALL CROSS-DEVICE SYNCHRONIZATION & VISIBILITY TESTS PASSED 100%!');
    console.log('========================================================================\n');
}

runCrossDeviceAndVisibilityTest();
