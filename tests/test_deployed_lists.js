const { handler } = require('../netlify/functions/api');

async function testDeploymentAndLists() {
    console.log('Testing Serverless & Deployed List Rendering...');

    // 1. Authenticate as Ravi Bhadoria
    const loginRes = await handler({
        httpMethod: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            username: 'ravi.bhadoria',
            password: 'Zoho@Ravi#2026'
        })
    });
    const loginData = JSON.parse(loginRes.body);
    const token = loginData.token;
    console.log('1. Logged in:', loginData.data.user.name);

    // 2. Create Project
    const projName = 'Production Redesign ' + Date.now().toString(36);
    const createProjRes = await handler({
        httpMethod: 'POST',
        path: '/api/v1/projects',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: projName,
            keyPrefix: 'PRD',
            isPublic: 1
        })
    });
    const createProjData = JSON.parse(createProjRes.body);
    console.log('2. Created Project Status:', createProjRes.statusCode, createProjData.data?.name);
    if (!createProjData.success || !createProjData.data?.id) {
        throw new Error('Project creation failed: ' + createProjRes.body);
    }
    const projectId = createProjData.data.id;

    // 3. Fetch Projects List and verify the newly created project appears
    const getProjsRes = await handler({
        httpMethod: 'GET',
        path: '/api/v1/projects',
        headers: { 'authorization': `Bearer ${token}` }
    });
    const getProjsData = JSON.parse(getProjsRes.body);
    console.log('3. Fetched Projects Count:', getProjsData.count || getProjsData.data?.length);
    const projFound = getProjsData.data.some(p => p.id === projectId);
    if (!projFound) {
        throw new Error('Newly created project was NOT found in projects list!');
    }
    console.log('   ✓ Project is present in the projects list!');

    // 4. Create Task under the new project
    const taskName = 'Build Responsive Header & Nav';
    const createTaskRes = await handler({
        httpMethod: 'POST',
        path: `/api/v1/tasks/project/${projectId}`,
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            name: taskName,
            priority: 'high',
            startDate: '2026-11-01',
            endDate: '2026-11-05'
        })
    });
    const createTaskData = JSON.parse(createTaskRes.body);
    console.log('4. Created Task Status:', createTaskRes.statusCode, createTaskData.data?.name);
    if (!createTaskData.success || !createTaskData.data?.id) {
        throw new Error('Task creation failed: ' + createTaskRes.body);
    }
    const taskId = createTaskData.data.id;

    // 5. Fetch Tasks for this Project and verify the newly created task appears
    const getTasksRes = await handler({
        httpMethod: 'GET',
        path: `/api/v1/tasks/project/${projectId}`,
        headers: { 'authorization': `Bearer ${token}` }
    });
    const getTasksData = JSON.parse(getTasksRes.body);
    console.log('5. Fetched Tasks Count:', getTasksData.count || getTasksData.data?.length);
    const taskFound = getTasksData.data.some(t => t.id === taskId);
    if (!taskFound) {
        throw new Error('Newly created task was NOT found in tasks list!');
    }
    console.log('   ✓ Task is present in the tasks list!');

    // 6. Fetch Task Lists for this project
    const getTlRes = await handler({
        httpMethod: 'GET',
        path: `/api/v1/task-lists/project/${projectId}`,
        headers: { 'authorization': `Bearer ${token}` }
    });
    const getTlData = JSON.parse(getTlRes.body);
    console.log('6. Fetched Task Lists:', getTlData.data?.length);
    if (!getTlData.data || getTlData.data.length === 0) {
        throw new Error('Task lists should not be empty!');
    }
    console.log('   ✓ Task lists present:', getTlData.data.map(tl => tl.name).join(', '));

    console.log('\n======================================================');
    console.log('✓ ALL DEPLOYED LIST PERSISTENCE TESTS PASSED!');
    console.log('======================================================');
}

testDeploymentAndLists().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});

