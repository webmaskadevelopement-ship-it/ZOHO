const assert = require('assert');

async function run() {
    const baseUrl = 'http://localhost:5000';
    console.log('Testing live server endpoints on', baseUrl);

    // 1. Login as Ravi Bhadoria
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ravi.bhadoria', password: 'Zoho@Ravi#2026' })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginData)}`);
    assert.strictEqual(loginData.data.user.username, 'ravi.bhadoria');
    const raviToken = loginData.data.token;
    console.log('✓ 1. Logged in as Employee (Ravi Bhadoria) with JWT token');

    // 2. Create project as Employee (Point 1 & 4)
    const projRes = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${raviToken}`
        },
        body: JSON.stringify({
            name: 'Webmaska Live Project ' + Date.now(),
            keyPrefix: 'WE-01',
            ownerId: loginData.data.user.id,
            isPublic: 0,
            description: 'Live test project created by employee'
        })
    });
    const projData = await projRes.json();
    assert.strictEqual(projRes.status, 201, `Failed to create project: ${JSON.stringify(projData)}`);
    const projectId = projData.data.id;
    console.log('✓ 2. Employee successfully created project (Point 1 & 4):', projData.data.name, 'ID:', projectId);

    // 3. Add Task under project (Point 2)
    const taskRes = await fetch(`${baseUrl}/api/v1/tasks/project/${projectId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${raviToken}`
        },
        body: JSON.stringify({
            name: 'Creative Testing',
            priority: 'high',
            startDate: '2026-10-31',
            ownerIds: [loginData.data.user.id]
        })
    });
    const taskData = await taskRes.json();
    assert.strictEqual(taskRes.status, 201, `Failed to create task: ${JSON.stringify(taskData)}`);
    console.log('✓ 3. Task created:', taskData.data.name, 'Key:', taskData.data.prefix_key);

    // Verify task is in Sheet view
    const sheetRes = await fetch(`${baseUrl}/api/v1/tasks/project/${projectId}`, {
        headers: { 'Authorization': `Bearer ${raviToken}` }
    });
    const sheetData = await sheetRes.json();
    assert.ok(sheetData.data.some(t => t.name === 'Creative Testing'), 'Task not in sheet view');
    console.log('✓ 4. Task verified visible in Sheet View (Point 2) Total tasks in sheet:', sheetData.data.length);

    // 4. Report Bug / Issue (Point 3)
    const issueRes = await fetch(`${baseUrl}/api/v1/issues`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${raviToken}`
        },
        body: JSON.stringify({
            projectId: projectId,
            title: 'error in website',
            severity: 'critical',
            classification: 'crash_fatal',
            description: 'facing issue with website error'
        })
    });
    const issueData = await issueRes.json();
    assert.strictEqual(issueRes.status, 201, `Failed to submit issue: ${JSON.stringify(issueData)}`);
    console.log('✓ 5. Bug report submitted cleanly without errors (Point 3):', issueData.data.title);

    // 5. In-App Project Invitation to Ananya Gupta (Point 6)
    const inviteRes = await fetch(`${baseUrl}/api/v1/requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${raviToken}`
        },
        body: JSON.stringify({
            username: 'ananya.gupta',
            request_type: 'PROJECT_INVITE',
            target_entity_id: projectId,
            payload: {
                projectId,
                projectName: 'Webmaska Live Project',
                role: 'employee',
                message: 'Please join this project to collaborate.'
            }
        })
    });
    const inviteData = await inviteRes.json();
    assert.strictEqual(inviteRes.status, 201, `Failed to send invite: ${JSON.stringify(inviteData)}`);
    const requestId = inviteData.data.id;
    console.log('✓ 6. In-App Project Invitation sent to ananya.gupta (Point 6)');

    // 6. Login as Ananya Gupta
    const ananyaLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ananya.gupta', password: 'Zoho@Anan#2026' })
    });
    const ananyaLogin = await ananyaLoginRes.json();
    assert.strictEqual(ananyaLoginRes.status, 200, `Ananya login failed: ${JSON.stringify(ananyaLogin)}`);
    const ananyaToken = ananyaLogin.data.token;
    console.log('✓ 7. Logged in as Ananya Gupta');

    // Check incoming requests for Ananya
    const incomingRes = await fetch(`${baseUrl}/api/v1/requests/incoming`, {
        headers: { 'Authorization': `Bearer ${ananyaToken}` }
    });
    const incomingData = await incomingRes.json();
    assert.ok(incomingData.data.some(r => r.id === requestId), 'Request not received by Ananya');
    console.log('✓ 8. Ananya received in-app project invitation with pending count:', incomingData.data.length);

    // Accept project invitation
    const acceptRes = await fetch(`${baseUrl}/api/v1/requests/${requestId}/respond`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ananyaToken}`
        },
        body: JSON.stringify({ action: 'ACCEPT' })
    });
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptRes.status, 200, `Failed to accept: ${JSON.stringify(acceptData)}`);
    assert.strictEqual(acceptData.data.status, 'ACCEPTED');
    console.log('✓ 9. Ananya accepted in-app project invitation');

    // Verify Ananya now has project access
    const ananyaProjsRes = await fetch(`${baseUrl}/api/v1/projects`, {
        headers: { 'Authorization': `Bearer ${ananyaToken}` }
    });
    const ananyaProjs = await ananyaProjsRes.json();
    assert.ok(ananyaProjs.data.some(p => p.id === projectId), 'Ananya does NOT have access to project after accepting');
    console.log('✓ 10. Collaboration access verified: Project appears in Ananya\'s project list!');

    console.log('\n======================================================');
    console.log('🎉 ALL LIVE ENDPOINTS & USER WORKFLOWS VERIFIED 100%!');
    console.log('======================================================');
}

run().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
