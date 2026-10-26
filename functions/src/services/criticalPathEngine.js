/**
 * Critical Path Method (CPM) & DAG Dependency Engine (Firebase Cloud Functions)
 */

const BusinessDayEngine = require('./businessDayEngine');

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function diffDays(startStr, endStr) {
    const s = parseDate(startStr);
    const e = parseDate(endStr);
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

class CriticalPathEngine {
    static hasCycle(tasks, predId, succId) {
        const adj = new Map();
        for (const t of tasks) {
            adj.set(t.id, []);
            const preds = Array.isArray(t.predecessors) ? t.predecessors : (typeof t.predecessors === 'string' ? JSON.parse(t.predecessors || '[]') : []);
            for (const p of preds) {
                if (!adj.has(p.taskId)) adj.set(p.taskId, []);
                adj.get(p.taskId).push(t.id);
            }
        }

        if (!adj.has(predId)) adj.set(predId, []);
        adj.get(predId).push(succId);

        const visited = new Set();
        const recStack = new Set();

        function dfs(node) {
            visited.add(node);
            recStack.add(node);

            const neighbors = adj.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor)) return true;
                } else if (recStack.has(neighbor)) {
                    return true;
                }
            }

            recStack.delete(node);
            return false;
        }

        for (const node of adj.keys()) {
            if (!visited.has(node)) {
                if (dfs(node)) return true;
            }
        }
        return false;
    }

    static calculateCriticalPath(tasks) {
        if (!tasks || tasks.length === 0) return tasks;

        const taskMap = new Map();
        const successors = new Map();
        const predecessors = new Map();

        tasks.forEach(t => {
            const preds = Array.isArray(t.predecessors) ? t.predecessors : (typeof t.predecessors === 'string' ? JSON.parse(t.predecessors || '[]') : []);
            taskMap.set(t.id, {
                ...t,
                parsedPreds: preds,
                durationDays: Math.max(1, diffDays(t.startDate || t.start_date || formatDate(new Date()), t.endDate || t.end_date || formatDate(new Date())) + 1),
                es: 0,
                ef: 0,
                ls: Infinity,
                lf: Infinity,
                slack: 0
            });
            successors.set(t.id, []);
            predecessors.set(t.id, preds.map(p => p.taskId));
        });

        taskMap.forEach((t, id) => {
            t.parsedPreds.forEach(p => {
                if (successors.has(p.taskId)) {
                    successors.get(p.taskId).push({ succId: id, type: p.type || 'FS', lag: p.lagDays || 0 });
                }
            });
        });

        // Forward Pass
        const inDegree = new Map();
        taskMap.forEach((t, id) => {
            inDegree.set(id, predecessors.get(id).filter(pId => taskMap.has(pId)).length);
        });

        const queue = [];
        inDegree.forEach((deg, id) => {
            if (deg === 0) queue.push(id);
        });

        const topoOrder = [];
        while (queue.length > 0) {
            const u = queue.shift();
            topoOrder.push(u);

            const curr = taskMap.get(u);
            curr.ef = curr.es + curr.durationDays;

            const succList = successors.get(u) || [];
            for (const { succId, type, lag } of succList) {
                if (!taskMap.has(succId)) continue;
                const succ = taskMap.get(succId);

                let minStart = curr.ef + lag;
                if (type === 'SS') minStart = curr.es + lag;
                else if (type === 'FF') minStart = curr.ef + lag - succ.durationDays;
                else if (type === 'SF') minStart = curr.es + lag - succ.durationDays;

                succ.es = Math.max(succ.es, minStart);

                inDegree.set(succId, inDegree.get(succId) - 1);
                if (inDegree.get(succId) === 0) {
                    queue.push(succId);
                }
            }
        }

        let maxEF = 0;
        taskMap.forEach(t => {
            if (t.ef > maxEF) maxEF = t.ef;
        });

        // Backward Pass
        taskMap.forEach(t => {
            const succs = successors.get(t.id) || [];
            if (succs.length === 0) {
                t.lf = maxEF;
                t.ls = t.lf - t.durationDays;
            }
        });

        const revOrder = [...topoOrder].reverse();
        for (const u of revOrder) {
            const curr = taskMap.get(u);
            const succList = successors.get(u) || [];

            for (const { succId, type, lag } of succList) {
                if (!taskMap.has(succId)) continue;
                const succ = taskMap.get(succId);

                let maxLateFinish = succ.ls - lag;
                if (type === 'SS') maxLateFinish = succ.ls - lag + curr.durationDays;
                else if (type === 'FF') maxLateFinish = succ.lf - lag;
                else if (type === 'SF') maxLateFinish = succ.lf - lag + curr.durationDays;

                curr.lf = Math.min(curr.lf, maxLateFinish);
            }
            if (curr.lf === Infinity) curr.lf = maxEF;
            curr.ls = curr.lf - curr.durationDays;
            curr.slack = Math.max(0, curr.ls - curr.es);
        }

        const result = [];
        taskMap.forEach((t) => {
            result.push({
                ...t,
                isOnCriticalPath: t.slack === 0 ? true : false,
                is_on_critical_path: t.slack === 0 ? 1 : 0
            });
        });

        return result;
    }

    static cascadeReschedule(tasks, updatedTaskId, newStartDate, newEndDate, businessHours = null, holidays = []) {
        const taskMap = new Map();
        tasks.forEach(t => {
            taskMap.set(t.id, { ...t });
        });

        const target = taskMap.get(updatedTaskId);
        if (!target) return [];

        target.startDate = newStartDate;
        target.endDate = newEndDate;
        target.start_date = newStartDate;
        target.end_date = newEndDate;

        const updated = [target];
        const queue = [updatedTaskId];
        const visited = new Set([updatedTaskId]);

        while (queue.length > 0) {
            const currId = queue.shift();
            const curr = taskMap.get(currId);

            tasks.forEach(t => {
                const preds = Array.isArray(t.predecessors) ? t.predecessors : (typeof t.predecessors === 'string' ? JSON.parse(t.predecessors || '[]') : []);
                const rel = preds.find(p => p.taskId === currId);

                if (rel) {
                    const succ = taskMap.get(t.id);
                    const lag = rel.lagDays || 0;
                    const succDuration = Math.max(1, diffDays(succ.startDate || succ.start_date || formatDate(new Date()), succ.endDate || succ.end_date || formatDate(new Date())));

                    let requiredStart = succ.startDate || succ.start_date;
                    let requiredEnd = succ.endDate || succ.end_date;
                    let shifted = false;

                    if (rel.type === 'FS' || !rel.type) {
                        const earliestStart = BusinessDayEngine.addBusinessDays(curr.endDate || curr.end_date, lag + 1, businessHours, holidays);
                        if ((succ.startDate || succ.start_date) < earliestStart) {
                            requiredStart = earliestStart;
                            requiredEnd = BusinessDayEngine.addBusinessDays(requiredStart, succDuration, businessHours, holidays);
                            shifted = true;
                        }
                    }

                    if (shifted) {
                        succ.startDate = requiredStart;
                        succ.endDate = requiredEnd;
                        succ.start_date = requiredStart;
                        succ.end_date = requiredEnd;
                        updated.push(succ);

                        if (!visited.has(succ.id)) {
                            visited.add(succ.id);
                            queue.push(succ.id);
                        }
                    }
                }
            });
        }

        return updated;
    }
}

module.exports = CriticalPathEngine;
