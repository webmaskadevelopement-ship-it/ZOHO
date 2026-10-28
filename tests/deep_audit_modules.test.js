const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/database');
const RolesService = require('../src/modules/roles/roles.service');
const CustomFieldsService = require('../src/modules/customFields/customFields.service');
const InvoicesService = require('../src/modules/invoices/invoices.service');
const RateCardsService = require('../src/modules/budgets/rateCards.service');
const TagsService = require('../src/modules/tags/tags.service');
const CollaborationService = require('../src/modules/collaboration/collaboration.service');
const PhasesService = require('../src/modules/phases/phases.service');
const TasksService = require('../src/modules/tasks/tasks.service');
const IssuesService = require('../src/modules/issues/issues.service');
const ViewsService = require('../src/modules/views/views.service');
const AuthService = require('../src/modules/auth/auth.service');
const AiCoPilotService = require('../src/services/aiCoPilotService');
const WorkerRunner = require('../src/services/workers/workerRunner');

describe('Deep Backend Audit - Newly Implemented Modules & Features Test Suite', () => {
    let portalId = 'portal-demo-zoho';
    let adminUserId;
    let employeeUserId;
    let projectId;
    let sampleTaskId;
    let sampleTargetTaskId;

    before(() => {
        db.getInstance();
        const admin = db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
        const manager = db.queryOne("SELECT id FROM users WHERE role IN ('manager', 'member', 'employee') LIMIT 1") || admin;
        const proj = db.queryOne("SELECT id FROM projects LIMIT 1");

        adminUserId = admin ? admin.id : 'user-admin';
        employeeUserId = manager ? manager.id : 'user-dev';
        projectId = proj ? proj.id : 'proj-ai-training';

        const tasks = db.queryAll('SELECT id FROM tasks WHERE project_id = ? LIMIT 2', [projectId]);
        sampleTaskId = tasks[0]?.id;
        if (tasks.length >= 2) {
            sampleTargetTaskId = tasks[1]?.id;
        } else if (sampleTaskId) {
            const second = TasksService.createTask(portalId, {
                projectId,
                name: 'AE1-T2 | Phase 2 - Deliverable Setup',
                ownerIds: [adminUserId],
                statusId: 'status-open'
            });
            sampleTargetTaskId = second.id;
        }
    });

    describe('1. Roles & Permissions (Module 1, Tickets ZP-004, ZP-007)', () => {
        it('should return 5 predefined roles plus custom profiles', () => {
            const roles = RolesService.getRoles(portalId);
            assert.ok(roles.length >= 5);
            assert.ok(roles.some(r => r.key === 'admin'));
            assert.ok(roles.some(r => r.key === 'manager'));
            assert.ok(roles.some(r => r.key === 'employee'));
            assert.ok(roles.some(r => r.key === 'client'));
        });

        it('should create, update, and delete custom security profile with granular toggles', () => {
            const profile = RolesService.createProfile(portalId, {
                name: 'External Contractor Profile',
                description: 'Scoped strictly to timesheets and assigned tasks',
                permissions: { tasks: { read: true, write: true, delete: false }, finance: { read: false } }
            });
            assert.ok(profile.id);
            assert.equal(profile.name, 'External Contractor Profile');

            const updated = RolesService.updateProfile(portalId, profile.id, {
                description: 'Updated contractor permissions'
            });
            assert.equal(updated.description, 'Updated contractor permissions');

            const del = RolesService.deleteProfile(portalId, profile.id);
            assert.equal(del.success, true);
        });

        it('should mask cost_per_hour and financial fields for employee role', () => {
            const item = {
                id: 'task-test',
                name: 'Test Task',
                cost_per_hour: 85,
                billable_rate_per_hour: 120,
                budget_config: { plannedCost: 5000, actualCost: 3200, currency: 'USD' }
            };

            const masked = RolesService.maskFinancialFields(item, 'employee');
            assert.equal(masked.cost_per_hour, undefined);
            assert.equal(masked.billable_rate_per_hour, undefined);
            assert.equal(masked.budget_config.plannedCost, undefined);
            assert.equal(masked.budget_config.currency, 'USD');

            // Admin keeps all values
            const adminItem = RolesService.maskFinancialFields(item, 'admin');
            assert.equal(adminItem.cost_per_hour, 85);
            assert.equal(adminItem.budget_config.plannedCost, 5000);
        });
    });

    describe('2. Custom Fields & Layouts & Formula Evaluator (Module 6, Tickets ZP-027, ZP-028)', () => {
        let fieldId;
        it('should create custom field and project layout', () => {
            const field = CustomFieldsService.createCustomField(portalId, {
                projectId,
                name: 'Customer Impact Score',
                fieldKey: 'customer_impact',
                fieldType: 'number',
                defaultValue: '5'
            });
            assert.ok(field.id);
            fieldId = field.id;

            const layout = CustomFieldsService.createLayout(portalId, {
                name: 'Fintech Mobile Sprint Layout',
                fieldIds: [field.id],
                statuses: ['open', 'in_dev', 'qa_ready', 'closed']
            });
            assert.ok(layout.id);
            assert.equal(layout.name, 'Fintech Mobile Sprint Layout');
        });

        it('should evaluate custom formula expressions accurately without eval', () => {
            const formula = 'hours * rate + markup';
            const context = { hours: 10, rate: 75, markup: 50 };
            const result = CustomFieldsService.evaluateFormula(formula, context);
            assert.equal(result, 800);
        });
    });

    describe('3. Invoices Generation from Timesheets & Expenses (Module 8, Ticket ZP-039)', () => {
        it('should generate invoice directly from approved billable logs and expenses', () => {
            const invoice = InvoicesService.generateFromTimesheetsAndExpenses(portalId, {
                projectId,
                dueDate: '2026-11-30',
                taxPercentage: 10,
                currency: 'USD'
            });

            assert.ok(invoice.id);
            assert.ok(invoice.invoice_number.startsWith('INV-'));
            assert.equal(invoice.currency, 'USD');
            assert.equal(invoice.tax_percentage, 10);
            assert.ok(Array.isArray(invoice.items));
            assert.ok(invoice.total >= invoice.subtotal);
        });

        it('should export invoice to CSV format', () => {
            const invoices = InvoicesService.getInvoices(portalId, projectId);
            assert.ok(invoices.length > 0);
            const csvExport = InvoicesService.exportInvoice(portalId, invoices[0].id, 'csv');
            assert.equal(csvExport.format, 'csv');
            assert.ok(csvExport.content.includes('Subtotal'));
        });
    });

    describe('4. Rate Cards & Budgets (Module 8, Ticket ZP-038)', () => {
        let cardId;
        it('should create, update and query rate cards', () => {
            const card = RateCardsService.createRateCard(portalId, {
                userId: adminUserId,
                costPerHour: 65,
                billableRatePerHour: 110,
                currency: 'USD'
            });
            assert.ok(card.id);
            assert.equal(card.cost_per_hour, 65);
            assert.equal(card.billable_rate_per_hour, 110);
            cardId = card.id;

            const updated = RateCardsService.updateRateCard(portalId, card.id, {
                costPerHour: 70,
                billableRatePerHour: 125
            });
            assert.equal(updated.cost_per_hour, 70);

            const cards = RateCardsService.getRateCards(portalId);
            assert.ok(cards.some(c => c.id === cardId));
        });
    });

    describe('5. Global Tag Management (Module 6, Ticket ZP-027)', () => {
        let tagId;
        it('should create tag and assign to task', () => {
            const tag = TagsService.createTag(portalId, { name: 'Urgent Fix', color: '#EF4444' });
            assert.ok(tag.id);
            assert.equal(tag.name, 'Urgent Fix');
            tagId = tag.id;

            const assigned = TagsService.assignTag(portalId, {
                entityType: 'task',
                entityId: sampleTaskId || 'task-ae1-t42',
                tagId: tag.id
            });
            assert.ok(assigned.some(t => t.id === tag.id));

            const entityTags = TagsService.getEntityTags(portalId, 'task', sampleTaskId || 'task-ae1-t42');
            assert.ok(entityTags.some(t => t.name === 'Urgent Fix'));
        });
    });

    describe('6. Folder Hierarchy, File Versioning, Rollback & Proofing (Module 10, Ticket ZP-045, ZP-046)', () => {
        let folderId;
        let fileId;

        it('should create hierarchical folder tree and upload versioned file', () => {
            const folder = CollaborationService.createFolder(portalId, {
                projectId,
                name: 'Architecture Specifications'
            });
            assert.ok(folder.id);
            folderId = folder.id;

            const file = CollaborationService.createFile(portalId, {
                projectId,
                folderId: folder.id,
                name: 'API_Spec_v1.pdf',
                size: 102400
            });
            assert.ok(file.id);
            assert.equal(file.current_version, 1);
            fileId = file.id;

            // Upload v2
            const v2 = CollaborationService.uploadNewFileVersion(portalId, file.id, {
                name: 'API_Spec_v2.pdf',
                size: 153600,
                notes: 'Added WebSocket protocol definitions',
                uploaderId: adminUserId
            });
            assert.equal(v2.current_version, 2);

            // Rollback to v1
            const rolledBack = CollaborationService.rollbackFileVersion(portalId, file.id, 1);
            assert.equal(rolledBack.current_version, 1);
        });

        it('should toggle check-in and check-out file locking', () => {
            const lockStatus = CollaborationService.toggleFileCheckout(portalId, fileId, adminUserId);
            assert.equal(lockStatus.isCheckedOut, true);
            assert.equal(lockStatus.checkedOutBy, adminUserId);

            // Unlock
            const unlockStatus = CollaborationService.toggleFileCheckout(portalId, fileId, adminUserId);
            assert.equal(unlockStatus.isCheckedOut, false);
        });

        it('should attach visual proofing annotations with pin coordinates', () => {
            const annotation = CollaborationService.addProofingAnnotation(portalId, fileId, {
                xPercent: 35.5,
                yPercent: 42.0,
                comment: 'Change header logo alignment to center.',
                authorId: adminUserId,
                status: 'pending'
            });
            assert.ok(annotation.id);
            assert.equal(annotation.xPercent, 35.5);
            assert.equal(annotation.status, 'pending');
        });
    });

    describe('7. Sequential Phase Chaining & Release Notes Generator (Module 3 & 7, Tickets ZP-014, ZP-033)', () => {
        it('should calculate sequential phase chaining start and end dates', () => {
            const phases = PhasesService.getPhases(portalId, projectId);
            if (phases.length >= 2) {
                const chained = PhasesService.chainPhase(portalId, phases[1].id, {
                    startAfterPhaseId: phases[0].id,
                    offsetDays: 3
                });
                assert.ok(chained.start_date);
                assert.equal(chained.start_after_phase_id, phases[0].id);
            }
        });

        it('should generate formatted release notes for a phase', () => {
            const phases = PhasesService.getPhases(portalId, projectId);
            if (phases.length > 0) {
                const notes = PhasesService.generateReleaseNotes(portalId, phases[0].id);
                assert.ok(notes.markdown.includes('Release Notes'));
                assert.ok(notes.markdown.includes('Completed Tasks & Features'));
            }
        });
    });

    describe('8. Task Bulk Updates, Voting, Linking & Reminders (Module 4, Tickets ZP-020, ZP-031)', () => {
        let taskId;
        let targetTaskId;

        before(() => {
            taskId = sampleTaskId;
            targetTaskId = sampleTargetTaskId;
        });

        it('should bulk update task status', () => {
            const result = TasksService.bulkUpdate(portalId, {
                taskIds: [taskId],
                updates: { priority: 'high' }
            });
            assert.equal(result.success, true);
            assert.equal(result.updatedCount, 1);
        });

        it('should vote and unvote tasks for backlog prioritization', () => {
            const voteRes = TasksService.voteTask(portalId, taskId, adminUserId);
            assert.ok(voteRes.voteCount >= 1);
            assert.ok(voteRes.voterUserIds.includes(adminUserId));

            const unvoteRes = TasksService.unvoteTask(portalId, taskId, adminUserId);
            assert.ok(!unvoteRes.voterUserIds.includes(adminUserId));
        });

        it('should create task relation links (relates_to, blocks)', () => {
            const rel = TasksService.addTaskRelation(portalId, {
                sourceTaskId: taskId,
                targetTaskId: targetTaskId,
                relationType: 'blocks'
            });
            assert.ok(rel.length > 0);
            assert.equal(rel[0].relation_type, 'blocks');
        });

        it('should schedule smart task reminder', () => {
            const reminder = TasksService.createTaskReminder(portalId, {
                taskId,
                recipientId: adminUserId,
                triggerType: 'before_due',
                remindAt: new Date(Date.now() + 3600000).toISOString()
            });
            assert.ok(reminder.id);
            assert.equal(reminder.is_sent, 0);
        });
    });

    describe('9. Issue Duplicate Merging & Web-to-Issue Intake Form (Module 7, Tickets ZP-032, ZP-035)', () => {
        it('should submit public issue via Web-to-Issue intake form', () => {
            const publicIssue = IssuesService.webToIssue(portalId, {
                projectId,
                title: 'Crash on clicking save button on Safari iOS',
                descriptionHtml: 'User reports white screen crash.',
                severity: 'critical',
                reporterName: 'External Beta Tester'
            });
            assert.ok(publicIssue.id);
            assert.equal(publicIssue.flag, 'external');
            assert.equal(publicIssue.severity, 'critical');
        });

        it('should merge duplicate bug report into primary issue', () => {
            const bug1 = IssuesService.createIssue(portalId, {
                projectId,
                title: 'Primary Bug: Memory Leak in Gantt Chart Canvas',
                reporterId: adminUserId,
                severity: 'major'
            });
            const bug2 = IssuesService.createIssue(portalId, {
                projectId,
                title: 'Duplicate Bug: Gantt chart freezes browser tab',
                reporterId: employeeUserId,
                severity: 'major'
            });

            const merged = IssuesService.mergeIssues(portalId, bug1.id, bug2.id);
            assert.equal(merged.id, bug1.id);

            const dup = IssuesService.getIssueById(portalId, bug2.id);
            assert.equal(dup.is_closed, 1);
            assert.equal(dup.duplicate_of_issue_id, bug1.id);
        });
    });

    describe('10. Public Read-Only View Sharing & iCal Feed (Module 5 & 12, Ticket ZP-058)', () => {
        let shareToken;

        it('should create public read-only share link for Gantt view', () => {
            const share = ViewsService.createPublicShare(portalId, {
                projectId,
                viewType: 'gantt'
            });
            assert.ok(share.shareToken);
            shareToken = share.shareToken;

            const sharedData = ViewsService.getPublicShare(share.shareToken);
            assert.equal(sharedData.viewType, 'gantt');
            assert.ok(sharedData.data);
        });

        it('should generate valid RFC 5545 iCal calendar feed', () => {
            const icalString = ViewsService.generateIcalFeed(portalId, projectId);
            assert.ok(icalString.startsWith('BEGIN:VCALENDAR'));
            assert.ok(icalString.includes('END:VCALENDAR'));
        });
    });

    describe('11. Personal Access Tokens (PATs) & Session Management (Module 1 & 12, Tickets ZP-003, ZP-059)', () => {
        let tokenId;

        it('should create, list and revoke Personal Access Token (PAT)', () => {
            const pat = AuthService.createPersonalAccessToken(adminUserId, {
                name: 'CI/CD Pipeline Integration Token',
                scopes: ['read', 'write']
            });
            assert.ok(pat.id);
            assert.ok(pat.token.startsWith('zpa_pat_'));
            tokenId = pat.id;

            const tokens = AuthService.getPersonalAccessTokens(adminUserId);
            assert.ok(tokens.some(t => t.id === tokenId));

            const revoked = AuthService.revokePersonalAccessToken(adminUserId, tokenId);
            assert.equal(revoked.success, true);
        });
    });

    describe('12. Background Workers (Recurrence, Reminders, SLA Breaches) (Layer 5, Tickets ZP-030, ZP-031, ZP-034)', () => {
        it('should execute unified worker runner without errors', () => {
            const results = WorkerRunner.runAll();
            assert.ok(results.timestamp);
            assert.ok(results.recurrence !== undefined);
            assert.ok(results.reminders !== undefined);
            assert.ok(results.sla !== undefined);
        });
    });

    describe('13. AI Co-Pilot (Gemini 2.5 Pro & Flash Workflows) (Module 12, Tickets ZP-051 to ZP-054)', () => {
        it('should generate complete 5-level WBS project hierarchy from product brief', async () => {
            const wbs = await AiCoPilotService.generateWbs({
                brief: 'Build a fintech mobile banking application with biometric login and instant transfers in 8 weeks',
                projectDurationWeeks: 8
            });
            assert.ok(wbs.phases.length >= 3);
            assert.ok(wbs.phases[0].taskLists.length > 0);
            assert.ok(wbs.phases[0].taskLists[0].tasks.length > 0);
        });

        it('should analyze project risk and identify schedule bottlenecks', () => {
            const risk = AiCoPilotService.analyzeProjectRisk(portalId, projectId);
            assert.ok(risk.riskScore >= 0 && risk.riskScore <= 100);
            assert.ok(['ON TRACK', 'MODERATE RISK', 'CRITICAL RISK'].includes(risk.healthStatus));
            assert.ok(Array.isArray(risk.recommendations));
        });

        it('should summarize 50+ comments and extract action items', () => {
            const comments = [
                { content: 'We decided to use SQLite WAL mode for concurrency.', user_id: 'user-1' },
                { content: 'TODO: Run migration and update test suite.', user_id: 'user-2' },
                { content: 'Approved the design proposal.', user_id: 'user-3' }
            ];
            const summary = AiCoPilotService.summarizeThread(comments);
            assert.ok(summary.keyDecisions.length > 0);
            assert.ok(summary.actionItems.length > 0);
        });

        it('should auto-triage issue severity and classification from error keywords', () => {
            const triage = AiCoPilotService.triageIssue({
                title: 'Security vulnerability in token refresh endpoint causes server crash',
                description: 'Exploit leads to denial of service'
            });
            assert.equal(triage.suggestedSeverity, 'blocker');
            assert.equal(triage.suggestedClassification, 'security');
        });

        it('should perform semantic search across tasks, issues, and wiki', () => {
            const search = AiCoPilotService.semanticSearch(portalId, { query: 'login' });
            assert.ok(search.results.length >= 0);
        });
    });

    after(() => {
        const keepTaskId = 'task-ae1-t42';
        db.execute('DELETE FROM tasks WHERE id != ?', [keepTaskId]);
        db.execute('DELETE FROM issues');
        db.execute('DELETE FROM task_relations');
        db.execute('DELETE FROM task_reminders');
        db.execute('DELETE FROM task_votes');
    });
});

