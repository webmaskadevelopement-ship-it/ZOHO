/**
 * Project Risk Radar & Health Pulse Engine
 * Evaluates structural project risks: Single Point of Failure (SPOF),
 * chokepoint tasks, SLA breach hazards, and workload overload.
 */

const db = require('../db/database');
const CriticalPathEngine = require('./criticalPathEngine');
const EvmEngine = require('./evmEngine');

class RiskRadarEngine {
    /**
     * Compute comprehensive risk analysis for a project
     * @param {string} portalId
     * @param {string} projectId
     */
    static analyze(portalId, projectId) {
        const database = db.getInstance();

        // 1. Fetch Project
        const project = database.prepare('SELECT * FROM projects WHERE id = ? AND portal_id = ?').get(projectId, portalId);
        if (!project) throw new Error('Project not found');

        // 2. Fetch Tasks
        const tasks = database.prepare(`
            SELECT id, name, prefix_key, sequence_number, status_id, priority,
                   start_date, end_date, duration, predecessors, successor_ids,
                   owner_ids, completion_percentage, flag, is_completed
            FROM tasks
            WHERE project_id = ? AND portal_id = ? AND is_trashed = 0
        `).all(projectId, portalId);

        const formattedTasks = tasks.map(t => ({
            ...t,
            predecessors: JSON.parse(t.predecessors || '[]'),
            successorIds: JSON.parse(t.successor_ids || '[]'),
            ownerIds: JSON.parse(t.owner_ids || '[]'),
            duration: JSON.parse(t.duration || '{"value":1,"type":"days"}')
        }));

        // 3. Critical Path
        const cpm = CriticalPathEngine.calculate(formattedTasks);
        const criticalTaskIds = new Set(cpm.criticalPathTaskIds || []);

        // 4. Fetch Users for names & roles
        const users = database.prepare(`
            SELECT u.id, u.name, u.email, u.role
            FROM users u
            JOIN portal_members pm ON pm.user_id = u.id
            WHERE pm.portal_id = ?
        `).all(portalId);
        const userMap = new Map();
        users.forEach(u => userMap.set(u.id, u));

        // Dimension 1: Single Point of Failure (SPOF)
        const criticalAssigneeCounts = new Map();
        let openCriticalTasks = 0;

        for (const t of formattedTasks) {
            if (criticalTaskIds.has(t.id) && !t.is_completed) {
                openCriticalTasks++;
                for (const uid of t.ownerIds) {
                    criticalAssigneeCounts.set(uid, (criticalAssigneeCounts.get(uid) || 0) + 1);
                }
            }
        }

        const spofAlerts = [];
        let spofScore = 100;
        for (const [uid, count] of criticalAssigneeCounts.entries()) {
            const ratio = openCriticalTasks > 0 ? (count / openCriticalTasks) : 0;
            if (ratio >= 0.5 && openCriticalTasks >= 2) {
                const user = userMap.get(uid);
                const userName = user ? user.name : 'Unknown Engineer';
                spofAlerts.push({
                    userId: uid,
                    userName,
                    ratio: Math.round(ratio * 100),
                    message: `${userName} holds ${Math.round(ratio * 100)}% of uncompleted Critical Path tasks. Project delivery hinges on this single individual.`
                });
                spofScore -= 30;
            }
        }

        // Dimension 2: Dependency Chokepoints (Nodes where multiple paths converge)
        const chokepoints = [];
        let chokepointScore = 100;
        for (const t of formattedTasks) {
            if (!t.is_completed && t.successorIds.length >= 2) {
                chokepoints.push({
                    taskId: t.id,
                    taskKey: `${t.prefix_key}-${t.sequence_number}`,
                    taskName: t.name,
                    dependentCount: t.successorIds.length,
                    message: `Task #${t.prefix_key}-${t.sequence_number} blocks ${t.successorIds.length} successor tasks.`
                });
                chokepointScore -= 12;
            }
        }
        chokepointScore = Math.max(30, chokepointScore);

        // Dimension 3: SLA Breach Hazards
        const issues = database.prepare(`
            SELECT id, prefix_key, sequence_number, title, severity, status_id,
                   sla_response_target_date, sla_resolution_target_date, sla_breached
            FROM issues
            WHERE project_id = ? AND portal_id = ? AND status_id NOT IN ('closed', 'resolved')
        `).all(projectId, portalId);

        const slaRisks = [];
        let slaScore = 100;
        const now = new Date();

        for (const iss of issues) {
            const resDeadline = iss.sla_resolution_target_date ? new Date(iss.sla_resolution_target_date) : null;
            if (iss.sla_breached) {
                slaRisks.push({
                    issueId: iss.id,
                    issueKey: iss.prefix_key,
                    title: iss.title,
                    severity: iss.severity,
                    status: 'BREACHED',
                    message: `SLA already breached on ${iss.severity.toUpperCase()} bug #${iss.prefix_key}`
                });
                slaScore -= 25;
            } else if (resDeadline && (resDeadline.getTime() - now.getTime()) < (48 * 3600 * 1000)) {
                const hoursLeft = Math.max(0, Math.round((resDeadline.getTime() - now.getTime()) / (3600 * 1000)));
                slaRisks.push({
                    issueId: iss.id,
                    issueKey: iss.prefix_key,
                    title: iss.title,
                    severity: iss.severity,
                    status: 'AT_RISK',
                    hoursRemaining: hoursLeft,
                    message: `${hoursLeft}h remaining until SLA breach on #${iss.prefix_key}`
                });
                slaScore -= 10;
            }
        }
        slaScore = Math.max(20, slaScore);

        // Dimension 4: Workload Over-Allocation
        const activeHoursPerUser = new Map();
        for (const t of formattedTasks) {
            if (!t.is_completed) {
                const taskHours = (t.duration.value || 1) * 8;
                for (const uid of t.ownerIds) {
                    activeHoursPerUser.set(uid, (activeHoursPerUser.get(uid) || 0) + taskHours);
                }
            }
        }

        const workloadAlerts = [];
        let workloadScore = 100;
        for (const [uid, totalHours] of activeHoursPerUser.entries()) {
            if (totalHours > 40) {
                const user = userMap.get(uid);
                const userName = user ? user.name : 'Team Member';
                workloadAlerts.push({
                    userId: uid,
                    userName,
                    totalHours,
                    message: `${userName} has ${totalHours}h of open task commitments (over capacity).`
                });
                workloadScore -= 15;
            }
        }
        workloadScore = Math.max(35, workloadScore);

        // Dimension 5: EVM & Budget Efficiency
        const evm = EvmEngine.calculateMetrics({
            startDate: project.start_date,
            endDate: project.end_date,
            plannedBudget: project.budget_amount || 25000,
            completionPercentage: project.progress_percentage || 50,
            actualCost: project.actual_cost || 12000
        });

        let budgetScore = 100;
        if (evm.cpi < 0.8) budgetScore = 40;
        else if (evm.cpi < 0.95) budgetScore = 70;

        let scheduleScore = 100;
        if (evm.spi < 0.8) scheduleScore = 40;
        else if (evm.spi < 0.95) scheduleScore = 70;

        // Composite Health Index (Weighted Average)
        const compositePulse = Math.round(
            (spofScore * 0.20) +
            (chokepointScore * 0.20) +
            (slaScore * 0.20) +
            (workloadScore * 0.15) +
            (budgetScore * 0.125) +
            (scheduleScore * 0.125)
        );

        let riskGrade = 'A';
        let healthLabel = 'Optimal';
        if (compositePulse < 55) {
            riskGrade = 'D';
            healthLabel = 'Critical Risk';
        } else if (compositePulse < 70) {
            riskGrade = 'C';
            healthLabel = 'Needs Attention';
        } else if (compositePulse < 85) {
            riskGrade = 'B';
            healthLabel = 'Moderate Risk';
        }

        return {
            projectId,
            projectName: project.name,
            compositePulse,
            riskGrade,
            healthLabel,
            radarScores: {
                spofResilience: Math.max(0, spofScore),
                dependencyResilience: Math.max(0, chokepointScore),
                slaCompliance: Math.max(0, slaScore),
                workloadBalance: Math.max(0, workloadScore),
                budgetEfficiency: Math.max(0, budgetScore),
                scheduleIntegrity: Math.max(0, scheduleScore)
            },
            keyRiskAlerts: [
                ...spofAlerts.map(a => ({ type: 'spof', severity: 'danger', ...a })),
                ...chokepoints.map(c => ({ type: 'chokepoint', severity: 'warning', ...c })),
                ...slaRisks.map(s => ({ type: 'sla', severity: s.status === 'BREACHED' ? 'danger' : 'warning', ...s })),
                ...workloadAlerts.map(w => ({ type: 'workload', severity: 'warning', ...w }))
            ],
            criticalPathTasksCount: criticalTaskIds.size,
            openBugsCount: issues.length,
            evmSummary: {
                cpi: evm.cpi,
                spi: evm.spi,
                costVariance: evm.costVariance,
                scheduleVariance: evm.scheduleVariance
            }
        };
    }
}

module.exports = RiskRadarEngine;
