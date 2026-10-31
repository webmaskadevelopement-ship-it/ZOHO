const { handler } = require('../netlify/functions/api');

async function runTests() {
    console.log('Testing Netlify serverless function endpoints...');

    // 1. Test Login with Ravi Bhadoria
    const loginRes = await handler({
        httpMethod: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            username: 'ravi.bhadoria',
            password: 'Zoho@Ravi#2026'
        })
    });
    console.log('1. Login Ravi:', loginRes.statusCode);
    const loginData = JSON.parse(loginRes.body);
    if (!loginData.success || !loginData.token) {
        throw new Error('Ravi login failed: ' + loginRes.body);
    }
    console.log('   ✓ Token generated, user role:', loginData.data.user.role);

    // 2. Test Login with Ananya Gupta
    const loginAnanya = await handler({
        httpMethod: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            username: 'ananya.gupta',
            password: 'Zoho@Anan#2026'
        })
    });
    console.log('2. Login Ananya:', loginAnanya.statusCode);
    const ananyaData = JSON.parse(loginAnanya.body);
    if (!ananyaData.success) throw new Error('Ananya login failed');
    console.log('   ✓ Ananya logged in successfully');

    // 3. Test Users Directory
    const dirRes = await handler({
        httpMethod: 'GET',
        path: '/api/v1/users/directory',
        headers: { 'authorization': `Bearer ${loginData.token}` }
    });
    console.log('3. Directory status:', dirRes.statusCode);
    const dirData = JSON.parse(dirRes.body);
    console.log('   ✓ Team members count:', dirData.count);
    if (dirData.count !== 10) throw new Error('Expected 10 team members, got ' + dirData.count);

    // 4. Test In-App Request Create
    const reqCreate = await handler({
        httpMethod: 'POST',
        path: '/api/v1/requests',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({
            receiver_id: 'usr-ananya',
            request_type: 'PROJECT_INVITE',
            payload: {
                projectId: 'proj-demo-1',
                projectName: 'Netlify Cloud Project'
            }
        })
    });
    console.log('4. Create Request status:', reqCreate.statusCode);
    const reqData = JSON.parse(reqCreate.body);
    if (!reqData.success) throw new Error('Failed to create request');
    console.log('   ✓ In-app request created:', reqData.data.id);

    // 5. Test Respond to Request
    const respondRes = await handler({
        httpMethod: 'PATCH',
        path: `/api/v1/requests/${reqData.data.id}/respond`,
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${ananyaData.token}`
        },
        body: JSON.stringify({ action: 'ACCEPT' })
    });
    console.log('5. Respond Request status:', respondRes.statusCode);
    const respondData = JSON.parse(respondRes.body);
    if (!respondData.success || respondData.data.status !== 'ACCEPTED') {
        throw new Error('Respond failed: ' + respondRes.body);
    }
    console.log('   ✓ In-app request responded: ACCEPTED');

    // 6. Test My Approvals
    const approvalsRes = await handler({
        httpMethod: 'GET',
        path: '/api/v1/requests/approvals',
        headers: { 'authorization': `Bearer ${loginData.token}` }
    });
    console.log('6. Approvals status:', approvalsRes.statusCode);

    console.log('\n✓ ALL NETLIFY SERVERLESS FUNCTION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});

