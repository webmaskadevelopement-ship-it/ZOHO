const { handler } = require('../netlify/functions/api');

async function testIssuesAndPhases() {
    console.log('Testing Issues & Phases in Serverless...');

    const loginRes = await handler({
        httpMethod: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'ravi.bhadoria', password: 'Zoho@Ravi#2026' })
    });
    const token = JSON.parse(loginRes.body).token;

    // Create Issue
    const issueRes = await handler({
        httpMethod: 'POST',
        path: '/api/v1/issues',
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            title: 'Fix mobile viewport scroll issue',
            severity: 'critical'
        })
    });
    const issueData = JSON.parse(issueRes.body);
    console.log('Issue create status:', issueRes.statusCode, issueData.data?.title);
    if (!issueData.success) throw new Error('Issue creation failed');

    // Get Issues
    const getIssuesRes = await handler({
        httpMethod: 'GET',
        path: '/api/v1/issues',
        headers: { 'authorization': `Bearer ${token}` }
    });
    const getIssuesData = JSON.parse(getIssuesRes.body);
    console.log('Issues count:', getIssuesData.count || getIssuesData.data?.length);
    if (!getIssuesData.data || getIssuesData.data.length === 0) throw new Error('No issues found');

    console.log('✓ Issues tested and passed!');
}

testIssuesAndPhases().catch(e => {
    console.error(e);
    process.exit(1);
});
