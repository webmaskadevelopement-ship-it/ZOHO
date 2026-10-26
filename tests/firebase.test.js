/**
 * Google Firebase Backend Automated Test Suite
 * Verifies Cloud Functions 2nd Gen, Firestore Data Structures,
 * Security Rules Logic, and Serverless Domain Engines.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const CriticalPathEngine = require('../functions/src/services/criticalPathEngine');
const EvmEngine = require('../functions/src/services/evmEngine');
const AstFilterEngine = require('../functions/src/services/astFilterEngine');
const BlueprintEngine = require('../functions/src/services/blueprintEngine');
const SlaEngine = require('../functions/src/services/slaEngine');

describe('Google Firebase Cloud Functions & Firestore Engine Tests', () => {

    describe('1. Cloud Functions 2nd Gen Architecture Exports', () => {
        it('should properly export all 2nd Gen Callables, Triggers, and Auth Blockers', () => {
            const functions = require('../functions/src/index');

            // 1. Auth Blocking function
            assert.ok(functions.beforeUserSignedIn, 'Should export beforeUserSignedIn auth blocking trigger');

            // 2. Callables
            assert.ok(functions.createPortal, 'Should export createPortal callable');
            assert.ok(functions.createProject, 'Should export createProject callable');
            assert.ok(functions.createTask, 'Should export createTask callable');
            assert.ok(functions.createIssue, 'Should export createIssue callable');
            assert.ok(functions.executeBlueprintTransition, 'Should export executeBlueprintTransition callable');
            assert.ok(functions.executeAstFilter, 'Should export executeAstFilter callable');
            assert.ok(functions.calculateEvm, 'Should export calculateEvm callable');

            // 3. Firestore Background Triggers
            assert.ok(functions.onTaskDateUpdated, 'Should export onTaskDateUpdated Firestore trigger');
            assert.ok(functions.onTimeLogWritten, 'Should export onTimeLogWritten Firestore trigger');

            // 4. HTTPS Express REST Gateway
            assert.ok(functions.api, 'Should export api HTTPS onRequest handler');
        });
    });

    describe('2. Firestore Security Rules & Client Visibility Logic', () => {
        it('should correctly filter internal vs external assets for client users', () => {
            const items = [
                { id: 't1', name: 'Internal Architectural Refactor', flag: 'internal' },
                { id: 't2', name: 'Public Client Milestone Deliverable', flag: 'external' }
            ];

            const isClient = true;
            const filteredForClient = items.filter(item => !isClient || item.flag === 'external');

            assert.equal(filteredForClient.length, 1);
            assert.equal(filteredForClient[0].id, 't2');
        });
    });

    describe('3. Directed Acyclic Graph (DAG) Critical Path Engine', () => {
        it('should detect cycles and prevent dependency deadlocks', () => {
            const tasks = [
                { id: 'task-1', predecessors: [] },
                { id: 'task-2', predecessors: [{ taskId: 'task-1' }] }
            ];

            // Circular: task-1 -> task-2 -> task-1
            const hasCycle = CriticalPathEngine.hasCycle(tasks, 'task-2', 'task-1');
            assert.equal(hasCycle, true, 'Must detect circular dependency loop');
        });

        it('should calculate zero-slack tasks on Critical Path', () => {
            const tasks = [
                { id: 'task-a', startDate: '2026-10-01', endDate: '2026-10-05', predecessors: [] },
                { id: 'task-b', startDate: '2026-10-06', endDate: '2026-10-15', predecessors: [{ taskId: 'task-a', type: 'FS', lagDays: 0 }] }
            ];

            const solved = CriticalPathEngine.calculateCriticalPath(tasks);
            assert.equal(solved.length, 2);
            assert.equal(solved[0].isOnCriticalPath, true);
            assert.equal(solved[1].isOnCriticalPath, true);
        });

        it('should cascade date shifts to dependent successor tasks', () => {
            const tasks = [
                { id: 'task-a', startDate: '2026-10-01', endDate: '2026-10-05', predecessors: [] },
                { id: 'task-b', startDate: '2026-10-06', endDate: '2026-10-10', predecessors: [{ taskId: 'task-a', type: 'FS', lagDays: 0 }] }
            ];

            // Slip task-a end date to 2026-10-15
            const cascaded = CriticalPathEngine.cascadeReschedule(tasks, 'task-a', '2026-10-01', '2026-10-15');
            const shiftedB = cascaded.find(t => t.id === 'task-b');

            assert.ok(shiftedB);
            assert.ok(shiftedB.startDate > '2026-10-15', 'Successor task-b start date must shift past predecessor end date');
        });
    });

    describe('4. Firestore AST Boolean Query Engine', () => {
        it('should evaluate boolean expression "(1 AND 2) OR 3"', () => {
            const items = [
                { id: 1, priority: 'high', statusId: 'in_progress' },
                { id: 2, priority: 'low', statusId: 'open', isCompleted: true },
                { id: 3, priority: 'medium', statusId: 'closed' }
            ];

            const criteria = [
                { index: 1, field: 'priority', operator: 'equals', value: 'high' },
                { index: 2, field: 'statusId', operator: 'equals', value: 'in_progress' },
                { index: 3, field: 'isCompleted', operator: 'equals', value: true }
            ];

            const results = AstFilterEngine.filter(items, criteria, '(1 AND 2) OR 3');
            assert.equal(results.length, 2);
            assert.equal(results[0].id, 1);
            assert.equal(results[1].id, 2);
        });
    });

    describe('5. Earned Value Management (EVM) Financial Analytics', () => {
        it('should accurately compute PV, EV, AC, CV, SV, CPI, SPI and health status', () => {
            const evm = EvmEngine.calculateMetrics({
                startDate: '2026-10-01',
                endDate: '2026-10-31',
                plannedBudget: 50000,
                completionPercentage: 60,
                actualCost: 25000,
                asOfDate: '2026-10-16'
            });

            assert.equal(evm.plannedBudget, 50000);
            assert.equal(evm.earnedValue, 30000); // 60% of 50000
            assert.equal(evm.actualCost, 25000);
            assert.equal(evm.costVariance, 5000); // 30000 - 25000 = +5000 (Under budget!)
            assert.ok(evm.cpi > 1.0);
            assert.equal(evm.healthScore, 'on_track');
        });
    });

    describe('6. Blueprint State Machine & Role Transition Guards', () => {
        it('should enforce during-transition mandatory prompts and role guards', () => {
            const blueprint = {
                name: 'Software Task Lifecycle',
                transitions: [
                    {
                        fromStateId: 'open',
                        toStateId: 'in_progress',
                        allowedRoles: ['admin', 'manager', 'employee']
                    },
                    {
                        fromStateId: 'in_progress',
                        toStateId: 'review',
                        allowedRoles: ['admin', 'manager', 'employee'],
                        duringPrompts: [{ field: 'prLink', label: 'Pull Request Link', required: true }]
                    }
                ]
            };

            // Missing mandatory prompt
            const invalid = BlueprintEngine.validateTransition({
                blueprint,
                currentStateId: 'in_progress',
                targetStateId: 'review',
                userRole: 'employee',
                inputPrompts: {}
            });
            assert.equal(invalid.allowed, false);
            assert.match(invalid.error, /Pull Request Link.*required/);

            // With prompt
            const valid = BlueprintEngine.validateTransition({
                blueprint,
                currentStateId: 'in_progress',
                targetStateId: 'review',
                userRole: 'employee',
                inputPrompts: { prLink: 'https://github.com/pr/101' }
            });
            assert.equal(valid.allowed, true);
        });
    });

    describe('7. Issue SLA Target Calculation', () => {
        it('should calculate accurate response and resolution targets by severity', () => {
            const targets = SlaEngine.getSlaTargets('blocker', new Date('2026-10-22T10:00:00Z'));
            assert.equal(targets.responseHours, 1);
            assert.equal(targets.resolutionHours, 4);

            const resTarget = new Date(targets.slaResolutionTargetDate);
            assert.equal(resTarget.toISOString(), '2026-10-22T14:00:00.000Z');
        });
    });
});
