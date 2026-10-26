/**
 * Comprehensive Backend Automated Test Suite
 * Tests all 12 modules and core algorithmic engines of the Life Project Management System
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const db = require('../src/db/database');
const config = require('../src/config');
const AuthService = require('../src/modules/auth/auth.service');
const PortalsService = require('../src/modules/portals/portals.service');
const ProjectsService = require('../src/modules/projects/projects.service');
const PhasesService = require('../src/modules/phases/phases.service');
const TaskListsService = require('../src/modules/taskLists/taskLists.service');
const TasksService = require('../src/modules/tasks/tasks.service');
const IssuesService = require('../src/modules/issues/issues.service');
const TimesheetsService = require('../src/modules/timesheets/timesheets.service');
const BudgetsService = require('../src/modules/budgets/budgets.service');
const BlueprintsService = require('../src/modules/blueprints/blueprints.service');
const ViewsService = require('../src/modules/views/views.service');
const IntegrationsService = require('../src/modules/integrations/integrations.service');
const BusinessDayEngine = require('../src/engines/businessDayEngine');
const CriticalPathEngine = require('../src/engines/criticalPathEngine');
const AstFilterEngine = require('../src/engines/astFilterEngine');
const EvmEngine = require('../src/engines/evmEngine');

describe('Life Project Management System - Backend Integration & Engine Tests', () => {
    let portalId;
    let adminToken;
    let clientToken;
    let devUserId;
    let clientUserId;
    let projectId;

    before(async () => {
        // Ensure database has seeded data
        const portal = db.queryOne("SELECT id FROM portals WHERE slug = 'acme'");
        assert.ok(portal, 'Portal should exist');
        portalId = portal.id;

        // Login as Admin
        const adminLogin = await AuthService.login({ email: 'admin@lifepms.com', password: 'Password123!' });
        assert.ok(adminLogin.token, 'Admin should receive JWT token');
        adminToken = adminLogin.token;

        // Login as Client
        const clientLogin = await AuthService.login({ email: 'client@acme.com', password: 'Password123!' });
        assert.ok(clientLogin.token, 'Client should receive JWT token');
        clientToken = clientLogin.token;
        clientUserId = clientLogin.user.id;

        // Dev user ID
        const devUser = db.queryOne("SELECT id FROM users WHERE email = 'dev@lifepms.com'");
        devUserId = devUser.id;

        // Project ID
        const proj = db.queryOne("SELECT id FROM projects WHERE key_prefix = 'ZPA'");
        projectId = proj.id;
    });

    describe('1. Authentication & Multi-Tenant Portal Scoping', () => {
        it('should authenticate user and return portals list', async () => {
            const loginRes = await AuthService.login({ email: 'dev@lifepms.com', password: 'Password123!' });
            assert.equal(loginRes.user.email, 'dev@lifepms.com');
            assert.ok(loginRes.portals.length > 0);
            assert.equal(loginRes.portals[0].slug, 'acme');
        });

        it('should reject invalid credentials with descriptive error', async () => {
            await assert.rejects(
                async () => AuthService.login({ email: 'admin@lifepms.com', password: 'WrongPassword' }),
                /Invalid email or password/
            );
        });

        it('should enforce unique portal slugs', () => {
            assert.throws(
                () => PortalsService.createPortal({ name: 'Duplicate Acme', slug: 'acme', creatorUserId: devUserId }),
                /already exists/
            );
        });
    });

    describe('2. Client Visibility & Cost Masking (Zoho Projects Core DNA)', () => {
        it('should filter out internal-flagged task lists for client users', () => {
            const allLists = TaskListsService.getTaskLists(portalId, projectId, false);
            const clientLists = TaskListsService.getTaskLists(portalId, projectId, true);

            assert.ok(allLists.some(l => l.flag === 'internal'));
            assert.ok(clientLists.every(l => l.flag === 'external'));
            assert.ok(allLists.length > clientLists.length, 'Client should see fewer lists than internal team');
        });

        it('should filter out internal-flagged tasks for client users', () => {
            const allTasks = TasksService.getTasks(portalId, projectId, false);
            const clientTasks = TasksService.getTasks(portalId, projectId, true);

            assert.ok(allTasks.some(t => t.flag === 'internal'));
            assert.ok(clientTasks.every(t => t.flag === 'external'));
        });
    });

    describe('3. 5-Level WBS Hierarchy & Subtask Materialized Path', () => {
        it('should create nested subtasks with proper depth and ancestorIds', () => {
            const taskLists = TaskListsService.getTaskLists(portalId, projectId);
            const listId = taskLists[0].id;

            // Create top-level parent task
            const parent = TasksService.createTask(portalId, {
                projectId,
                taskListId: listId,
                name: 'Parent WBS Deliverable',
                flag: 'internal'
            });
            assert.equal(parent.depth, 0);
            assert.equal(parent.parent_task_id, null);

            // Create Child Subtask (Depth 1)
            const child = TasksService.createTask(portalId, {
                projectId,
                taskListId: listId,
                parentTaskId: parent.id,
                name: 'Child Subtask Level 1',
                flag: 'internal'
            });
            assert.equal(child.depth, 1);
            assert.equal(child.parent_task_id, parent.id);
            assert.equal(child.root_task_id, parent.id);
            assert.deepEqual(child.ancestor_ids, [parent.id]);

            // Create Grandchild Subtask (Depth 2)
            const grandchild = TasksService.createTask(portalId, {
                projectId,
                taskListId: listId,
                parentTaskId: child.id,
                name: 'Grandchild Subtask Level 2',
                flag: 'internal'
            });
            assert.equal(grandchild.depth, 2);
            assert.equal(grandchild.parent_task_id, child.id);
            assert.equal(grandchild.root_task_id, parent.id);
            assert.deepEqual(grandchild.ancestor_ids, [parent.id, child.id]);
        });
    });

    describe('4. Critical Path Method (CPM) & Auto-Rescheduling Cascade', () => {
        it('should prevent circular dependencies in task DAG', () => {
            const tasks = [
                { id: 'A', predecessors: [] },
                { id: 'B', predecessors: [{ taskId: 'A' }] }
            ];

            // Adding A dependent on B would form A -> B -> A cycle
            const createsCycle = CriticalPathEngine.hasCycle(tasks, 'B', 'A');
            assert.equal(createsCycle, true, 'Should detect circular dependency');

            // Adding B dependent on C is valid
            const valid = CriticalPathEngine.hasCycle(tasks, 'A', 'C');
            assert.equal(valid, false, 'Should allow valid DAG edge');
        });

        it('should correctly calculate critical path tasks with zero slack', () => {
            const tasks = [
                { id: 'T1', start_date: '2026-10-01', end_date: '2026-10-05', predecessors: [] },
                { id: 'T2', start_date: '2026-10-06', end_date: '2026-10-15', predecessors: [{ taskId: 'T1', type: 'FS', lagDays: 0 }] }
            ];

            const solved = CriticalPathEngine.calculateCriticalPath(tasks);
            assert.equal(solved.length, 2);
            assert.equal(solved[0].is_on_critical_path, 1);
            assert.equal(solved[1].is_on_critical_path, 1);
        });

        it('should cascade auto-reschedule to successor tasks when predecessor end slips', () => {
            const tasks = [
                { id: 'T1', start_date: '2026-10-01', end_date: '2026-10-05', predecessors: [] },
                { id: 'T2', start_date: '2026-10-06', end_date: '2026-10-10', predecessors: [{ taskId: 'T1', type: 'FS', lagDays: 0 }] }
            ];

            // Shift T1 end date by 5 business days to 2026-10-12
            const shifted = CriticalPathEngine.cascadeReschedule(tasks, 'T1', '2026-10-01', '2026-10-12');
            assert.ok(shifted.length >= 2);

            const shiftedT2 = shifted.find(t => t.id === 'T2');
            assert.ok(shiftedT2.start_date > '2026-10-12', 'T2 start date must shift past T1 new end date');
        });
    });

    describe('5. AST Filter Engine & Relative Date Macros', () => {
        it('should filter items using boolean pattern "(1 AND 2) OR 3"', () => {
            const items = [
                { id: 1, priority: 'high', status_id: 'in_progress', is_completed: 0 },
                { id: 2, priority: 'low', status_id: 'open', is_completed: 1 },
                { id: 3, priority: 'medium', status_id: 'completed', is_completed: 0 }
            ];

            const criteria = [
                { index: 1, field: 'priority', operator: 'equals', value: 'high' },
                { index: 2, field: 'status_id', operator: 'equals', value: 'in_progress' },
                { index: 3, field: 'is_completed', operator: 'equals', value: 1 }
            ];

            const filtered = AstFilterEngine.filter(items, criteria, '(1 AND 2) OR 3');
            // Item 1 matches (1 AND 2)
            // Item 2 matches 3
            assert.equal(filtered.length, 2);
            assert.equal(filtered[0].id, 1);
            assert.equal(filtered[1].id, 2);
        });

        it('should correctly evaluate relative date macro "today"', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const items = [
                { id: 1, start_date: todayStr },
                { id: 2, start_date: '2020-01-01' }
            ];

            const criteria = [{ index: 1, field: 'start_date', operator: 'equals', value: 'today' }];
            const res = AstFilterEngine.filter(items, criteria, '1');
            assert.equal(res.length, 1);
            assert.equal(res[0].id, 1);
        });
    });

    describe('6. Earned Value Management (EVM) Financial Analytics', () => {
        it('should compute PV, EV, AC, CV, SV, CPI and project health score', () => {
            const evm = EvmEngine.calculateMetrics({
                startDate: '2026-10-01',
                endDate: '2026-10-31',
                plannedBudget: 10000,
                completionPercentage: 50,
                actualCost: 4000,
                asOfDate: '2026-10-16' // half-way
            });

            assert.equal(evm.plannedBudget, 10000);
            assert.equal(evm.earnedValue, 5000); // 50% of 10000
            assert.equal(evm.actualCost, 4000);
            assert.equal(evm.costVariance, 1000); // 5000 - 4000 = +1000 (Under budget!)
            assert.ok(evm.cpi > 1.0, 'CPI should be > 1.0 when cost is under budget');
            assert.equal(evm.healthScore, 'on_track');
        });

        it('should return delayed status when CPI and SPI drop below 0.8', () => {
            const evm = EvmEngine.calculateMetrics({
                startDate: '2026-10-01',
                endDate: '2026-10-31',
                plannedBudget: 10000,
                completionPercentage: 10,
                actualCost: 8000,
                asOfDate: '2026-10-25' // almost done scheduled time, but only 10% progress
            });

            assert.equal(evm.healthScore, 'delayed');
            assert.equal(evm.isOverBudget, true);
            assert.equal(evm.isBehindSchedule, true);
        });
    });

    describe('7. Stopwatch Timers, Time Logging & Approvals', () => {
        it('should start and stop stopwatch timer and automatically create time log', () => {
            const timer = TimesheetsService.startTimer(portalId, devUserId, {
                projectId,
                description: 'Unit testing live stopwatch timer'
            });
            assert.ok(timer.id);
            assert.equal(timer.is_running, 1);

            const active = TimesheetsService.getActiveTimer(devUserId);
            assert.equal(active.id, timer.id);

            const stoppedLog = TimesheetsService.stopTimer(portalId, devUserId, 'Finished timer test');
            assert.ok(stoppedLog.id);
            assert.equal(stoppedLog.status, 'draft');

            const afterStop = TimesheetsService.getActiveTimer(devUserId);
            assert.equal(afterStop, null);
        });

        it('should reject future-date manual time logs', () => {
            const futureDate = '2099-12-31';
            assert.throws(
                () => TimesheetsService.createTimeLog(portalId, {
                    projectId,
                    userId: devUserId,
                    logDate: futureDate,
                    hours: 4
                }),
                /Future-date time logging is not permitted/
            );
        });

        it('should allow manager to approve submitted timesheet', () => {
            const today = new Date().toISOString().split('T')[0];
            db.execute('DELETE FROM time_logs WHERE user_id = ? AND log_date = ?', [devUserId, today]);
            const log = TimesheetsService.createTimeLog(portalId, {
                projectId,
                userId: devUserId,
                logDate: today,
                hours: 2,
                minutes: 30,
                workNotes: 'Wrote unit tests'
            });

            // Submit
            TimesheetsService.submitTimesheets(portalId, devUserId, { timeLogIds: [log.id] });

            // Approve
            const managerUser = db.queryOne("SELECT id FROM users WHERE email = 'manager@lifepms.com'");
            const approved = TimesheetsService.reviewTimeLog(portalId, log.id, managerUser.id, {
                status: 'approved',
                comment: 'Verified and approved'
            });

            assert.equal(approved.status, 'approved');
            assert.equal(approved.approved_by, managerUser.id);
        });
    });

    describe('8. Issue SLA Engine & Issue-to-Task Conversion', () => {
        it('should calculate SLA deadlines based on severity targets', () => {
            const blocker = IssuesService.createIssue(portalId, {
                projectId,
                title: 'Blocker Bug for SLA test',
                severity: 'blocker',
                reporterId: devUserId
            });

            assert.ok(blocker.sla_response_target_date);
            assert.ok(blocker.sla_resolution_target_date);

            const created = new Date(blocker.created_at);
            const resTarget = new Date(blocker.sla_resolution_target_date);
            const diffHours = Math.round((resTarget.getTime() - created.getTime()) / (1000 * 60 * 60));
            assert.equal(diffHours, 4, 'Blocker resolution SLA must be 4 hours');
        });

        it('should convert reported defect into scheduled WBS task', () => {
            const issue = IssuesService.createIssue(portalId, {
                projectId,
                title: 'Memory leak in real-time presence sync',
                severity: 'critical',
                reporterId: devUserId
            });

            const taskLists = TaskListsService.getTaskLists(portalId, projectId);
            const conversion = IssuesService.convertIssueToTask(portalId, issue.id, taskLists[0].id);

            assert.equal(conversion.success, true);
            assert.ok(conversion.createdTaskId);
            assert.ok(conversion.task.name.includes('[FIX]'));

            // Check linked issue
            const updatedIssue = IssuesService.getIssueById(portalId, issue.id);
            assert.equal(updatedIssue.related_task_id, conversion.createdTaskId);
        });
    });

    describe('9. Blueprint Workflow State Machine', () => {
        it('should enforce role guards and during-transition mandatory prompts', () => {
            const bp = db.queryOne("SELECT id FROM blueprints WHERE entity_type = 'task'");
            const taskLists = TaskListsService.getTaskLists(portalId, projectId);
            const testTask = TasksService.createTask(portalId, {
                projectId,
                taskListId: taskLists[0].id,
                name: 'Blueprint Test Task',
                statusId: 'in_progress',
                checklistItems: [{ id: '1', label: 'Verify', checked: true }]
            });

            // Transitioning from in_progress to review requires PR link prompt
            assert.throws(
                () => BlueprintsService.executeTransition(portalId, {
                    blueprintId: bp.id,
                    entityType: 'task',
                    entityId: testTask.id,
                    targetStateId: 'review',
                    userRole: 'employee',
                    inputPrompts: {} // Missing prLink!
                }),
                /Pull Request Link.*is required/
            );

            // Supplying mandatory prompt should succeed
            const successTransition = BlueprintsService.executeTransition(portalId, {
                blueprintId: bp.id,
                entityType: 'task',
                entityId: testTask.id,
                targetStateId: 'review',
                userRole: 'employee',
                inputPrompts: { prLink: 'https://github.com/pull/42' }
            });

            assert.equal(successTransition.status_id, 'review');
        });
    });

    describe('10. Data Importer & Exporter', () => {
        it('should export project tasks and metadata to CSV and JSON', () => {
            const jsonExport = IntegrationsService.exportProjectData(portalId, projectId, 'json');
            assert.ok(jsonExport.project);
            assert.ok(Array.isArray(jsonExport.tasks));
            assert.ok(jsonExport.tasks.length > 0);

            const csvExport = IntegrationsService.exportProjectData(portalId, projectId, 'csv');
            assert.ok(typeof csvExport === 'string');
            assert.ok(csvExport.includes('PrefixKey,Name,Phase'));
            assert.ok(csvExport.includes('ZPA-1'));
        });

        it('should automatically close issue via Git commit webhook', () => {
            const issue = IssuesService.createIssue(portalId, {
                projectId,
                title: 'Typo in auth prompt message',
                severity: 'minor',
                reporterId: devUserId
            });

            const webhookRes = IntegrationsService.handleGitWebhook(portalId, {
                commitMessage: `Fixes #${issue.prefix_key} in auth dialog`,
                commitSha: '9a8b7c6d5e',
                branch: 'main',
                author: 'Devon Vance'
            });

            assert.equal(webhookRes.success, true);
            assert.ok(webhookRes.actionsTaken.some(a => a.includes(`Closed issue ${issue.prefix_key}`)));

            const closedIssue = IssuesService.getIssueById(portalId, issue.id);
            assert.equal(closedIssue.status_id, 'closed');
        });
    });

    describe('11. Creative Engines: Scenario Flight Simulator, Risk Radar & SVG Gantt', () => {
        const ScenarioSimulatorEngine = require('../src/engines/scenarioSimulatorEngine');
        const RiskRadarEngine = require('../src/engines/riskRadarEngine');
        const ReportsService = require('../src/modules/reports/reports.service');

        it('should deterministically simulate schedule slip and provide tactical mitigations', () => {
            const sim = ScenarioSimulatorEngine.simulate(portalId, projectId, {
                milestoneSlipDays: 4,
                laborCostMultiplier: 1.10
            });

            assert.ok(sim.baseline);
            assert.ok(sim.simulated);
            assert.ok(sim.simulated.slipDays >= 4);
            assert.ok(Array.isArray(sim.mitigations));
            assert.ok(sim.mitigations.length > 0);
            assert.ok(sim.simulated.actualCost > sim.baseline.actualCost);
        });

        it('should evaluate Project Health Pulse and detect chokepoint or SPOF risks', () => {
            const pulse = RiskRadarEngine.analyze(portalId, projectId);
            assert.ok(typeof pulse.compositePulse === 'number');
            assert.ok(pulse.compositePulse >= 0 && pulse.compositePulse <= 100);
            assert.ok(pulse.radarScores);
            assert.ok(Array.isArray(pulse.keyRiskAlerts));
            assert.ok(pulse.riskGrade);
        });

        it('should generate standalone SVG vector Gantt chart with Critical Path highlights', () => {
            const svg = ReportsService.getGanttSvg(portalId, projectId);
            assert.ok(typeof svg === 'string');
            assert.ok(svg.includes('<svg'));
            assert.ok(svg.includes('CRITICAL'));
            assert.ok(svg.includes('CPM Gantt Chart'));
        });

        it('should generate Executive Briefing markdown summary', () => {
            const brief = ReportsService.getExecutiveBrief(portalId, projectId);
            assert.ok(typeof brief === 'string');
            assert.ok(brief.includes('# Executive Briefing:'));
            assert.ok(brief.includes('Key Performance Indicators'));
        });
    });
});

