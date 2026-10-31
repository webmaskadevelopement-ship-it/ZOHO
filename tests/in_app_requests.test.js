const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const db = require('../src/db/database');
const config = require('../src/config');
const AuthService = require('../src/modules/auth/auth.service');
const RequestsService = require('../src/modules/requests/requests.service');
const UsersService = require('../src/modules/users/users.service');
const { FirebaseFirestoreService } = require('../src/services/firebaseFirestoreService');
const FirebaseAuthService = require('../src/services/firebaseAuthService');
const integrationsController = require('../src/modules/integrations/integrations.controller');

describe('Instagram-Style In-App Request & Zoho Firebase System Test Suite', () => {

    it('1. Database Schema & Migration Verification', () => {
        // Verify in_app_requests table columns
        const reqCols = db.queryAll('PRAGMA table_info(in_app_requests)').map(c => c.name);
        assert.ok(reqCols.includes('id'), 'in_app_requests has id');
        assert.ok(reqCols.includes('sender_id'), 'in_app_requests has sender_id');
        assert.ok(reqCols.includes('receiver_id'), 'in_app_requests has receiver_id');
        assert.ok(reqCols.includes('request_type'), 'in_app_requests has request_type');
        assert.ok(reqCols.includes('target_entity_id'), 'in_app_requests has target_entity_id');
        assert.ok(reqCols.includes('payload_json'), 'in_app_requests has payload_json');
        assert.ok(reqCols.includes('status'), 'in_app_requests has status');
        assert.ok(reqCols.includes('created_at'), 'in_app_requests has created_at');
        assert.ok(reqCols.includes('responded_at'), 'in_app_requests has responded_at');

        // Verify user_connections table columns
        const connCols = db.queryAll('PRAGMA table_info(user_connections)').map(c => c.name);
        assert.ok(connCols.includes('user_id'), 'user_connections has user_id');
        assert.ok(connCols.includes('connected_user_id'), 'user_connections has connected_user_id');
        assert.ok(connCols.includes('created_at'), 'user_connections has created_at');

        // Verify users table columns
        const userCols = db.queryAll('PRAGMA table_info(users)').map(c => c.name);
        assert.ok(userCols.includes('username'), 'users has username');
        assert.ok(userCols.includes('bio'), 'users has bio');
        assert.ok(userCols.includes('phone'), 'users has phone');
    });

    it('2. 10 Employee Credentials Login Verification (Username & Password)', async () => {
        const EMPLOYEES = [
            { username: 'ravi.bhadoria', password: 'Zoho@Ravi#2026', email: 'ravi.bhadoria@zoho.com' },
            { username: 'ananya.gupta', password: 'Zoho@Anan#2026', email: 'ananya.gupta@zoho.com' },
            { username: 'ineet', password: 'Zoho@Inee#2026', email: 'ineet@zoho.com' },
            { username: 'nikhil', password: 'Zoho@Nikh#2026', email: 'nikhil@zoho.com' },
            { username: 'ritika', password: 'Zoho@Riti#2026', email: 'ritika@zoho.com' },
            { username: 'shweta', password: 'Zoho@Shwe#2026', email: 'shweta@zoho.com' },
            { username: 'ekta', password: 'Zoho@Ekta#2026', email: 'ekta@zoho.com' },
            { username: 'abhishek', password: 'Zoho@Abhi#2026', email: 'abhishek@zoho.com' },
            { username: 'prince', password: 'Zoho@Prin#2026', email: 'prince@zoho.com' },
            { username: 'ali', password: 'Zoho@Ali1#2026', email: 'ali@zoho.com' }
        ];

        for (const emp of EMPLOYEES) {
            // Test login with username
            const resUsername = await AuthService.login({ username: emp.username, password: emp.password });
            assert.ok(resUsername.token, `Token issued for ${emp.username}`);
            assert.strictEqual(resUsername.user.username, emp.username);
            assert.strictEqual(resUsername.user.role, 'employee');

            // Verify JWT decodes correctly
            const decoded = jwt.verify(resUsername.token, config.jwtSecret);
            assert.strictEqual(decoded.userId, resUsername.user.id);
            assert.strictEqual(decoded.role, 'employee');

            // Test login with email
            const resEmail = await AuthService.login({ email: emp.email, password: emp.password });
            assert.ok(resEmail.token);
            assert.strictEqual(resEmail.user.email, emp.email);
        }
    });

    it('3. Firebase Centralized Handle & Firestore Export Verification', () => {
        assert.ok(FirebaseAuthService.admin, 'FirebaseAuthService exports admin');
        assert.ok(FirebaseAuthService.firestoreDb, 'FirebaseAuthService exports firestoreDb');
        assert.ok(integrationsController.admin, 'integrationsController exports admin');
        assert.ok(integrationsController.firestoreDb, 'integrationsController exports firestoreDb');
        assert.ok(FirebaseFirestoreService.getDb(), 'FirebaseFirestoreService has firestoreDb handle');
    });

    let raviUser, ananyaUser, ineeUser;

    it('4. Workspace Directory & User Profile Operations', async () => {
        const loginRavi = await AuthService.login({ username: 'ravi.bhadoria', password: 'Zoho@Ravi#2026' });
        raviUser = loginRavi.user;

        const loginAnanya = await AuthService.login({ username: 'ananya.gupta', password: 'Zoho@Anan#2026' });
        ananyaUser = loginAnanya.user;

        const loginIneet = await AuthService.login({ username: 'ineet', password: 'Zoho@Inee#2026' });
        ineeUser = loginIneet.user;

        // Directory lookup
        const directory = UsersService.getDirectory(raviUser.id, 'portal-demo-zoho');
        assert.ok(Array.isArray(directory));
        assert.ok(directory.length >= 10);
        const raviEntry = directory.find(u => u.id === raviUser.id);
        assert.strictEqual(raviEntry.connection_status, 'SELF');

        // Profile lookup
        const profile = AuthService.getProfile(raviUser.id);
        assert.strictEqual(profile.user.id, raviUser.id);
        assert.strictEqual(typeof profile.user.pendingRequestsCount, 'number');

        // Profile update
        const updated = await AuthService.updateProfile(raviUser.id, {
            bio: 'Full-stack software engineer',
            phone: '+1-555-0199'
        });
        assert.strictEqual(updated.user.bio, 'Full-stack software engineer');
        assert.strictEqual(updated.user.phone, '+1-555-0199');
    });

    let connectionRequestId, projectInviteRequestId, taskHandoffRequestId;

    it('5. In-App Requests Dispatch & Validation (createRequest)', async () => {
        // 1. Ravi sends USER_CONNECTION to Ananya by receiver_id
        const resConn = await RequestsService.createRequest(raviUser, {
            receiver_id: ananyaUser.id,
            request_type: 'USER_CONNECTION',
            payload: { message: 'Hey Ananya, let us connect on Life PMS!' }
        });
        assert.strictEqual(resConn.status, 'PENDING');
        assert.strictEqual(resConn.request_type, 'USER_CONNECTION');
        connectionRequestId = resConn.id;

        // 2. Duplicate check: sending again should fail
        await assert.rejects(
            async () => {
                await RequestsService.createRequest(raviUser, {
                    receiver_id: ananyaUser.id,
                    request_type: 'USER_CONNECTION'
                });
            },
            /already awaiting response/
        );

        // 3. Self-request check: Ravi sending to Ravi should fail
        await assert.rejects(
            async () => {
                await RequestsService.createRequest(raviUser, {
                    receiver_id: raviUser.id,
                    request_type: 'USER_CONNECTION'
                });
            },
            /cannot send an in-app request to yourself/
        );

        // 4. Create a test project for project invite
        const newProjId = 'test-proj-' + Date.now();
        db.execute(`
            INSERT INTO projects (id, portal_id, name, key_prefix, owner_id, member_ids, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', 'Mobile Banking App', 'MBA', ?, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [newProjId, raviUser.id]);

        // Ravi sends PROJECT_INVITE to Ineet by username
        const resProj = await RequestsService.createRequest(raviUser, {
            username: 'ineet',
            request_type: 'PROJECT_INVITE',
            target_entity_id: newProjId,
            payload: { role: 'developer', message: 'Join Mobile Banking App project' }
        });
        assert.strictEqual(resProj.status, 'PENDING');
        projectInviteRequestId = resProj.id;

        // 5. Create a test task list and task for task handoff
        const newTaskListId = 'test-tl-' + Date.now();
        db.execute(`
            INSERT INTO task_lists (id, portal_id, project_id, name, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', ?, 'Default Tasks', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [newTaskListId, newProjId]);

        const newTaskId = 'test-task-' + Date.now();
        db.execute(`
            INSERT INTO tasks (id, portal_id, project_id, task_list_id, prefix_key, sequence_number, name, flag, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', ?, ?, 'MBA-1', 1, 'Implement OAuth Flow', 'internal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [newTaskId, newProjId, newTaskListId]);

        // Ravi sends TASK_HANDOFF to Ineet by email
        const resTask = await RequestsService.createRequest(raviUser, {
            email: 'ineet@zoho.com',
            request_type: 'TASK_HANDOFF',
            target_entity_id: newTaskId,
            payload: { message: 'Please take over OAuth flow implementation' }
        });
        assert.strictEqual(resTask.status, 'PENDING');
        taskHandoffRequestId = resTask.id;
    });

    it('6. Incoming & Sent Requests Retrieval', () => {
        // Ananya incoming
        const ananyaIncoming = RequestsService.getIncomingRequests(ananyaUser.id);
        assert.ok(ananyaIncoming.some(r => r.id === connectionRequestId));

        // Ineet incoming
        const ineeIncoming = RequestsService.getIncomingRequests(ineeUser.id);
        assert.ok(ineeIncoming.some(r => r.id === projectInviteRequestId));
        assert.ok(ineeIncoming.some(r => r.id === taskHandoffRequestId));

        // Ravi sent
        const raviSent = RequestsService.getSentRequests(raviUser.id);
        assert.ok(raviSent.some(r => r.id === connectionRequestId));
        assert.ok(raviSent.some(r => r.id === projectInviteRequestId));
    });

    it('7. Responding to In-App Requests (Transactional Hook & State Mutation)', async () => {
        // 1. Unauthorized recipient check
        await assert.rejects(
            async () => {
                await RequestsService.respondToRequest(connectionRequestId, ineeUser.id, 'ACCEPT');
            },
            /Unauthorized/
        );

        // 2. Ananya accepts USER_CONNECTION from Ravi
        const acceptConn = await RequestsService.respondToRequest(connectionRequestId, ananyaUser.id, 'ACCEPT');
        assert.strictEqual(acceptConn.status, 'ACCEPTED');

        // Verify symmetric rows in user_connections
        const conn1 = db.queryOne('SELECT * FROM user_connections WHERE user_id = ? AND connected_user_id = ?', [ananyaUser.id, raviUser.id]);
        const conn2 = db.queryOne('SELECT * FROM user_connections WHERE user_id = ? AND connected_user_id = ?', [raviUser.id, ananyaUser.id]);
        assert.ok(conn1, 'Symmetric connection row 1 exists');
        assert.ok(conn2, 'Symmetric connection row 2 exists');

        // 3. Ineet accepts PROJECT_INVITE from Ravi
        const acceptProj = await RequestsService.respondToRequest(projectInviteRequestId, ineeUser.id, 'ACCEPT');
        assert.strictEqual(acceptProj.status, 'ACCEPTED');

        const proj = db.queryOne('SELECT * FROM projects WHERE id = ?', [acceptProj.target_entity_id]);
        const members = JSON.parse(proj.member_ids || '[]');
        assert.ok(members.includes(ineeUser.id), 'Recipient added to project member_ids');

        // 4. Ineet accepts TASK_HANDOFF from Ravi
        const acceptTask = await RequestsService.respondToRequest(taskHandoffRequestId, ineeUser.id, 'ACCEPT');
        assert.strictEqual(acceptTask.status, 'ACCEPTED');

        const task = db.queryOne('SELECT * FROM tasks WHERE id = ?', [acceptTask.target_entity_id]);
        assert.strictEqual(task.assignee_id, ineeUser.id, 'Task assignee_id updated to recipient');
    });

    it('8. Rejection & Cancellation Workflows', async () => {
        // Create request to test reject
        const reqToReject = await RequestsService.createRequest(raviUser, {
            receiver_id: ineeUser.id,
            request_type: 'USER_CONNECTION'
        });

        // Ineet rejects the request
        const rejected = await RequestsService.respondToRequest(reqToReject.id, ineeUser.id, 'REJECT');
        assert.strictEqual(rejected.status, 'REJECTED');

        // Create request to test cancel
        const reqToCancel = await RequestsService.createRequest(raviUser, {
            receiver_id: ineeUser.id,
            request_type: 'APPROVAL_REQUEST'
        });

        // Ineet cannot cancel Ravi's outgoing request
        await assert.rejects(
            async () => {
                await RequestsService.cancelRequest(reqToCancel.id, ineeUser.id);
            },
            /Unauthorized/
        );

        // Ravi cancels his own outgoing request
        const cancelled = await RequestsService.cancelRequest(reqToCancel.id, raviUser.id);
        assert.strictEqual(cancelled.status, 'CANCELLED');
    });

    it('9. Client Isolation Guard Policy (Step 4)', async () => {
        const clientUser = { id: 'client-user-xyz', role: 'client', name: 'External Client' };

        // Ensure a valid project and task list for foreign keys
        const projId = 'proj-iso-' + Date.now();
        db.execute(`
            INSERT INTO projects (id, portal_id, name, key_prefix, owner_id, member_ids, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', 'Secret Project', 'SEC', ?, '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [projId, raviUser.id]);

        const taskListId = 'tl-iso-' + Date.now();
        db.execute(`
            INSERT INTO task_lists (id, portal_id, project_id, name, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', ?, 'Internal Lists', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [taskListId, projId]);

        // Internal task
        const internalTaskId = 'int-task-' + Date.now();
        db.execute(`
            INSERT INTO tasks (id, portal_id, project_id, task_list_id, prefix_key, sequence_number, name, flag, created_at, updated_at)
            VALUES (?, 'portal-demo-zoho', ?, ?, 'SEC-1', 1, 'Secret Internal Architecture', 'internal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [internalTaskId, projId, taskListId]);

        // Client trying to send internal task handoff must be blocked
        await assert.rejects(
            async () => {
                await RequestsService.createRequest(clientUser, {
                    receiver_id: raviUser.id,
                    request_type: 'TASK_HANDOFF',
                    target_entity_id: internalTaskId
                });
            },
            /Client Isolation Policy/
        );

        // Client trying to join internal team roster must be blocked
        await assert.rejects(
            async () => {
                await RequestsService.createRequest(clientUser, {
                    receiver_id: raviUser.id,
                    request_type: 'TEAM_INVITE',
                    target_entity_id: 'team-1'
                });
            },
            /Client Isolation Policy/
        );
    });

    it('10. Admin Role & Billing Update (updateUserRoleAndBilling)', async () => {
        const updatedUser = await UsersService.updateUserRoleAndBilling(raviUser.id, {
            role: 'employee',
            department: 'Platform Architecture',
            costPerHour: 65,
            billableRatePerHour: 110
        });

        assert.strictEqual(updatedUser.department, 'Platform Architecture');
        assert.strictEqual(updatedUser.cost_per_hour, 65);
        assert.strictEqual(updatedUser.billable_rate_per_hour, 110);
    });
});
