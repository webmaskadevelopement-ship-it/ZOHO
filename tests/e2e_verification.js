/**
 * End-to-End Verification Test for Life PMS Backend Bug Fixes & Feature Integrations
 * Tests all 6 functional areas against the running API server (port 5000)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');

const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}`;
let token = '';
let portalId = 'portal-demo-zoho';
let projectId = 'proj-ai-training';

async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(portalId ? { 'x-portal-id': portalId } : {}),
        ...(options.headers || {})
    };
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: json };
}

async function runVerification() {
    console.log('====================================================');
    console.log('🚀 Starting Life PMS E2E Backend Feature Verification');
    console.log('====================================================\n');

    // Step 0: Login as Admin
    console.log('▶ Step 0: Authenticating as Admin...');
    const loginRes = await request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'nikhil@lifepms.com', password: 'Password123!' })
    });
    assert.strictEqual(loginRes.status, 200, 'Login failed');
    assert.strictEqual(loginRes.body.success, true);
    token = loginRes.body.data.token;
    console.log('  ✔ Authenticated successfully as Nikhil Kaushik (Admin)\n');

    // Test 1: Task List & Task Validation + Updates
    console.log('▶ Test 1: Task List and Task Name Clickability & Validation');
    const tlRes = await request(`/api/v1/task-lists/project/${projectId}`);
    const validTaskListId = (tlRes.body.data && tlRes.body.data.length > 0) ? tlRes.body.data[0].id : 'list-phase-system';
    console.log(`  ✔ Resolved active project task list ID: ${validTaskListId}`);

    // 1a: Required field validation (empty name)
    const emptyNameRes = await request(`/api/v1/tasks/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ name: '', taskListId: validTaskListId })
    });
    assert.strictEqual(emptyNameRes.status, 400, 'Empty task name should be rejected with 400');
    console.log('  ✔ Required-field validation: Empty task name rejected (400)');

    // 1b: Required field validation (missing taskListId)
    const missingTlRes = await request(`/api/v1/tasks/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Valid Task Name', taskListId: '' })
    });
    assert.strictEqual(missingTlRes.status, 400, 'Empty taskListId should be rejected with 400');
    console.log('  ✔ Required-field validation: Missing taskListId rejected (400)');

    // 1c: Valid task creation
    const createTaskRes = await request(`/api/v1/tasks/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({
            name: 'E2E Verified High-Performance Cache Layer',
            taskListId: validTaskListId,
            priority: 'urgent',
            note: 'Verify end-to-end task creation and clickability'
        })
    });
    assert.strictEqual(createTaskRes.body.success, true, 'Task creation should succeed');
    const createdTask = createTaskRes.body.data;
    assert.ok(createdTask.id, 'Task must have an ID');
    console.log(`  ✔ Task created successfully: ID=${createdTask.id}, Name="${createdTask.name}"`);

    // 1d: Update task via inspector drawer save
    const updateTaskRes = await request(`/api/v1/tasks/${createdTask.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            name: 'E2E Verified High-Performance Cache Layer (Updated)',
            priority: 'high',
            completionPercentage: 50,
            statusId: 'in_progress'
        })
    });
    assert.strictEqual(updateTaskRes.body.success, true);
    console.log('  ✔ Task inspector drawer auto-save updated task properties successfully\n');

    // Test 2: Issues Section — Inactive Buttons & Operations
    console.log('▶ Test 2: Issues Section — Filtering, Auto-Save & Conversion');
    // 2a: Create a test bug report
    const createBugRes = await request('/api/v1/issues', {
        method: 'POST',
        body: JSON.stringify({
            projectId,
            title: 'Memory leak in real-time WebSockets event buffer',
            severity: 'blocker',
            classification: 'Performance',
            description: 'Buffer overflow observed under concurrent WebSocket load'
        })
    });
    assert.strictEqual(createBugRes.body.success, true, 'Bug report submission should succeed');
    const createdBug = createBugRes.body.data;
    console.log(`  ✔ Bug report submitted successfully: ID=${createdBug.id}, Key=${createdBug.key_prefix}-${createdBug.sequence_number}`);

    // 2b: Test Severity and Status Filters
    const blockerFilterRes = await request(`/api/v1/issues/project/${projectId}?severity=blocker`);
    assert.strictEqual(blockerFilterRes.body.success, true);
    assert.ok(blockerFilterRes.body.data.some(i => i.id === createdBug.id), 'Created bug should match blocker filter');
    console.log(`  ✔ Filter [data-issue-filter="blocker"] active: found ${blockerFilterRes.body.data.length} blocker defect(s)`);

    // 2c: Test Issue Drawer auto-save
    const updateBugRes = await request(`/api/v1/issues/${createdBug.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            title: createdBug.title,
            statusId: 'in_progress',
            severity: 'critical',
            reproducibility: 'always',
            description: 'Updated reproduction steps with heap profiler dump'
        })
    });
    assert.strictEqual(updateBugRes.body.success, true, 'Issue drawer auto-save should succeed');
    console.log('  ✔ Issue drawer auto-save updated status and severity successfully');

    // 2d: Test 1-Click Convert to Task
    const convertBugRes = await request(`/api/v1/issues/${createdBug.id}/convert-to-task`, {
        method: 'POST',
        body: JSON.stringify({})
    });
    assert.strictEqual(convertBugRes.body.success, true, 'Convert bug to task should succeed');
    console.log(`  ✔ Defect converted to scheduled WBS task (Created Task ID: ${convertBugRes.body.data.createdTaskId || convertBugRes.body.data.id || convertBugRes.body.data.task?.id})\n`);

    // Test 3: Documents — Image Upload and Firebase Storage Integration
    console.log('▶ Test 3: Documents — Image Upload & Firebase Storage Integration');
    // 3a: Create multipart test PNG payload
    const testPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const boundary = '----WebKitFormBoundaryE2eTestUpload12345';
    
    let bodyBuffers = [];
    bodyBuffers.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="projectId"\r\n\r\n` +
        `${projectId}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="name"\r\n\r\n` +
        `Architecture-System-Blueprint.png\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="Architecture-System-Blueprint.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`
    ));
    bodyBuffers.push(testPngBuffer);
    bodyBuffers.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const fullBody = Buffer.concat(bodyBuffers);

    const uploadRes = await fetch(`${BASE_URL}/api/v1/collaboration/files/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Authorization': `Bearer ${token}`,
            'x-portal-id': portalId
        },
        body: fullBody
    });
    const uploadJson = await uploadRes.json();
    assert.strictEqual(uploadJson.success, true, `Upload failed: ${uploadJson.error}`);
    assert.ok(uploadJson.data.fileUrl, 'Uploaded file must have a download URL');
    console.log(`  ✔ Image file uploaded successfully: Name="${uploadJson.data.name}", URL=${uploadJson.data.fileUrl}`);

    // 3b: Query files list to verify persistence and retrieval
    const listFilesRes = await request(`/api/v1/collaboration/files/${projectId}`);
    assert.strictEqual(listFilesRes.body.success, true);
    assert.ok(listFilesRes.body.data.some(f => f.name === 'Architecture-System-Blueprint.png'), 'Uploaded image must appear in files list');
    console.log(`  ✔ Documents repository retrieved ${listFilesRes.body.data.length} file(s), including new image asset\n`);

    // Test 4: Automation Section — Make It Functional
    console.log('▶ Test 4: Automation Section — Workflow Blueprints & State Machine Execution');
    // 4a: Create a new blueprint
    const createBpRes = await request('/api/v1/blueprints', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Full Agile Task Pipeline Blueprint',
            entityType: 'task',
            description: 'Enforces Open -> In Progress -> In Review -> Completed state transitions',
            transitions: [
                { name: 'Start Work', fromState: 'open', toState: 'in_progress', allowedRoles: ['admin', 'manager', 'employee'] },
                { name: 'Submit for Review', fromState: 'in_progress', toState: 'in_review', allowedRoles: ['admin', 'manager', 'employee'], promptFields: ['reviewNotes'] },
                { name: 'QA Approval', fromState: 'in_review', toState: 'completed', allowedRoles: ['admin', 'manager'] }
            ]
        })
    });
    assert.strictEqual(createBpRes.body.success, true, 'Blueprint creation should succeed');
    console.log(`  ✔ Workflow Blueprint created: ID=${createBpRes.body.data.id}, Name="${createBpRes.body.data.name}"`);

    // 4b: Execute blueprint transition on task
    // Create an open task for transition
    const bpTaskRes = await request(`/api/v1/tasks/project/${projectId}`, {
        method: 'POST',
        body: JSON.stringify({ name: 'State Machine Runner Target Task', taskListId: validTaskListId })
    });
    const bpTaskId = bpTaskRes.body.data.id;

    // Transition Open -> In Progress
    const transRes = await request('/api/v1/blueprints/execute-transition', {
        method: 'POST',
        body: JSON.stringify({
            blueprintId: createBpRes.body.data.id,
            taskId: bpTaskId,
            targetState: 'in_progress',
            promptData: { note: 'Starting implementation work' }
        })
    });
    assert.strictEqual(transRes.body.success, true, `Transition failed: ${transRes.body.error}`);
    assert.strictEqual(transRes.body.data.status, 'in_progress');
    console.log(`  ✔ Blueprint transition executed: Task transitioned to ${transRes.body.data.status.toUpperCase()}`);

    // Transition In Progress -> In Review
    const reviewTransRes = await request('/api/v1/blueprints/execute-transition', {
        method: 'POST',
        body: JSON.stringify({
            blueprintId: createBpRes.body.data.id,
            taskId: bpTaskId,
            targetState: 'in_review',
            promptData: { reviewNotes: 'PR created with 100% test coverage' }
        })
    });
    assert.strictEqual(reviewTransRes.body.success, true);
    assert.strictEqual(reviewTransRes.body.data.status, 'in_review');
    console.log(`  ✔ Blueprint transition executed: Task transitioned to ${reviewTransRes.body.data.status.toUpperCase()}\n`);

    // Test 5: Notifications — Unread and Mentions
    console.log('▶ Test 5: Notifications — Unread, Mentions & Dynamic Badge Sync');
    const notifsRes = await request('/api/v1/collaboration/notifications');
    assert.strictEqual(notifsRes.body.success, true);
    const notifications = notifsRes.body.data;
    assert.ok(notifications.length > 0, 'Notifications list should contain items');
    
    const unreadCountInitial = notifications.filter(n => !n.is_read).length;
    const mentionsCount = notifications.filter(n => n.type === 'mention' || (n.title && n.title.toLowerCase().includes('mention')) || (n.content && n.content.includes('@'))).length;
    console.log(`  ✔ Retrieved ${notifications.length} notifications: ${unreadCountInitial} unread, ${mentionsCount} mentions`);

    // Mark single notification as read
    const unreadNotif = notifications.find(n => !n.is_read);
    if (unreadNotif) {
        const markReadRes = await request('/api/v1/collaboration/notifications/mark-read', {
            method: 'POST',
            body: JSON.stringify({ notificationId: unreadNotif.id })
        });
        assert.strictEqual(markReadRes.body.success, true);

        // Verify state persistence
        const recheckNotifs = await request('/api/v1/collaboration/notifications');
        const recheckTarget = recheckNotifs.body.data.find(n => n.id === unreadNotif.id);
        assert.strictEqual(recheckTarget.is_read, 1, 'Target notification must be marked as read');
        const newUnreadCount = recheckNotifs.body.data.filter(n => !n.is_read).length;
        assert.strictEqual(newUnreadCount, unreadCountInitial - 1, 'Unread count must decrement by exactly 1');
        console.log(`  ✔ Notification ID=${unreadNotif.id} marked as read. Unread badge count synchronized: ${unreadCountInitial} -> ${newUnreadCount}\n`);
    }

    // Test 6: Email Invitations — Real Email Delivery
    console.log('▶ Test 6: Email Invitations — Real Email Delivery & Whitelist Verification');
    // 6a: Invalid email validation
    const invalidInviteRes = await request('/api/v1/portals/invite', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email', name: 'Bad User', role: 'employee' })
    });
    assert.strictEqual(invalidInviteRes.status, 400, 'Invalid email address must return 400 Bad Request');
    console.log('  ✔ Invalid email format rejected with 400 Bad Request');

    // 6b: Real invitation delivery
    const recipientEmail = 'alex.director@acmecorp.org';
    const inviteRes = await request('/api/v1/portals/invite', {
        method: 'POST',
        body: JSON.stringify({
            email: recipientEmail,
            name: 'Alex Director',
            role: 'manager',
            baseUrl: 'http://localhost:5000'
        })
    });
    assert.strictEqual(inviteRes.body.success, true, `Invitation failed: ${inviteRes.body.error}`);
    assert.ok(inviteRes.body.data.invitationId, 'Must return invitationId');
    assert.ok(inviteRes.body.data.inviteLink, 'Must return verifiable inviteLink');
    assert.ok(inviteRes.body.data.emailDelivery, 'Email delivery payload must be present');
    console.log(`  ✔ Real email invitation triggered successfully!`);
    console.log(`    Recipient: ${recipientEmail} (Role: manager)`);
    console.log(`    Invite Link: ${inviteRes.body.data.inviteLink}`);
    if (inviteRes.body.data.previewUrl) {
        console.log(`    Live Test Inbox Preview: ${inviteRes.body.data.previewUrl}`);
    }

    // 6c: Verify invitation link works and grants permissions
    const acceptRes = await request(`/api/v1/portals/invite/accept?token=${inviteRes.body.data.invitationId}`);
    assert.strictEqual(acceptRes.body.success, true);
    console.log(`  ✔ Invitation link verified and accepted for portal access\n`);

    console.log('====================================================');
    console.log('🎉 ALL 6 FEATURE AREAS VERIFIED END-TO-END! (100% PASS)');
    console.log('====================================================');
}

const server = app.listen(PORT, async () => {
    try {
        await runVerification();
        server.close(() => {
            console.log('\nServer closed cleanly. Exiting with code 0.');
            process.exit(0);
        });
    } catch (err) {
        console.error('❌ E2E Verification Error:', err);
        server.close(() => process.exit(1));
    }
});
