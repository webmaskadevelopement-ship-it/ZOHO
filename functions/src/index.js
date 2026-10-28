/**
 * Life Project Management System — Firebase Cloud Functions v2
 * Exports 2nd Gen Callables, Firestore Background Triggers, Auth Blocking,
 * and Express HTTPS REST Gateway.
 */

const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { beforeUserSignedIn } = require('firebase-functions/v2/identity');

const { db, auth } = require('./config/firebase');
const FirestoreService = require('./services/firestoreService');
const CriticalPathEngine = require('./services/criticalPathEngine');
const EvmEngine = require('./services/evmEngine');
const AstFilterEngine = require('./services/astFilterEngine');
const BlueprintEngine = require('./services/blueprintEngine');

// ============================================================================
// 1. AUTH BLOCKING FUNCTION: Custom Claims Injection
// ============================================================================
exports.beforeUserSignedIn = beforeUserSignedIn(async (event) => {
    const user = event.data;
    const email = user.email || '';

    // Lookup portal membership for custom claims
    let activePortalId = 'portal-demo-zoho';
    let role = 'employee';
    let isClientUser = false;

    if (email.includes('admin')) {
        role = 'admin';
    } else if (email.includes('manager')) {
        role = 'manager';
    } else if (email.includes('client')) {
        role = 'client';
        isClientUser = true;
    }

    return {
        customClaims: {
            activePortalId,
            role,
            isClientUser,
            zpaid: user.uid
        }
    };
});

// ============================================================================
// 2. CALLABLE CLOUD FUNCTIONS (2nd Gen)
// ============================================================================

// A. Create Portal
exports.createPortal = onCall(async (request) => {
    const { name, slug, customDomain, currency } = request.data;
    const userId = request.auth?.uid || 'system';

    if (!name) throw new HttpsError('invalid-argument', 'Portal name is required.');

    try {
        return await FirestoreService.createPortal({
            name,
            slug,
            customDomain,
            currency,
            creatorUserId: userId
        });
    } catch (err) {
        throw new HttpsError('internal', err.message);
    }
});

// B. Create Project
exports.createProject = onCall(async (request) => {
    const { portalId, name, keyPrefix, description, startDate, endDate, budgetConfig } = request.data;
    const userId = request.auth?.uid || 'system';

    if (!portalId || !name) throw new HttpsError('invalid-argument', 'portalId and name are required.');

    try {
        return await FirestoreService.createProject(portalId, {
            ownerId: userId,
            name,
            keyPrefix,
            description,
            startDate,
            endDate,
            budgetConfig
        });
    } catch (err) {
        throw new HttpsError('internal', err.message);
    }
});

// C. Create Task (Atomic Sequence & Materialized Path)
exports.createTask = onCall(async (request) => {
    const { portalId, projectId, taskListId, name, ...taskFields } = request.data;
    if (!portalId || !projectId || !taskListId || !name) {
        throw new HttpsError('invalid-argument', 'portalId, projectId, taskListId, and name are required.');
    }

    try {
        return await FirestoreService.createTask(portalId, {
            projectId,
            taskListId,
            name,
            ...taskFields
        });
    } catch (err) {
        throw new HttpsError('internal', err.message);
    }
});

// C2. Update Task
exports.updateTask = onCall(async (request) => {
    const { portalId, taskId, updates } = request.data;
    if (!portalId || !taskId) throw new HttpsError('invalid-argument', 'portalId and taskId are required.');
    try {
        return await FirestoreService.updateTask(portalId, taskId, updates || {});
    } catch (err) {
        throw new HttpsError('internal', err.message);
    }
});

// D. Create Issue (Defect & SLA Targets)
exports.createIssue = onCall(async (request) => {
    const { portalId, projectId, title, severity, ...issueFields } = request.data;
    const userId = request.auth?.uid || 'system';

    if (!portalId || !projectId || !title) {
        throw new HttpsError('invalid-argument', 'portalId, projectId, and title are required.');
    }

    try {
        return await FirestoreService.createIssue(portalId, {
            projectId,
            title,
            severity,
            reporterId: userId,
            ...issueFields
        });
    } catch (err) {
        throw new HttpsError('internal', err.message);
    }
});

// E. Execute Blueprint State Machine Transition
exports.executeBlueprintTransition = onCall(async (request) => {
    const { portalId, blueprintId, taskId, targetStateId, inputPrompts } = request.data;
    const userRole = request.auth?.token?.role || 'employee';

    if (!portalId || !blueprintId || !taskId || !targetStateId) {
        throw new HttpsError('invalid-argument', 'portalId, blueprintId, taskId, and targetStateId are required.');
    }

    const taskRef = db.collection('portals').doc(portalId).collection('tasks').doc(taskId);
    const bpRef = db.collection('portals').doc(portalId).collection('blueprints').doc(blueprintId);

    const [taskDoc, bpDoc] = await Promise.all([taskRef.get(), bpRef.get()]);
    if (!taskDoc.exists) throw new HttpsError('not-found', 'Task not found.');
    if (!bpDoc.exists) throw new HttpsError('not-found', 'Blueprint not found.');

    const task = taskDoc.data();
    const blueprint = bpDoc.data();

    const validation = BlueprintEngine.validateTransition({
        blueprint,
        currentStateId: task.statusId,
        targetStateId,
        userRole,
        itemData: task,
        inputPrompts
    });

    if (!validation.allowed) {
        throw new HttpsError('permission-denied', validation.error);
    }

    const postUpdates = BlueprintEngine.executePostActions(validation.transition, task, inputPrompts);
    const finalUpdates = {
        statusId: targetStateId,
        ...postUpdates,
        updatedAt: new Date().toISOString()
    };

    await taskRef.update(finalUpdates);
    return { success: true, updatedTask: { ...task, ...finalUpdates } };
});

// F. Execute AST Filter Query
exports.executeAstFilter = onCall(async (request) => {
    const { portalId, projectId, criteria, pattern, entityType = 'task' } = request.data;
    const isClient = request.auth?.token?.role === 'client';

    if (!portalId || !projectId) throw new HttpsError('invalid-argument', 'portalId and projectId are required.');

    let items = [];
    if (entityType === 'task') {
        items = await FirestoreService.getTasks(portalId, projectId, isClient);
    } else {
        items = await FirestoreService.getIssues(portalId, projectId, isClient);
    }

    const results = AstFilterEngine.filter(items, criteria, pattern, request.auth?.uid);
    return { count: results.length, data: results };
});

// G. Calculate EVM Financial Metrics
exports.calculateEvm = onCall(async (request) => {
    const { portalId, projectId } = request.data;
    if (!portalId || !projectId) throw new HttpsError('invalid-argument', 'portalId and projectId are required.');

    const projDoc = await db.collection('portals').doc(portalId).collection('projects').doc(projectId).get();
    if (!projDoc.exists) throw new HttpsError('not-found', 'Project not found.');

    const proj = projDoc.data();
    const metrics = EvmEngine.calculateMetrics({
        startDate: proj.startDate,
        endDate: proj.endDate,
        plannedBudget: proj.budgetConfig?.plannedCost || 50000,
        completionPercentage: proj.stats?.completionPercentage || 0,
        actualCost: proj.budgetConfig?.actualCost || 0
    });

    return metrics;
});

// ============================================================================
// 3. FIRESTORE BACKGROUND TRIGGERS (2nd Gen)
// ============================================================================

// A. Cascade Dependency Auto-Reschedule on Task Date Shift
exports.onTaskDateUpdated = onDocumentUpdated('portals/{portalId}/tasks/{taskId}', async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Check if dates shifted
    if (before.startDate === after.startDate && before.endDate === after.endDate) {
        return null;
    }

    const { portalId, taskId } = event.params;
    const projectId = after.projectId;

    // Fetch all active tasks in project
    const allTasks = await FirestoreService.getTasks(portalId, projectId);
    const cascaded = CriticalPathEngine.cascadeReschedule(allTasks, taskId, after.startDate, after.endDate);

    if (cascaded.length > 1) {
        const batch = db.batch();
        for (const t of cascaded) {
            if (t.id !== taskId) {
                const ref = db.collection('portals').doc(portalId).collection('tasks').doc(t.id);
                batch.update(ref, {
                    startDate: t.startDate,
                    endDate: t.endDate,
                    updatedAt: new Date().toISOString()
                });
            }
        }
        await batch.commit();
    }

    // Recalculate Critical Path
    const solved = CriticalPathEngine.calculateCriticalPath(allTasks);
    const cpmBatch = db.batch();
    solved.forEach(st => {
        const ref = db.collection('portals').doc(portalId).collection('tasks').doc(st.id);
        cpmBatch.update(ref, { isOnCriticalPath: st.isOnCriticalPath });
    });
    await cpmBatch.commit();

    return null;
});

// B. Recalculate Project Rollup when Time Logs are Added/Updated
exports.onTimeLogWritten = onDocumentWritten('portals/{portalId}/timeLogs/{logId}', async (event) => {
    const data = event.data?.after?.data() || event.data?.before?.data();
    if (!data) return null;

    const { portalId } = event.params;
    const projectId = data.projectId;

    // Sum all approved time logs
    const logsSnap = await db.collection('portals').doc(portalId).collection('timeLogs')
        .where('projectId', '==', projectId)
        .where('status', '==', 'approved')
        .get();

    let totalMinutes = 0;
    logsSnap.docs.forEach(doc => {
        const l = doc.data();
        totalMinutes += (l.hours * 60) + (l.minutes || 0);
    });

    const actualHours = Math.round((totalMinutes / 60) * 10) / 10;
    const actualCost = actualHours * 60; // standard blended rate

    const projectRef = db.collection('portals').doc(portalId).collection('projects').doc(projectId);
    await projectRef.update({
        'budgetConfig.actualHours': actualHours,
        'budgetConfig.actualCost': actualCost,
        updatedAt: new Date().toISOString()
    });

    return null;
});

// ============================================================================
// 4. HTTPS REST API GATEWAY (onRequest)
// ============================================================================
const express = require('express');
const cors = require('cors');

const apiApp = express();
apiApp.use(cors({ origin: true }));
apiApp.use(express.json());

apiApp.get(['/health', '/api/health'], (req, res) => {
    res.json({
        status: 'UP',
        cloudProvider: 'Google Cloud Platform (Firebase 2nd Gen)',
        timestamp: new Date().toISOString()
    });
});

// Project Sheet View Endpoint on Firestore
apiApp.get('/views/sheet/:portalId/:projectId', async (req, res) => {
    try {
        const { portalId, projectId } = req.params;
        const [phases, taskLists, tasks] = await Promise.all([
            FirestoreService.getPhases(portalId, projectId),
            FirestoreService.getTaskLists(portalId, projectId),
            FirestoreService.getTasks(portalId, projectId)
        ]);

        const tree = phases.map(phase => {
            const pLists = taskLists.filter(tl => tl.phaseId === phase.id);
            return {
                ...phase,
                type: 'phase',
                taskLists: pLists.map(tl => ({
                    ...tl,
                    type: 'taskList',
                    tasks: tasks.filter(t => t.taskListId === tl.id)
                }))
            };
        });

        res.json({ success: true, data: tree });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mount full Life PMS REST Express App
try {
    const mainApp = require('../../src/app');
    apiApp.use(mainApp);
} catch (e) {
    console.info('[Functions API Gateway] Main app auto-mount notice:', e.message);
}

// Export HTTPS Cloud Function API
exports.api = onRequest(apiApp);

// Export Auth Validation Callables (functions/src/modules/auth)
const { validateLoginCallable, validateGoogleLoginCallable } = require('./modules/auth');
exports.validateLogin = validateLoginCallable;
exports.validateGoogleLogin = validateGoogleLoginCallable;
