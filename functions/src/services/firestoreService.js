/**
 * Cloud Firestore Data Service
 * Implements the Portal-Scoped Flat Relational + Materialized Path Pattern
 * as specified in Section 1.2 of the Zoho Projects alternative blueprint.
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const BusinessDayEngine = require('./businessDayEngine');

class FirestoreService {
    // --- PORTALS ---
    static async createPortal({ name, slug, customDomain = null, logoUrl = null, currency = 'USD', businessHours, creatorUserId }) {
        const portalId = uuidv4();
        const safeSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase();
        const now = new Date().toISOString();

        const bHours = businessHours || {
            workingDays: [1, 2, 3, 4, 5],
            startHour: '09:00',
            endHour: '18:00',
            timezone: 'UTC'
        };

        const portalRef = db.collection('portals').doc(portalId);
        const memberRef = portalRef.collection('members').doc(creatorUserId);

        await db.runTransaction(async (transaction) => {
            transaction.set(portalRef, {
                id: portalId,
                name,
                slug: safeSlug,
                customDomain,
                logoUrl,
                businessHours: bHours,
                holidays: [],
                currency,
                createdAt: now,
                updatedAt: now
            });

            transaction.set(memberRef, {
                userId: creatorUserId,
                role: 'admin',
                status: 'active',
                joinedAt: now
            });
        });

        const doc = await portalRef.get();
        return doc.data();
    }

    static async getPortal(portalId) {
        const doc = await db.collection('portals').doc(portalId).get();
        if (!doc.exists) throw new Error('Portal not found.');
        return doc.data();
    }

    // --- PROJECTS ---
    static async createProject(portalId, {
        ownerId,
        name,
        description = '',
        keyPrefix = null,
        projectGroupId = null,
        startDate = null,
        endDate = null,
        isPublic = true,
        budgetConfig = {},
        memberIds = []
    }) {
        const projectId = uuidv4();
        const now = new Date().toISOString();
        const prefix = (keyPrefix || name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PR')).padEnd(3, 'J');

        const initialBudget = {
            currency: 'USD',
            budgetType: 'project_hours',
            billingMethod: 'project_hours',
            plannedCost: 50000,
            actualCost: 0,
            plannedHours: 400,
            actualHours: 0,
            revenueBudget: 85000,
            earnedValue: 0,
            ...budgetConfig
        };

        const initialStats = {
            openTaskCount: 0,
            closedTaskCount: 0,
            openIssueCount: 0,
            closedIssueCount: 0,
            completionPercentage: 0,
            healthScore: 'on_track'
        };

        const projectRef = db.collection('portals').doc(portalId).collection('projects').doc(projectId);
        const internalListRef = db.collection('portals').doc(portalId).collection('taskLists').doc(uuidv4());
        const externalListRef = db.collection('portals').doc(portalId).collection('taskLists').doc(uuidv4());

        await db.runTransaction(async (transaction) => {
            transaction.set(projectRef, {
                id: projectId,
                portalId,
                projectGroupId,
                name,
                description,
                keyPrefix: prefix,
                taskSeqCounter: 0,
                issueSeqCounter: 0,
                ownerId,
                memberIds: Array.from(new Set([ownerId, ...memberIds])),
                clientCompanyIds: [],
                projectType: 'active',
                isPublic,
                isStrictSchedule: false,
                isRollupProject: false,
                startDate,
                endDate,
                budgetConfig: initialBudget,
                stats: initialStats,
                customFields: {},
                createdAt: now,
                updatedAt: now
            });

            // Auto-create default internal and client-visible Task Lists
            transaction.set(internalListRef, {
                id: internalListRef.id,
                portalId,
                projectId,
                phaseId: null,
                name: 'General (Internal)',
                flag: 'internal',
                isGeneralDefault: true,
                isCompleted: false,
                sequence: { milestoneSequence: 1, projectSequence: 1 },
                stats: { openTaskCount: 0, closedTaskCount: 0, completionPercentage: 0 },
                createdAt: now,
                updatedAt: now
            });

            transaction.set(externalListRef, {
                id: externalListRef.id,
                portalId,
                projectId,
                phaseId: null,
                name: 'General (Client Visible)',
                flag: 'external',
                isGeneralDefault: true,
                isCompleted: false,
                sequence: { milestoneSequence: 2, projectSequence: 2 },
                stats: { openTaskCount: 0, closedTaskCount: 0, completionPercentage: 0 },
                createdAt: now,
                updatedAt: now
            });
        });

        const doc = await projectRef.get();
        return doc.data();
    }

    static async getProjects(portalId, isClient = false) {
        let query = db.collection('portals').doc(portalId).collection('projects').where('projectType', '==', 'active');
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }

    // --- PHASES (MILESTONES) ---
    static async createPhase(portalId, {
        projectId,
        name,
        description = '',
        startDate = null,
        endDate = null,
        ownerId = null,
        budget = 0,
        flag = 'internal',
        startAfterPhaseId = null,
        startAfterDays = 0,
        sequence = 1
    }) {
        const phaseId = uuidv4();
        const now = new Date().toISOString();
        const phaseRef = db.collection('portals').doc(portalId).collection('phases').doc(phaseId);

        let finalStart = startDate;
        let finalEnd = endDate;

        if (startAfterPhaseId) {
            const predDoc = await db.collection('portals').doc(portalId).collection('phases').doc(startAfterPhaseId).get();
            if (predDoc.exists && predDoc.data().endDate) {
                finalStart = BusinessDayEngine.addBusinessDays(predDoc.data().endDate, startAfterDays || 1);
                if (!finalEnd) finalEnd = BusinessDayEngine.addBusinessDays(finalStart, 14);
            }
        }

        const data = {
            id: phaseId,
            portalId,
            projectId,
            name,
            description,
            startDate: finalStart,
            endDate: finalEnd,
            ownerId,
            budget,
            completionPercentage: 0,
            flag,
            status: 'active',
            startAfterPhaseId,
            startAfterDays,
            sequence,
            createdAt: now,
            updatedAt: now
        };

        await phaseRef.set(data);
        return data;
    }

    static async getPhases(portalId, projectId, isClient = false) {
        let query = db.collection('portals').doc(portalId).collection('phases').where('projectId', '==', projectId);
        if (isClient) {
            query = query.where('flag', '==', 'external');
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data()).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    }

    // --- TASK LISTS ---
    static async getTaskLists(portalId, projectId, isClient = false) {
        let query = db.collection('portals').doc(portalId).collection('taskLists').where('projectId', '==', projectId);
        if (isClient) {
            query = query.where('flag', '==', 'external');
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }

    // --- TASKS & SUBTASKS (ATOMIC SEQUENCE & MATERIALIZED PATH) ---
    static async createTask(portalId, {
        projectId,
        taskListId,
        phaseId = null,
        name,
        descriptionHtml = '',
        flag = 'internal',
        parentTaskId = null,
        statusId = 'open',
        priority = 'medium',
        completionPercentage = 0,
        startDate = null,
        endDate = null,
        duration = { value: 1, type: 'days' },
        predecessors = [],
        ownerIds = [],
        billingType = 'billable',
        budget = {}
    }) {
        const taskId = uuidv4();
        const now = new Date().toISOString();
        const projectRef = db.collection('portals').doc(portalId).collection('projects').doc(projectId);
        const taskRef = db.collection('portals').doc(portalId).collection('tasks').doc(taskId);

        return await db.runTransaction(async (transaction) => {
            const projectDoc = await transaction.get(projectRef);
            if (!projectDoc.exists) throw new Error('Project not found.');

            const project = projectDoc.data();
            const nextSeq = (project.taskSeqCounter || 0) + 1;
            const prefixKey = `${project.keyPrefix}-${nextSeq}`;

            // Resolve depth, rootTaskId and materialized path (ancestorIds)
            let depth = 0;
            let rootTaskId = null;
            let ancestorIds = [];

            if (parentTaskId) {
                const parentDoc = await transaction.get(db.collection('portals').doc(portalId).collection('tasks').doc(parentTaskId));
                if (parentDoc.exists) {
                    const parent = parentDoc.data();
                    depth = (parent.depth || 0) + 1;
                    rootTaskId = parent.rootTaskId || parent.id;
                    ancestorIds = [...(parent.ancestorIds || []), parent.id];
                }
            }

            let finalStart = startDate || now.split('T')[0];
            let finalEnd = endDate;
            if (!finalEnd && finalStart) {
                finalEnd = BusinessDayEngine.addBusinessDays(finalStart, (duration?.value || 1) - 1);
            }

            const isCompleted = completionPercentage === 100 || statusId === 'completed';

            const taskData = {
                id: taskId,
                portalId,
                projectId,
                phaseId,
                taskListId,
                prefixKey,
                sequenceNumber: nextSeq,
                name,
                descriptionHtml,
                flag,
                depth,
                parentTaskId,
                rootTaskId,
                ancestorIds,
                sheetSequence: nextSeq,
                statusId,
                isCompleted,
                priority,
                completionPercentage,
                startDate: finalStart,
                endDate: finalEnd,
                duration,
                predecessors,
                successorIds: [],
                isOnCriticalPath: false,
                ownerIds,
                billingType,
                budget,
                checklistItems: [],
                isTrashed: false,
                createdAt: now,
                updatedAt: now
            };

            transaction.set(taskRef, taskData);
            transaction.update(projectRef, {
                taskSeqCounter: nextSeq,
                updatedAt: now
            });

            return taskData;
        });
    }

    static async getTasks(portalId, projectId, isClient = false) {
        let query = db.collection('portals').doc(portalId).collection('tasks')
            .where('projectId', '==', projectId)
            .where('isTrashed', '==', false);

        if (isClient) {
            query = query.where('flag', '==', 'external');
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data()).sort((a, b) => (a.sheetSequence || 0) - (b.sheetSequence || 0));
    }

    static async getTask(portalId, taskId) {
        const doc = await db.collection('portals').doc(portalId).collection('tasks').doc(taskId).get();
        if (!doc.exists) throw new Error('Task not found.');
        return doc.data();
    }

    static async updateTask(portalId, taskId, updates) {
        const taskRef = db.collection('portals').doc(portalId).collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) throw new Error('Task not found.');

        const now = new Date().toISOString();
        const finalUpdates = {
            ...updates,
            updatedAt: now
        };

        if (updates.statusId === 'completed' || updates.statusId === 'closed' || updates.completionPercentage === 100) {
            finalUpdates.isCompleted = true;
        } else if (updates.statusId) {
            finalUpdates.isCompleted = false;
        }

        await taskRef.update(finalUpdates);
        const updated = await taskRef.get();
        return updated.data();
    }

    // --- ISSUES & DEFECTS ---
    static async createIssue(portalId, {
        projectId,
        title,
        descriptionHtml = '',
        severity = 'major',
        reproducibility = 'always',
        classification = 'ui',
        module = 'General',
        affectedMilestoneId = null,
        releaseMilestoneId = null,
        assigneeId = null,
        reporterId,
        flag = 'internal',
        priority = 'medium'
    }) {
        const issueId = uuidv4();
        const now = new Date();
        const nowIso = now.toISOString();

        const projectRef = db.collection('portals').doc(portalId).collection('projects').doc(projectId);
        const issueRef = db.collection('portals').doc(portalId).collection('issues').doc(issueId);

        return await db.runTransaction(async (transaction) => {
            const projectDoc = await transaction.get(projectRef);
            if (!projectDoc.exists) throw new Error('Project not found.');

            const project = projectDoc.data();
            const nextSeq = (project.issueSeqCounter || 0) + 1;
            const prefixKey = `BUG-${nextSeq}`;

            // Calculate SLA deadlines
            const SlaEngine = require('./slaEngine');
            const sla = SlaEngine.getSlaTargets(severity, now);

            const issueData = {
                id: issueId,
                portalId,
                projectId,
                affectedMilestoneId,
                releaseMilestoneId,
                prefixKey,
                sequenceNumber: nextSeq,
                title,
                descriptionHtml,
                severity,
                reproducibility,
                classification,
                module,
                statusId: 'open',
                isClosed: false,
                priority,
                assigneeId,
                reporterId,
                flag,
                slaResponseTargetDate: sla.slaResponseTargetDate,
                slaResolutionTargetDate: sla.slaResolutionTargetDate,
                slaBreached: 0,
                isTrashed: false,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            transaction.set(issueRef, issueData);
            transaction.update(projectRef, {
                issueSeqCounter: nextSeq,
                updatedAt: nowIso
            });

            return issueData;
        });
    }

    static async getIssues(portalId, projectId, isClient = false) {
        let query = db.collection('portals').doc(portalId).collection('issues')
            .where('projectId', '==', projectId)
            .where('isTrashed', '==', false);

        if (isClient) {
            query = query.where('flag', '==', 'external');
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }

    // --- TIME LOGS & STOPWATCH ---
    static async createTimeLog(portalId, {
        projectId,
        taskId = null,
        issueId = null,
        userId,
        logDate,
        hours,
        minutes = 0,
        isBillable = 1,
        workNotes = ''
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const logRef = db.collection('portals').doc(portalId).collection('timeLogs').doc(id);

        const data = {
            id,
            portalId,
            projectId,
            taskId,
            issueId,
            userId,
            logDate,
            hours: Number(hours),
            minutes: Number(minutes),
            isBillable: isBillable ? 1 : 0,
            workNotes,
            status: 'draft',
            createdAt: now
        };

        await logRef.set(data);
        return data;
    }

    static async getTimeLogs(portalId, projectId) {
        const snapshot = await db.collection('portals').doc(portalId).collection('timeLogs')
            .where('projectId', '==', projectId)
            .get();
        return snapshot.docs.map(doc => doc.data());
    }
}

module.exports = FirestoreService;
