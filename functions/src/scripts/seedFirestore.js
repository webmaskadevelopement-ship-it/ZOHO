/**
 * Cloud Firestore Seeder
 * Populates Firestore with the complete Life Project Management System dataset
 */

const { db } = require('../config/firebase');
const FirestoreService = require('../services/firestoreService');

async function seedFirestore() {
    console.log('🔥 Initializing Cloud Firestore Seeding...');

    const portalId = 'portal-demo-zoho';
    const now = new Date().toISOString();

    // 1. Create Portal
    const portalRef = db.collection('portals').doc(portalId);
    await portalRef.set({
        id: portalId,
        name: 'Acme Global Workspace',
        slug: 'acme',
        customDomain: 'pms.acme.com',
        businessHours: {
            workingDays: [1, 2, 3, 4, 5],
            startHour: '09:00',
            endHour: '18:00',
            timezone: 'UTC'
        },
        holidays: [{ name: 'New Year', date: '2026-01-01' }],
        currency: 'USD',
        createdAt: now,
        updatedAt: now
    });

    // 2. Members with Custom Claims mapping
    const members = [
        { id: 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac', role: 'admin', name: 'Nikhil Kaushik' },
        { id: '0e4352f0-b919-449a-b68a-2091efa145d4', role: 'manager', name: 'Tushar' },
        { id: 'fd6a7c35-078a-4c87-90fd-71108695d242', role: 'employee', name: 'Ritika Sharma' },
        { id: '32f96257-f17e-4036-a9bc-f678488c1e3a', role: 'employee', name: 'Varun Vashisth' },
        { id: 'dcdd64f9-263e-49ce-8fec-53077812ee50', role: 'client', name: 'Client Test' }
    ];

    for (const m of members) {
        await portalRef.collection('members').doc(m.id).set({
            userId: m.id,
            name: m.name,
            role: m.role,
            status: 'active',
            joinedAt: now
        });
    }

    // 3. Create Project
    const project = await FirestoreService.createProject(portalId, {
        ownerId: 'user-admin',
        name: 'Life Project Management System',
        keyPrefix: 'ZPA',
        description: 'Google Firebase 2nd Gen backend for Zoho Projects alternative',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        budgetConfig: {
            plannedCost: 50000,
            actualCost: 12500,
            plannedHours: 400,
            actualHours: 110,
            revenueBudget: 85000,
            earnedValue: 18000
        }
    });

    const projectId = project.id;

    // 4. Create Phases (Milestones)
    const phase1 = await FirestoreService.createPhase(portalId, {
        projectId,
        name: 'Phase 1: Cloud Firestore & Auth Architecture',
        startDate: '2026-10-01',
        endDate: '2026-10-20',
        budget: 15000,
        flag: 'external',
        sequence: 1
    });

    const phase2 = await FirestoreService.createPhase(portalId, {
        projectId,
        name: 'Phase 2: WBS Tree-Table & Critical Path Engine',
        startDate: '2026-10-21',
        endDate: '2026-11-15',
        budget: 20000,
        flag: 'external',
        startAfterPhaseId: phase1.id,
        sequence: 2
    });

    // 5. Create Task List under Phase 2
    const taskListRef = portalRef.collection('taskLists').doc('list-core-engine');
    await taskListRef.set({
        id: 'list-core-engine',
        portalId,
        projectId,
        phaseId: phase2.id,
        name: 'Core Serverless WBS Engine',
        flag: 'internal',
        sequence: { milestoneSequence: 1, projectSequence: 1 },
        stats: { openTaskCount: 2, closedTaskCount: 1, completionPercentage: 50 },
        createdAt: now,
        updatedAt: now
    });

    // 6. Create Tasks & Subtasks
    const task1 = await FirestoreService.createTask(portalId, {
        projectId,
        taskListId: 'list-core-engine',
        phaseId: phase2.id,
        name: 'Atomic Sequence & Prefix Key Generator on Firestore',
        flag: 'external',
        startDate: '2026-10-21',
        endDate: '2026-10-28',
        duration: { value: 6, type: 'days' },
        ownerIds: ['user-dev']
    });

    // Subtask with ancestor materialized path
    await FirestoreService.createTask(portalId, {
        projectId,
        taskListId: 'list-core-engine',
        phaseId: phase2.id,
        parentTaskId: task1.id,
        name: 'Materialized Path Ancestor Array Indexing',
        flag: 'internal',
        startDate: '2026-10-21',
        endDate: '2026-10-25',
        duration: { value: 4, type: 'days' },
        ownerIds: ['user-dev']
    });

    // 7. Create Issue with SLA
    await FirestoreService.createIssue(portalId, {
        projectId,
        title: 'Firestore security rule rejection for external client comments',
        severity: 'critical',
        module: 'Security Rules',
        affectedMilestoneId: phase1.id,
        releaseMilestoneId: phase2.id,
        assigneeId: 'user-dev',
        reporterId: 'user-qa',
        flag: 'internal'
    });

    console.log('✅ Cloud Firestore seeding complete! Project ID:', projectId);
}

module.exports = seedFirestore;

if (require.main === module) {
    seedFirestore().then(() => process.exit(0)).catch(err => {
        console.error('Seeding error:', err);
        process.exit(1);
    });
}
