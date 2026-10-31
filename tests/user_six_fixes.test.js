const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/database');
const ProjectsService = require('../src/modules/projects/projects.service');
const TasksService = require('../src/modules/tasks/tasks.service');
const IssuesService = require('../src/modules/issues/issues.service');
const RequestsService = require('../src/modules/requests/requests.service');

test('User Six Fixes Verification Test Suite', async (t) => {
    const portalId = 'portal-demo-zoho';

    // 1. Point 4 & Point 1: Everyone (including Employee) can create projects, and owner can be custom or employee
    await t.test('1. Employee can create a project with custom or selected owner (Point 1 & 4)', async () => {
        // Authenticate as employee Ravi Bhadoria
        const employee = db.queryOne("SELECT * FROM users WHERE username = 'ravi.bhadoria'");
        assert.ok(employee, 'Employee ravi.bhadoria should exist in database');

        const newProj = ProjectsService.createProject({
            portalId,
            ownerId: employee.id,
            name: 'Webmaska Production Site',
            keyPrefix: 'WE-01',
            isPublic: 0, // private project to test collaboration later
            description: 'Created by employee Ravi Bhadoria'
        });

        assert.ok(newProj.id, 'Project should be successfully created');
        assert.equal(newProj.owner_id, employee.id);
        assert.equal(newProj.name, 'Webmaska Production Site');

        // Check project is retrieved for employee
        const employeeProjs = ProjectsService.getProjects(portalId, employee.id, 'employee');
        const found = employeeProjs.find(p => p.id === newProj.id);
        assert.ok(found, 'Employee should see the created project in their project list');
    });

    // 2. Point 2: Adding a task makes it immediately visible in sheet view
    await t.test('2. Added task is immediately queryable and visible in project sheet (Point 2)', async () => {
        const employee = db.queryOne("SELECT * FROM users WHERE username = 'ravi.bhadoria'");
        const project = db.queryOne("SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1", [employee.id]);
        assert.ok(project, 'Project should exist');

        const task = TasksService.createTask(portalId, {
            projectId: project.id,
            name: 'Creative Testing',
            priority: 'high',
            startDate: '2026-10-31',
            ownerIds: [employee.id]
        });

        assert.ok(task.id, 'Task should have an ID');
        assert.equal(task.name, 'Creative Testing');
        assert.equal(task.project_id, project.id);

        // Fetch tasks for this project
        const tasks = TasksService.getTasks(portalId, project.id);
        const createdTask = tasks.find(tk => tk.id === task.id);
        assert.ok(createdTask, 'Created task should appear in project task list');
        assert.equal(createdTask.name, 'Creative Testing');
    });

    // 3. Point 3: Submitting bug report/issue succeeds without failure
    await t.test('3. Issue submission succeeds with projectId and title (Point 3)', async () => {
        const employee = db.queryOne("SELECT * FROM users WHERE username = 'ravi.bhadoria'");
        const project = db.queryOne("SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at DESC LIMIT 1", [employee.id]);

        const issue = IssuesService.createIssue(portalId, {
            projectId: project.id,
            reporterId: employee.id,
            title: 'error in website',
            severity: 'critical',
            classification: 'crash_fatal',
            description: 'facing issue with website error'
        });

        assert.ok(issue.id, 'Issue should be created with an ID');
        assert.equal(issue.title, 'error in website');
        assert.equal(issue.project_id, project.id);

        const issues = IssuesService.getIssues(portalId, project.id);
        const found = issues.find(i => i.id === issue.id);
        assert.ok(found, 'Issue should be listed under project issues');
    });

    // 4. Point 5: Users section contains strictly the authorized credentials from PDF
    await t.test('5. Users table contains strictly authorized members from PDF (Point 5)', async () => {
        const users = db.queryAll('SELECT id, name, username, email, role FROM users');
        const PDF_USERS = [
            'ravi.bhadoria', 'ananya.gupta', 'ineet', 'nikhil', 'ritika',
            'shweta', 'ekta', 'abhishek', 'prince', 'ali', 'admin', 'manager'
        ];

        users.forEach(u => {
            const matches = PDF_USERS.includes(u.username.toLowerCase()) ||
                            PDF_USERS.some(p => u.email.toLowerCase().includes(p));
            assert.ok(matches, `User ${u.username} (${u.email}) should be in authorized PDF list`);
        });

        assert.equal(users.length, 12, 'Users directory must contain exactly 10 employees + 2 admin/manager accounts');
    });

    // 5. Point 6: In-App Project Invitation Workflow (Invite, Receive, Accept, Access Granted)
    await t.test('6. In-App Project Invitation workflow gives collaborator project access on Accept (Point 6)', async () => {
        const sender = db.queryOne("SELECT * FROM users WHERE username = 'ravi.bhadoria'");
        const receiver = db.queryOne("SELECT * FROM users WHERE username = 'ananya.gupta'");
        assert.ok(sender && receiver, 'Sender and receiver must exist');

        // Create a strictly private project owned by sender
        const privateProj = ProjectsService.createProject({
            portalId,
            ownerId: sender.id,
            name: 'Confidential Redesign Project',
            keyPrefix: 'CP-01',
            isPublic: 0
        });

        // Verify receiver cannot see privateProj before invitation
        let receiverProjs = ProjectsService.getProjects(portalId, receiver.id, 'employee');
        assert.ok(!receiverProjs.some(p => p.id === privateProj.id), 'Receiver should NOT have access before accepting invite');

        // Send In-App Project Invite
        const req = await RequestsService.createRequest(sender, {
            receiver_id: receiver.id,
            request_type: 'PROJECT_INVITE',
            target_entity_id: privateProj.id,
            payload: {
                projectId: privateProj.id,
                projectName: privateProj.name,
                role: 'employee',
                message: 'Please join and collaborate on this confidential project.'
            }
        });

        assert.ok(req.id, 'In-app request must be created');
        assert.equal(req.status, 'PENDING');

        // Check incoming requests for Ananya Gupta
        const incoming = RequestsService.getIncomingRequests(receiver.id);
        const myInvite = incoming.find(r => r.id === req.id);
        assert.ok(myInvite, 'Ananya should see the project invitation in her incoming requests inbox');

        // Ananya accepts the project invitation
        const respondRes = await RequestsService.respondToRequest(req.id, receiver.id, 'ACCEPT');
        assert.equal(respondRes.status, 'ACCEPTED');

        // Check that Ananya now has project access!
        receiverProjs = ProjectsService.getProjects(portalId, receiver.id, 'employee');
        const accessibleProj = receiverProjs.find(p => p.id === privateProj.id);
        assert.ok(accessibleProj, 'Receiver MUST have immediate collaboration access to the private project upon accepting the invitation!');

        // Check that Ananya is recorded in member_ids
        const updatedProj = db.queryOne('SELECT member_ids FROM projects WHERE id = ?', [privateProj.id]);
        const members = JSON.parse(updatedProj.member_ids || '[]');
        assert.ok(members.includes(receiver.id), 'Receiver ID must be present in projects.member_ids');
    });

    // 6. Security & Whitelist enforcement on Invitations
    await t.test('6b. Invitations reject unauthorized external identifiers (Point 6 Security)', async () => {
        const sender = db.queryOne("SELECT * FROM users WHERE username = 'ravi.bhadoria'");
        await assert.rejects(
            async () => {
                await RequestsService.createRequest(sender, {
                    email: 'hacker@unauthorized-domain.com',
                    request_type: 'PROJECT_INVITE'
                });
            },
            /Target recipient could not be found|Security Policy/i
        );
    });
});
