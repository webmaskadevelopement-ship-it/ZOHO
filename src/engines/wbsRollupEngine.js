/**
 * WBS Rollup Engine
 * Aggregates stats, completion percentages, hours, and costs from:
 * Subtask -> Task -> Task List -> Phase -> Project -> Project Group
 */

const EvmEngine = require('./evmEngine');

class WbsRollupEngine {
    /**
     * Rolls up progress and stats for a specific project
     */
    static rollupProject(db, projectId) {
        // 1. Get all active tasks for project
        const tasks = db.queryAll(
            'SELECT id, task_list_id, phase_id, is_completed, completion_percentage, logged_hours, budget FROM tasks WHERE project_id = ? AND is_trashed = 0',
            [projectId]
        );

        // 2. Get all active issues for project
        const issues = db.queryAll(
            'SELECT id, is_closed, severity FROM issues WHERE project_id = ? AND is_trashed = 0',
            [projectId]
        );

        // 3. Rollup by task list
        const taskLists = db.queryAll('SELECT id FROM task_lists WHERE project_id = ?', [projectId]);
        for (const tl of taskLists) {
            const tlTasks = tasks.filter(t => t.task_list_id === tl.id);
            const total = tlTasks.length;
            const closed = tlTasks.filter(t => t.is_completed === 1).length;
            const open = total - closed;
            const avgCompletion = total > 0
                ? Math.round((tlTasks.reduce((acc, t) => acc + (t.completion_percentage || 0), 0) / total) * 10) / 10
                : 0;

            const stats = JSON.stringify({
                openTaskCount: open,
                closedTaskCount: closed,
                completionPercentage: avgCompletion
            });

            db.execute('UPDATE task_lists SET stats = ?, updated_at = ? WHERE id = ?', [
                stats,
                new Date().toISOString(),
                tl.id
            ]);
        }

        // 4. Rollup by phase
        const phases = db.queryAll('SELECT id FROM phases WHERE project_id = ?', [projectId]);
        for (const ph of phases) {
            const phTasks = tasks.filter(t => t.phase_id === ph.id);
            const total = phTasks.length;
            const avgCompletion = total > 0
                ? Math.round((phTasks.reduce((acc, t) => acc + (t.completion_percentage || 0), 0) / total) * 10) / 10
                : 0;

            db.execute('UPDATE phases SET completion_percentage = ?, updated_at = ? WHERE id = ?', [
                avgCompletion,
                new Date().toISOString(),
                ph.id
            ]);
        }

        // 5. Rollup project totals
        const totalTasks = tasks.length;
        const closedTasks = tasks.filter(t => t.is_completed === 1).length;
        const openTasks = totalTasks - closedTasks;

        const totalIssues = issues.length;
        const closedIssues = issues.filter(i => i.is_closed === 1).length;
        const openIssues = totalIssues - closedIssues;

        const projCompletion = totalTasks > 0
            ? Math.round((tasks.reduce((acc, t) => acc + (t.completion_percentage || 0), 0) / totalTasks) * 10) / 10
            : 0;

        // Calculate hours and costs from tasks and time_logs
        const timeLogs = db.queryAll(
            "SELECT hours, minutes, is_billable FROM time_logs WHERE project_id = ? AND status = 'approved'",
            [projectId]
        );
        let actualMinutes = 0;
        timeLogs.forEach(log => {
            actualMinutes += (log.hours * 60) + (log.minutes || 0);
        });
        const actualHours = Math.round((actualMinutes / 60) * 10) / 10;

        // Get project current budget config
        const proj = db.queryOne('SELECT start_date, end_date, budget_config FROM projects WHERE id = ?', [projectId]);
        let budgetConfig = {};
        if (proj && proj.budget_config) {
            budgetConfig = typeof proj.budget_config === 'string' ? JSON.parse(proj.budget_config) : proj.budget_config;
        }

        const plannedBudget = budgetConfig.plannedCost || 0;
        const actualCost = budgetConfig.actualCost || (actualHours * 50); // fallback rate
        const evm = EvmEngine.calculateMetrics({
            startDate: proj?.start_date,
            endDate: proj?.end_date,
            plannedBudget,
            completionPercentage: projCompletion,
            actualCost
        });

        budgetConfig.actualHours = actualHours;
        budgetConfig.actualCost = actualCost;
        budgetConfig.earnedValue = evm.earnedValue;

        const projectStats = {
            openTaskCount: openTasks,
            closedTaskCount: closedTasks,
            openIssueCount: openIssues,
            closedIssueCount: closedIssues,
            completionPercentage: projCompletion,
            healthScore: evm.healthScore
        };

        db.execute(
            'UPDATE projects SET stats = ?, budget_config = ?, updated_at = ? WHERE id = ?',
            [
                JSON.stringify(projectStats),
                JSON.stringify(budgetConfig),
                new Date().toISOString(),
                projectId
            ]
        );

        return {
            projectId,
            stats: projectStats,
            evm
        };
    }
}

module.exports = WbsRollupEngine;
