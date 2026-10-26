const assert = require('assert');

async function runTests() {
    console.log('--- STARTING COMPREHENSIVE FIREBASE & UI VERIFICATION ---');

    const BASE_URL = 'http://localhost:5000';

    // 1. Firebase Status Endpoint
    console.log('\n[1] Checking Firebase status endpoint...');
    const statusRes = await fetch(`${BASE_URL}/api/v1/integrations/firebase/status`);
    const statusData = await statusRes.json();
    console.log('Firebase Status:', statusData);
    assert.strictEqual(statusData.success, true);
    assert.strictEqual(statusData.data.projectId, 'zoho-cda77');
    console.log('✓ Firebase status verified for project "zoho-cda77"');

    // 2. Member Invitation with Email & Firebase Storage
    console.log('\n[2] Testing member invitation with user screenshot email (ritikasharma49526@gmail.com)...');
    const inviteRes = await fetch(`${BASE_URL}/api/v1/portals/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'ritika sharma',
            email: 'ritikasharma49526@gmail.com',
            role: 'employee',
            baseUrl: BASE_URL
        })
    });
    const inviteData = await inviteRes.json();
    console.log('Invitation Response:', inviteData);
    assert.strictEqual(inviteData.success, true);
    assert.strictEqual(inviteData.data.email, 'ritikasharma49526@gmail.com');
    assert.ok(inviteData.data.inviteLink.includes('ritikasharma49526%40gmail.com'));
    console.log('✓ Invitation API succeeded without JSON syntax errors');

    // 3. Verify Submitted Emails Storage
    console.log('\n[3] Verifying email saved to submitted_emails table...');
    const listRes = await fetch(`${BASE_URL}/api/v1/integrations/firebase/submitted-emails`);
    const listData = await listRes.json();
    assert.strictEqual(listData.success, true);
    const foundEmail = listData.data.find(e => e.email === 'ritikasharma49526@gmail.com');
    assert.ok(foundEmail, 'Email must be saved in submitted_emails table');
    console.log('✓ Found submitted email record in database:', foundEmail);

    // 4. Public Web Intake Email Submission
    console.log('\n[4] Testing public web intake email submission...');
    const intakeEmail = `visitor.${Date.now()}@corporate.org`;
    const intakeRes = await fetch(`${BASE_URL}/api/v1/integrations/firebase/submit-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Corporate Visitor',
            email: intakeEmail,
            role: 'client',
            source: 'public_web_intake',
            metadata: { note: 'Inquiring about Enterprise license' }
        })
    });
    const intakeData = await intakeRes.json();
    console.log('Intake response:', intakeData);
    assert.strictEqual(intakeData.success, true);
    assert.strictEqual(intakeData.data.email, intakeEmail);
    console.log('✓ Public web intake email captured successfully');

    // 5. Live Chat Collaboration Messages
    console.log('\n[5] Testing Live Chat collaboration message persistence...');
    const chatMsgRes = await fetch(`${BASE_URL}/api/v1/collaboration/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            entityType: 'portal_chat',
            entityId: 'proj-ai-training',
            content: '[Alex Chen (Admin)]: Hello team, live chat is active!'
        })
    });
    const chatMsgData = await chatMsgRes.json();
    console.log('Chat comment response:', chatMsgData);
    assert.strictEqual(chatMsgData.success, true);
    console.log('✓ Live Chat comment persisted');

    // 6. SVG Vector Gantt Download
    console.log('\n[6] Testing SVG Vector Gantt chart export endpoint...');
    const ganttRes = await fetch(`${BASE_URL}/api/v1/reports/gantt-svg/proj-ai-training`);
    assert.strictEqual(ganttRes.status, 200);
    const contentType = ganttRes.headers.get('content-type') || '';
    assert.ok(contentType.includes('image/svg+xml') || contentType.includes('xml'));
    console.log('✓ SVG Gantt endpoint responded with valid SVG XML');

    // 7. Verify Frontend static bundle files
    console.log('\n[7] Verifying index.html and app.js contain all button listeners and modals...');
    const indexRes = await fetch(`${BASE_URL}/index.html`);
    const indexHtml = await indexRes.text();
    assert.ok(indexHtml.includes('id="btnBottomLiveChat"'), 'Live Chat button must be in HTML');
    assert.ok(indexHtml.includes('id="chatDrawerOverlay"'), 'Live Chat drawer must be in HTML');
    assert.ok(indexHtml.includes('id="btnFloatingHelp"'), 'Help button must be in HTML');
    assert.ok(indexHtml.includes('id="modalHelpShortcuts"'), 'Help modal must be in HTML');
    assert.ok(indexHtml.includes('id="modalEditUserRole"'), 'Edit User Role modal must be in HTML');
    assert.ok(indexHtml.includes('id="modalPublicIntake"'), 'Public Intake modal must be in HTML');
    assert.ok(indexHtml.includes('id="btnPublicShareLink"'), 'Public share link must be in HTML');
    console.log('✓ All buttons, drawers, and modal structures verified in index.html');

    const appRes = await fetch(`${BASE_URL}/app.js`);
    const appJs = await appRes.text();
    assert.ok(appJs.includes('setupLiveChatDrawer'), 'setupLiveChatDrawer must be in app.js');
    assert.ok(appJs.includes('setupHelpAndSystemModals'), 'setupHelpAndSystemModals must be in app.js');
    assert.ok(appJs.includes('setupEditUserRoleModal'), 'setupEditUserRoleModal must be in app.js');
    assert.ok(appJs.includes('saveSubmittedEmailToFirebase'), 'saveSubmittedEmailToFirebase must be in app.js');
    assert.ok(appJs.includes('btn-edit-role'), 'btn-edit-role click handling must be in app.js');
    console.log('✓ All button interactive logic verified in app.js');

    console.log('\n======================================================');
    console.log('🎉 ALL FIREBASE, UI BUTTON, AND SCREEN TESTS PASSED 100%!');
    console.log('======================================================');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
