const db = require('../../db/database');
const SlaEngine = require('../../engines/slaEngine');
const EvmEngine = require('../../engines/evmEngine');

class ReportsService {
    // 1. Burndown & Velocity
    static getBurndown(portalId, projectId) {
        const proj = db.queryOne('SELECT start_date, end_date FROM projects WHERE id = ?', [projectId]);
        const tasks = db.queryAll(
            'SELECT id, start_date, end_date, is_completed, created_at, updated_at FROM tasks WHERE project_id = ? AND is_trashed = 0',
            [projectId]
        );

        const totalTasks = tasks.length;
        const closedTasks = tasks.filter(t => t.is_completed === 1).length;
        const remainingTasks = totalTasks - closedTasks;

        return {
            projectId,
            startDate: proj?.start_date,
            endDate: proj?.end_date,
            totalScope: totalTasks,
            completed: closedTasks,
            remaining: remainingTasks,
            idealVelocity: totalTasks > 0 ? (totalTasks / 14).toFixed(1) : 0,
            actualVelocity: closedTasks
        };
    }

    // 2. Planned vs. Actual Hours
    static getPlannedVsActualHours(portalId, projectId) {
        const tasks = db.queryAll(
            'SELECT id, name, prefix_key, owners_and_work, budget FROM tasks WHERE project_id = ? AND is_trashed = 0',
            [projectId]
        );

        const logs = db.queryAll(
            `SELECT tl.task_id, SUM(tl.hours + (tl.minutes / 60.0)) as total_actual_hours
             FROM time_logs tl
             WHERE tl.project_id = ? AND tl.status = 'approved' AND tl.task_id IS NOT NULL
             GROUP BY tl.task_id`,
            [projectId]
        );

        const actualMap = new Map();
        logs.forEach(l => actualMap.set(l.task_id, Math.round(l.total_actual_hours * 10) / 10));

        let grandPlanned = 0;
        let grandActual = 0;

        const comparison = tasks.map(t => {
            const budget = JSON.parse(t.budget || '{}');
            const planned = budget.plannedHours || 0;
            const actual = actualMap.get(t.id) || 0;
            grandPlanned += planned;
            grandActual += actual;

            return {
                taskId: t.id,
                taskKey: t.prefix_key,
                taskName: t.name,
                plannedHours: planned,
                actualHours: actual,
                varianceHours: Math.round((planned - actual) * 10) / 10
            };
        });

        return {
            projectId,
            totalPlannedHours: Math.round(grandPlanned * 10) / 10,
            totalActualHours: Math.round(grandActual * 10) / 10,
            varianceHours: Math.round((grandPlanned - grandActual) * 10) / 10,
            tasks: comparison
        };
    }

    // 3. Task Status & Priority Distributions
    static getTaskDistributions(portalId, projectId) {
        const tasks = db.queryAll('SELECT status_id, priority, is_completed FROM tasks WHERE project_id = ? AND is_trashed = 0', [projectId]);

        const statusDist = {};
        const priorityDist = {};

        tasks.forEach(t => {
            statusDist[t.status_id] = (statusDist[t.status_id] || 0) + 1;
            priorityDist[t.priority] = (priorityDist[t.priority] || 0) + 1;
        });

        return {
            totalTasks: tasks.length,
            statusDistribution: statusDist,
            priorityDistribution: priorityDist
        };
    }

    // 4. Issue Aging & SLA Compliance
    static getSlaReport(portalId, projectId) {
        const issues = db.queryAll('SELECT * FROM issues WHERE project_id = ? AND is_trashed = 0', [projectId]);
        const closedIssues = issues.filter(i => i.is_closed === 1);
        const breachedIssues = issues.filter(i => i.sla_breached === 1);

        const mttrHours = SlaEngine.calculateMttr(closedIssues);
        const slaComplianceRate = issues.length > 0
            ? Math.round(((issues.length - breachedIssues.length) / issues.length) * 100)
            : 100;

        return {
            projectId,
            totalIssues: issues.length,
            openIssues: issues.length - closedIssues.length,
            closedIssues: closedIssues.length,
            breachedIssuesCount: breachedIssues.length,
            slaComplianceRatePercent: slaComplianceRate,
            mttrHours
        };
    }

    // 5. Portfolio Rollup Dashboard
    static getPortfolioSummary(portalId) {
        const projects = db.queryAll("SELECT * FROM projects WHERE portal_id = ? AND is_trashed = 0 AND project_type = 'active'", [portalId]);

        let totalPlannedBudget = 0;
        let totalActualCost = 0;
        let totalOpenTasks = 0;
        let totalClosedTasks = 0;

        const summary = projects.map(p => {
            const budget = JSON.parse(p.budget_config || '{}');
            const stats = JSON.parse(p.stats || '{}');

            totalPlannedBudget += budget.plannedCost || 0;
            totalActualCost += budget.actualCost || 0;
            totalOpenTasks += stats.openTaskCount || 0;
            totalClosedTasks += stats.closedTaskCount || 0;

            return {
                id: p.id,
                name: p.name,
                keyPrefix: p.key_prefix,
                healthScore: stats.healthScore || 'on_track',
                completionPercentage: stats.completionPercentage || 0,
                plannedCost: budget.plannedCost || 0,
                actualCost: budget.actualCost || 0,
                openTasks: stats.openTaskCount || 0,
                closedTasks: stats.closedTaskCount || 0
            };
        });

        return {
            projectCount: projects.length,
            totalPlannedBudget,
            totalActualCost,
            totalOpenTasks,
            totalClosedTasks,
            overallCompletionPercentage: (totalOpenTasks + totalClosedTasks) > 0
                ? Math.round((totalClosedTasks / (totalOpenTasks + totalClosedTasks)) * 100)
                : 0,
            projects: summary
        };
    }

    // 6. Vector SVG Gantt Generator
    static getGanttSvg(portalId, projectId) {
        const CriticalPathEngine = require('../../engines/criticalPathEngine');
        const proj = db.queryOne('SELECT name, key_prefix, start_date, end_date FROM projects WHERE id = ?', [projectId]);
        const tasks = db.queryAll(
            'SELECT id, name, prefix_key, sequence_number, start_date, end_date, completion_percentage, predecessors FROM tasks WHERE project_id = ? AND is_trashed = 0 ORDER BY sequence_number ASC',
            [projectId]
        );

        if (!tasks || tasks.length === 0) {
            return '<svg width="600" height="150" xmlns="http://www.w3.org/2000/svg"><text x="30" y="75" fill="#94A3B8" font-family="sans-serif">No tasks found</text></svg>';
        }

        const formatted = tasks.map(t => ({
            ...t,
            predecessors: JSON.parse(t.predecessors || '[]'),
            duration: { value: 1, type: 'days' }
        }));
        const cpm = CriticalPathEngine.calculate(formatted);
        const criticalIds = new Set(cpm.criticalPathTaskIds || []);

        // Find min and max date
        let minTime = Infinity;
        let maxTime = -Infinity;
        tasks.forEach(t => {
            const s = new Date(t.start_date || '2026-11-01').getTime();
            const e = new Date(t.end_date || '2026-11-15').getTime();
            if (s < minTime) minTime = s;
            if (e > maxTime) maxTime = e;
        });
        if (maxTime <= minTime) maxTime = minTime + (14 * 86400000);

        const totalSpan = maxTime - minTime;
        const width = 850;
        const rowHeight = 44;
        const headerHeight = 70;
        const totalHeight = headerHeight + (tasks.length * rowHeight) + 40;
        const labelWidth = 260;
        const chartWidth = width - labelWidth - 30;

        let svg = `<svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
    <linearGradient id="critGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#EF4444"/>
        <stop offset="100%" stop-color="#F87171"/>
    </linearGradient>
    <linearGradient id="normalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#2563EB"/>
        <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>
</defs>
<rect width="${width}" height="${totalHeight}" rx="12" fill="url(#bgGrad)"/>
<text x="24" y="38" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="16">${proj?.name || 'Project'} — CPM Gantt Chart</text>
<text x="24" y="58" fill="#94A3B8" font-family="sans-serif" font-size="11">Crimson tasks indicate zero-slack Critical Path</text>
<line x1="${labelWidth}" y1="${headerHeight - 10}" x2="${width - 20}" y2="${headerHeight - 10}" stroke="#334155" stroke-width="1"/>`;

        // Render tasks
        tasks.forEach((t, i) => {
            const y = headerHeight + (i * rowHeight);
            const isCrit = criticalIds.has(t.id);
            const sTime = new Date(t.start_date || '2026-11-01').getTime();
            const eTime = new Date(t.end_date || '2026-11-15').getTime();

            const xStart = labelWidth + ((sTime - minTime) / totalSpan * chartWidth);
            const barWidth = Math.max(30, ((eTime - sTime) / totalSpan * chartWidth));

            // Row background highlight
            svg += `\n<rect x="20" y="${y}" width="${width - 40}" height="${rowHeight - 6}" rx="6" fill="${i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}"/>`;

            // Label
            const keyText = `${t.prefix_key}-${t.sequence_number}`;
            svg += `\n<text x="28" y="${y + 22}" fill="${isCrit ? '#F87171' : '#E2E8F0'}" font-family="sans-serif" font-weight="600" font-size="12">${keyText} <tspan fill="#94A3B8" font-weight="400">${t.name.length > 22 ? t.name.substring(0, 20) + '...' : t.name}</tspan></text>`;

            // Bar
            const gradId = isCrit ? 'url(#critGrad)' : 'url(#normalGrad)';
            svg += `\n<rect x="${xStart}" y="${y + 7}" width="${barWidth}" height="22" rx="5" fill="${gradId}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>`;

            // Progress overlay
            if (t.completion_percentage > 0) {
                const progWidth = barWidth * (t.completion_percentage / 100);
                svg += `\n<rect x="${xStart}" y="${y + 7}" width="${progWidth}" height="22" rx="5" fill="rgba(255,255,255,0.25)"/>`;
            }

            // Percentage text inside or beside bar
            svg += `\n<text x="${xStart + 6}" y="${y + 22}" fill="#FFFFFF" font-family="sans-serif" font-weight="700" font-size="10">${t.completion_percentage}%</text>`;

            if (isCrit) {
                svg += `\n<rect x="${xStart + barWidth + 8}" y="${y + 9}" width="58" height="18" rx="4" fill="rgba(239,68,68,0.2)" stroke="#EF4444" stroke-width="0.75"/>`;
                svg += `\n<text x="${xStart + barWidth + 14}" y="${y + 22}" fill="#EF4444" font-family="sans-serif" font-weight="700" font-size="9">CRITICAL</text>`;
            }
        });

        svg += '\n</svg>';
        return svg;
    }

    // 7. Executive Status Briefing (Markdown)
    static getExecutiveBrief(portalId, projectId) {
        const proj = db.queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
        const tasks = db.queryAll('SELECT * FROM tasks WHERE project_id = ? AND is_trashed = 0', [projectId]);
        const issues = db.queryAll('SELECT * FROM issues WHERE project_id = ? AND is_trashed = 0', [projectId]);
        const evm = EvmEngine.calculateMetrics({
            startDate: proj?.start_date,
            endDate: proj?.end_date,
            plannedBudget: proj?.budget_amount || 25000,
            completionPercentage: proj?.progress_percentage || 50,
            actualCost: proj?.actual_cost || 12000
        });

        const openTasks = tasks.filter(t => !t.is_completed).length;
        const closedTasks = tasks.filter(t => t.is_completed).length;
        const openBugs = issues.filter(i => !i.is_closed).length;

        return `# Executive Briefing: ${proj?.name || 'Project'} (${proj?.key_prefix || 'ZPA'})
**Generated Date**: ${new Date().toISOString().split('T')[0]}
**Health Status**: ${evm.healthScore.toUpperCase()} (CPI: ${evm.cpi}, SPI: ${evm.spi})

---

### Key Performance Indicators
- **Overall Completion**: ${proj?.progress_percentage || 0}%
- **Schedule**: ${evm.scheduleVariance >= 0 ? 'Ahead/On Schedule' : `Lagging by $${Math.abs(evm.scheduleVariance)} PV equivalent`}
- **Financial Burn**: Actual Cost: $${evm.actualCost.toLocaleString()} | Planned Value: $${evm.plannedValue.toLocaleString()} | Planned Budget: $${evm.plannedBudget.toLocaleString()}
- **Forecast at Completion (EAC)**: $${evm.estimateAtCompletion.toLocaleString()}
- **Active Task Volume**: ${openTasks} Open / ${closedTasks} Closed (${tasks.length} total)
- **Active Defects**: ${openBugs} unresolved bugs

### Recommendations
1. Ensure developer capacity on remaining Critical Path items.
2. Review timesheet approvals for current pay period.
3. Address any open blocker-severity defect before staging rollout.
`;
    }
}

module.exports = ReportsService;
