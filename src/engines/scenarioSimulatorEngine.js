/**
 * Project Flight Simulator & "What-If" Scenario Engine
 * Allows project managers to deterministically simulate schedule delays,
 * developer leave, and cost fluctuations before they impact reality.
 */

const db = require('../db/database');
const CriticalPathEngine = require('./criticalPathEngine');
const EvmEngine = require('./evmEngine');

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function addDays(dateStr, days) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + days);
    return formatDate(d);
}

function diffDays(startStr, endStr) {
    const s = parseDate(startStr);
    const e = parseDate(endStr);
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

class ScenarioSimulatorEngine {
    /**
     * Run What-If simulation on a project
     * @param {string} portalId
     * @param {string} projectId
     * @param {Object} options
     * @param {Array<{ taskId: string, delayDays: number }>} [options.taskDelays]
     * @param {number} [options.milestoneSlipDays]
     * @param {Object} [options.assigneeLeave] - { assigneeId: string, days: number }
     * @param {number} [options.laborCostMultiplier] - e.g. 1.15 for 15% increase
     */
    static simulate(portalId, projectId, {
        taskDelays = [],
        milestoneSlipDays = 0,
        assigneeLeave = null,
        laborCostMultiplier = 1.0
    } = {}) {
        const database = db.getInstance();

        // 1. Fetch project metadata
        const project = database.prepare('SELECT * FROM projects WHERE id = ? AND portal_id = ?').get(projectId, portalId);
        if (!project) throw new Error('Project not found');

        // 2. Fetch baseline tasks
        const rawTasks = database.prepare(`
            SELECT id, name, prefix_key, sequence_number, status_id, priority,
                   start_date, end_date, duration, predecessors, successor_ids,
                   owner_ids, completion_percentage, flag, is_completed
            FROM tasks
            WHERE project_id = ? AND portal_id = ? AND is_trashed = 0
            ORDER BY sequence_number ASC
        `).all(projectId, portalId);

        if (rawTasks.length === 0) {
            return {
                message: 'No tasks to simulate',
                baseline: {},
                simulated: {},
                mitigations: []
            };
        }

        // Format baseline tasks
        const baselineTasks = rawTasks.map(t => ({
            ...t,
            predecessors: JSON.parse(t.predecessors || '[]'),
            successorIds: JSON.parse(t.successor_ids || '[]'),
            ownerIds: JSON.parse(t.owner_ids || '[]'),
            duration: JSON.parse(t.duration || '{"value":1,"type":"days"}')
        }));

        // Compute baseline Critical Path
        const baselineCpm = CriticalPathEngine.calculate(baselineTasks);
        const baselineCriticalIds = new Set(baselineCpm.criticalPathTaskIds || []);

        let maxTaskEnd = null;
        for (const t of baselineTasks) {
            if (t.end_date && (!maxTaskEnd || t.end_date > maxTaskEnd)) {
                maxTaskEnd = t.end_date;
            }
        }
        const baselineEnd = maxTaskEnd || project.end_date || '2026-12-31';
        const baselineDurationDays = diffDays(project.start_date || '2026-01-01', baselineEnd);

        // Compute baseline EVM
        const baselineEvm = EvmEngine.calculateMetrics({
            startDate: project.start_date,
            endDate: baselineEnd,
            plannedBudget: project.budget_amount || 25000,
            completionPercentage: project.progress_percentage || 50,
            actualCost: project.actual_cost || 12000
        });

        // 3. Clone tasks for simulation
        const simulatedTasks = JSON.parse(JSON.stringify(baselineTasks));
        const delayMap = new Map();
        for (const d of taskDelays) {
            delayMap.set(d.taskId, parseInt(d.delayDays, 10) || 0);
        }

        // Apply milestone delay or task delays
        for (const t of simulatedTasks) {
            let delayToAdd = delayMap.get(t.id) || 0;

            // If milestone slip applied, first phase tasks slip
            if (milestoneSlipDays > 0 && (t.sequence_number <= 3 || delayToAdd === 0)) {
                delayToAdd += milestoneSlipDays;
            }

            // Assignee leave impact
            if (assigneeLeave && assigneeLeave.assigneeId && assigneeLeave.days > 0) {
                if (t.ownerIds.includes(assigneeLeave.assigneeId) && !t.is_completed) {
                    delayToAdd += parseInt(assigneeLeave.days, 10);
                }
            }

            if (delayToAdd > 0 && t.end_date) {
                t.end_date = addDays(t.end_date, delayToAdd);
                t.duration.value = Math.max(1, (t.duration.value || 1) + delayToAdd);
            }
        }

        // 4. Cascade forward dependencies across DAG
        // Using Kahn's topological sort forward pass
        const taskMap = new Map();
        simulatedTasks.forEach(t => taskMap.set(t.id, t));

        let changed = true;
        let passes = 0;
        while (changed && passes < 25) {
            changed = false;
            passes++;
            for (const t of simulatedTasks) {
                for (const pred of t.predecessors) {
                    const pTask = taskMap.get(pred.taskId);
                    if (!pTask) continue;
                    const type = pred.type || 'FS';
                    const lag = pred.lagDays || 0;

                    let requiredStart = t.start_date;
                    if (type === 'FS') {
                        const target = addDays(pTask.end_date, 1 + lag);
                        if (target > requiredStart) {
                            requiredStart = target;
                        }
                    } else if (type === 'SS') {
                        const target = addDays(pTask.start_date, lag);
                        if (target > requiredStart) {
                            requiredStart = target;
                        }
                    }

                    if (requiredStart !== t.start_date) {
                        const durationDays = diffDays(t.start_date, t.end_date);
                        t.start_date = requiredStart;
                        t.end_date = addDays(requiredStart, durationDays);
                        changed = true;
                    }
                }
            }
        }

        // 5. Recompute simulated Critical Path
        const simulatedCpm = CriticalPathEngine.calculate(simulatedTasks);
        const simulatedCriticalIds = new Set(simulatedCpm.criticalPathTaskIds || []);

        let maxSimEnd = null;
        for (const t of simulatedTasks) {
            if (t.end_date && (!maxSimEnd || t.end_date > maxSimEnd)) {
                maxSimEnd = t.end_date;
            }
        }
        const simulatedEnd = maxSimEnd || addDays(baselineEnd, milestoneSlipDays);

        const simulatedDurationDays = diffDays(project.start_date || '2026-01-01', simulatedEnd);
        const slipDays = Math.max(0, diffDays(baselineEnd, simulatedEnd));

        // Detect newly critical tasks
        const newlyCriticalTasks = [];
        for (const t of simulatedTasks) {
            if (simulatedCriticalIds.has(t.id) && !baselineCriticalIds.has(t.id)) {
                newlyCriticalTasks.push(`${t.prefix_key}-${t.sequence_number}: ${t.name}`);
            }
        }

        // 6. Recalculate EVM under simulated conditions
        const adjustedActualCost = (project.actual_cost || 12000) * (laborCostMultiplier || 1.0) + (slipDays * 180);
        const simulatedEvm = EvmEngine.calculateMetrics({
            startDate: project.start_date,
            endDate: simulatedEnd,
            plannedBudget: project.budget_amount || 25000,
            completionPercentage: project.progress_percentage || 50,
            actualCost: adjustedActualCost
        });

        // 7. Generate Algorithmic Mitigations
        const mitigations = [];
        if (slipDays > 0) {
            // Find critical task with highest duration
            const criticalTasks = simulatedTasks.filter(t => simulatedCriticalIds.has(t.id) && !t.is_completed);
            criticalTasks.sort((a, b) => (b.duration.value || 1) - (a.duration.value || 1));

            if (criticalTasks.length > 0) {
                const target = criticalTasks[0];
                mitigations.push({
                    type: 'fast_track',
                    severity: 'high',
                    title: `Fast-track Critical Task #${target.prefix_key}-${target.sequence_number}`,
                    description: `Reassign secondary developer to parallelize work on "${target.name}". Can recover up to ${Math.min(slipDays, 3)} days.`,
                    estimatedRecoveryDays: Math.min(slipDays, 3)
                });
            }

            // Find FS dependency that could become SS
            const fsPreds = [];
            for (const t of simulatedTasks) {
                if (simulatedCriticalIds.has(t.id)) {
                    for (const p of t.predecessors) {
                        if (p.type === 'FS') {
                            fsPreds.push({ task: t, predTaskId: p.taskId });
                        }
                    }
                }
            }

            if (fsPreds.length > 0) {
                const candidate = fsPreds[0];
                const predObj = taskMap.get(candidate.predTaskId);
                mitigations.push({
                    type: 'lead_time',
                    severity: 'medium',
                    title: `Convert Dependency to Start-to-Start (SS)`,
                    description: `Allow "${candidate.task.name}" to start with 2-day lead before "${predObj ? predObj.name : 'predecessor'}" fully completes. Recovers ~2 days.`,
                    estimatedRecoveryDays: 2
                });
            }

            if (simulatedEvm.costVariance < 0) {
                mitigations.push({
                    type: 'cost_control',
                    severity: 'warning',
                    title: 'Contractor Rate Optimization',
                    description: `Shift non-critical sprint items to standard employees to offset simulated $${Math.abs(Math.round(simulatedEvm.costVariance))} cost variance.`,
                    estimatedRecoveryDays: 0
                });
            }
        } else {
            mitigations.push({
                type: 'optimal',
                severity: 'info',
                title: 'Schedule Stable',
                description: 'Project timeline comfortably absorbs tested variance without slipping the final milestone.',
                estimatedRecoveryDays: 0
            });
        }

        return {
            projectId,
            projectName: project.name,
            scenarioParameters: {
                taskDelaysCount: taskDelays.length,
                milestoneSlipDays,
                assigneeLeave,
                laborCostMultiplier
            },
            baseline: {
                deliveryDate: baselineEnd,
                durationDays: baselineDurationDays,
                criticalPathCount: baselineCriticalIds.size,
                spi: baselineEvm.spi,
                cpi: baselineEvm.cpi,
                plannedBudget: baselineEvm.plannedBudget,
                actualCost: baselineEvm.actualCost,
                estimateAtCompletion: baselineEvm.estimateAtCompletion,
                healthScore: baselineEvm.healthScore
            },
            simulated: {
                deliveryDate: simulatedEnd,
                durationDays: simulatedDurationDays,
                slipDays,
                criticalPathCount: simulatedCriticalIds.size,
                newlyCriticalTasks,
                spi: simulatedEvm.spi,
                cpi: simulatedEvm.cpi,
                actualCost: simulatedEvm.actualCost,
                costVarianceDelta: Math.round((simulatedEvm.costVariance - baselineEvm.costVariance) * 100) / 100,
                estimateAtCompletion: simulatedEvm.estimateAtCompletion,
                healthScore: simulatedEvm.healthScore
            },
            mitigations
        };
    }
}

module.exports = ScenarioSimulatorEngine;
