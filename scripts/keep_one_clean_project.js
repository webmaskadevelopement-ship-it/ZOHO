/**
 * Keep exactly 1 clean project and 1 clean task in database;
 * Purge all other sample projects, sample tasks, sample issues, and sample logs.
 * Preserves all genuine user accounts, auth config, portal settings, and system features.
 */

const db = require('../src/db/database');

const ADMIN_ID = 'd60fc0c9-63f9-4f36-8430-d0cf30b892ac'; // Nikhil Kaushik
const PORTAL_ID = 'portal-demo-zoho';
const KEEP_PROJECT_ID = 'proj-ai-training';

console.log('🔄 Cleaning sample data: keeping only 1 clean project and 1 clean task...');

// 1. Remove all other projects except KEEP_PROJECT_ID
db.execute('DELETE FROM projects WHERE id != ?', [KEEP_PROJECT_ID]);
console.log('✓ Kept project: WE-11 AI Training (proj-ai-training). Deleted other sample projects.');

// 2. Clean task lists: keep 1 task list for proj-ai-training
db.execute('DELETE FROM task_lists WHERE project_id != ?', [KEEP_PROJECT_ID]);
const remainingLists = db.queryAll('SELECT id FROM task_lists WHERE project_id = ?', [KEEP_PROJECT_ID]);
let keepListId = 'list-ai-general';
if (remainingLists.length > 0) {
    keepListId = remainingLists[0].id;
    if (remainingLists.length > 1) {
        db.execute('DELETE FROM task_lists WHERE project_id = ? AND id != ?', [KEEP_PROJECT_ID, keepListId]);
    }
} else {
    db.execute(`
        INSERT INTO task_lists (id, portal_id, project_id, name, sequence)
        VALUES (?, ?, ?, 'Project Deliverables', 1)
    `, [keepListId, PORTAL_ID, KEEP_PROJECT_ID]);
}
console.log('✓ Kept 1 task list: ' + keepListId);

// 3. Clean phases: keep 1 phase for proj-ai-training
db.execute('DELETE FROM phases WHERE project_id != ?', [KEEP_PROJECT_ID]);
const remainingPhases = db.queryAll('SELECT id FROM phases WHERE project_id = ?', [KEEP_PROJECT_ID]);
let keepPhaseId = 'phase-ai-planning';
if (remainingPhases.length > 0) {
    keepPhaseId = remainingPhases[0].id;
    if (remainingPhases.length > 1) {
        db.execute('DELETE FROM phases WHERE project_id = ? AND id != ?', [KEEP_PROJECT_ID, keepPhaseId]);
    }
} else {
    db.execute(`
        INSERT INTO phases (id, portal_id, project_id, name, status, start_date, end_date)
        VALUES (?, ?, ?, 'Phase 1 - Kickoff & Planning', 'active', '2026-10-20', '2026-11-15')
    `, [keepPhaseId, PORTAL_ID, KEEP_PROJECT_ID]);
}
console.log('✓ Kept 1 phase: ' + keepPhaseId);

// 4. Clean tasks: keep exactly 1 task assigned to Admin
db.execute('DELETE FROM tasks WHERE project_id != ?', [KEEP_PROJECT_ID]);
const remainingTasks = db.queryAll('SELECT id FROM tasks WHERE project_id = ?', [KEEP_PROJECT_ID]);
let keepTaskId = 'task-ae1-t1';
if (remainingTasks.length > 0) {
    keepTaskId = remainingTasks[0].id;
    db.execute('DELETE FROM tasks WHERE project_id = ? AND id != ?', [KEEP_PROJECT_ID, keepTaskId]);
    db.execute(`
        UPDATE tasks SET 
            name = 'Phase 1 - Kickoff & Deliverable Setup',
            prefix_key = 'AE1-T1',
            status_id = 'open',
            is_completed = 0,
            priority = 'medium',
            owner_ids = ?,
            task_list_id = ?,
            phase_id = ?
        WHERE id = ?
    `, [JSON.stringify([ADMIN_ID]), keepListId, keepPhaseId, keepTaskId]);
} else {
    db.execute(`
        INSERT INTO tasks (
            id, portal_id, project_id, task_list_id, phase_id, prefix_key, sequence_number,
            name, status_id, is_completed, priority, start_date, end_date, owner_ids, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'AE1-T1', 1,
            'Phase 1 - Kickoff & Deliverable Setup', 'open', 0, 'medium', '2026-10-24', '2026-11-15', ?, datetime('now'), datetime('now')
        )
    `, [keepTaskId, PORTAL_ID, KEEP_PROJECT_ID, keepListId, keepPhaseId, JSON.stringify([ADMIN_ID])]);
}
console.log('✓ Kept exactly 1 clean task: ' + keepTaskId);

// 5. Clean task auxiliary tables
db.execute('DELETE FROM task_dependencies');
db.execute('DELETE FROM task_relations');
db.execute('DELETE FROM task_reminders');
db.execute('DELETE FROM task_votes');

// 6. Clean sample issues, time_logs, expenses, invoices
db.execute('DELETE FROM issues');
db.execute('DELETE FROM time_logs');
db.execute('DELETE FROM active_timers');
db.execute('DELETE FROM expenses');
db.execute('DELETE FROM invoices');
console.log('✓ Cleared sample issues, time logs, expenses, and invoices (ready for real user data).');

// 7. Clean sample comments
db.execute("DELETE FROM comments WHERE entity_type != 'portal_chat'");

// 8. Update project stats for KEEP_PROJECT_ID
const statsJson = JSON.stringify({
    openTaskCount: 1,
    closedTaskCount: 0,
    openIssueCount: 0,
    closedIssueCount: 0,
    completionPercentage: 0,
    healthScore: 'on_track'
});
db.execute(`
    UPDATE projects SET 
        stats = ?,
        owner_id = ?
    WHERE id = ?
`, [statsJson, ADMIN_ID, KEEP_PROJECT_ID]);

console.log('✅ Completed: Database now has 1 clean project and 1 clean task. Ready for user to insert new data!');
