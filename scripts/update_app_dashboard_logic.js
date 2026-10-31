const fs = require('fs');

let appJs = fs.readFileSync('src/public/app.js', 'utf8');
const isCrlf = appJs.includes('\r\n');
if (isCrlf) {
    appJs = appJs.replace(/\r\n/g, '\n');
}

// 1. Add openAddTaskForList and openAddTaskListModal to window
const helperMethods = `
function openAddTaskForList(taskListId) {
    const tlSelect = document.getElementById('taskTaskListSelect');
    if (tlSelect && taskListId) tlSelect.value = taskListId;
    openModal('modalAddTask');
}
window.openAddTaskForList = openAddTaskForList;

function openAddTaskListModal() {
    const name = prompt('Enter new Task List name:');
    if (name && name.trim()) {
        apiFetch(\`/api/v1/task-lists/project/\${currentProjectId}\`, {
            method: 'POST',
            body: JSON.stringify({ name: name.trim() })
        }).then(res => {
            if (res.success) {
                loadTaskSheetView();
            }
        });
    }
}
window.openAddTaskListModal = openAddTaskListModal;
`;

// 2. Enhance renderDashboardWidgets with Screenshot 4 dynamic widgets
const newRenderWidgets = `function renderDashboardWidgets(globalData, tasks, issues) {
    // Screenshot 4: Widget 1 - Task Status Donut Chart & Legend
    const totalTasks = tasks.length;
    const closedCount = tasks.filter(t => t.is_completed || t.status_id === 'completed' || t.status_id === 'closed').length;
    const testedCount = tasks.filter(t => t.status_id === 'to_be_tested' || (t.tags && t.tags.includes('testing'))).length;
    const openCount = totalTasks - closedCount - testedCount;

    const subtitleEl = document.getElementById('dashTaskStatusSubtitle');
    if (subtitleEl) subtitleEl.textContent = \`Total: \${totalTasks} Tasks\`;

    const legendClosed = document.getElementById('legendClosedCount');
    const legendTested = document.getElementById('legendTestedCount');
    const legendOpen = document.getElementById('legendOpenCount');
    if (legendClosed) legendClosed.textContent = closedCount;
    if (legendTested) legendTested.textContent = testedCount;
    if (legendOpen) legendOpen.textContent = Math.max(0, openCount);

    const chartContainer = document.getElementById('dashTaskStatusChartContainer');
    if (chartContainer) {
        if (totalTasks === 0) {
            chartContainer.innerHTML = \`
                <svg width="140" height="140" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#1E293B" stroke-width="4"></circle>
                    <text x="50%" y="48%" text-anchor="middle" fill="#64748B" font-size="4" font-weight="600">0 Tasks</text>
                    <text x="50%" y="58%" text-anchor="middle" fill="#475569" font-size="2.6">Empty</text>
                </svg>
            \`;
        } else {
            const closedPct = (closedCount / totalTasks) * 100;
            const testedPct = (testedCount / totalTasks) * 100;
            const openPct = Math.max(0, 100 - closedPct - testedPct);

            let dashClosed = closedPct;
            let dashTested = testedPct;
            let dashOpen = openPct;

            chartContainer.innerHTML = \`
                <svg width="140" height="140" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#1E293B" stroke-width="4.5"></circle>
                    \${closedPct > 0 ? \`<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#EF4444" stroke-width="4.5" stroke-dasharray="\${dashClosed} \${100 - dashClosed}" stroke-dashoffset="25"></circle>\` : ''}
                    \${testedPct > 0 ? \`<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#FB923C" stroke-width="4.5" stroke-dasharray="\${dashTested} \${100 - dashTested}" stroke-dashoffset="\${25 - dashClosed}"></circle>\` : ''}
                    \${openPct > 0 ? \`<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#22C55E" stroke-width="4.5" stroke-dasharray="\${dashOpen} \${100 - dashOpen}" stroke-dashoffset="\${25 - dashClosed - dashTested}"></circle>\` : ''}
                    <text x="50%" y="52%" text-anchor="middle" fill="#F8FAFC" font-size="5" font-weight="700">\${totalTasks}</text>
                </svg>
            \`;
        }
    }

    // Screenshot 4: Widget 3 - Team Status Table
    const teamTbody = document.getElementById('dashTeamStatusTbody');
    if (teamTbody) {
        if (liveUsersCache.length === 0) {
            teamTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:18px; color:var(--text-muted);">No teammates assigned yet.</td></tr>';
        } else {
            teamTbody.innerHTML = liveUsersCache.slice(0, 6).map(u => {
                const uName = u.name || u.user_name || u.email?.split('@')[0] || 'User';
                const initial = uName.charAt(0).toUpperCase();
                const uId = u.id || u.user_id;
                const userTasksCount = tasks.filter(t => {
                    const rawOwners = Array.isArray(t.owner_ids) ? t.owner_ids : (typeof t.owner_ids === 'string' ? JSON.parse(t.owner_ids || '[]') : []);
                    return rawOwners.includes(uId) || t.assignee_id === uId;
                }).length;
                const userIssuesCount = issues.filter(i => i.assignee_id === uId).length;

                return \`
                    <tr style="border-bottom:1px solid var(--border-subtle);">
                        <td style="padding:8px 14px; display:flex; align-items:center; gap:8px;">
                            <span style="width:24px; height:24px; border-radius:50%; background:#334155; color:#F8FAFC; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">\${initial}</span>
                            <span style="font-weight:500; color:var(--text-primary);">\${escapeHtml(uName)}</span>
                        </td>
                        <td style="padding:8px 14px; text-align:center; font-weight:600; color:var(--text-secondary);">\${userTasksCount}</td>
                        <td style="padding:8px 14px; text-align:center; font-weight:600; color:var(--text-secondary);">\${userIssuesCount}</td>
                    </tr>
                \`;
            }).join('');
        }
    }

    // Screenshot 4: Widget 4 - Issues Status
    const openIssuesCount = issues.filter(i => !i.is_closed).length;
    const issuesCountDisplay = document.getElementById('dashIssuesCountDisplay');
    if (issuesCountDisplay) issuesCountDisplay.textContent = openIssuesCount;

    // Legacy My Tasks Widget
    const myTasksContainer = document.getElementById('widgetMyTasksList');
    const myTasks = tasks.slice(0, 5);
    if (myTasksContainer) {
        myTasksContainer.innerHTML = myTasks.length === 0
            ? '<div class="widget-empty-state" style="padding:24px; text-align:center; color:var(--text-secondary); font-size:12px;">No tasks assigned to you.</div>'
            : myTasks.map(t => {
                const currentProj = allProjectsCache.find(p => p.id === (t.projectId || currentProjectId));
                const projName = currentProj ? currentProj.name : 'Project Task';
                const dateStr = t.end_date ? t.end_date.split('T')[0] : (t.start_date ? t.start_date.split('T')[0] : '2026-10-31');
                return \`
                    <div class="widget-task-item" data-task-id="\${t.id}" style="cursor:pointer; padding:10px 14px; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:600; font-size:12.5px; color:var(--text-primary);">\${escapeHtml(t.name)}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">\${escapeHtml(projName)}</div>
                        </div>
                        <span style="color:\${t.is_completed ? '#22C55E' : '#EF4444'}; font-size:11.5px; font-weight:600;">\${dateStr}</span>
                    </div>
                \`;
            }).join('');
    }
`;

// Replace renderDashboardWidgets
const renderTarget = 'function renderDashboardWidgets(globalData, tasks, issues) {';
const renderEnd = 'myTasksContainer.querySelectorAll(\'.widget-task-item\').forEach(el => {\n            el.addEventListener(\'click\', () => openTaskDrawer(el.getAttribute(\'data-task-id\')));\n        });\n    }';

if (appJs.includes(renderTarget)) {
    // Find index of renderTarget and replace through the end of old renderDashboardWidgets
    const startIdx = appJs.indexOf(renderTarget);
    const endTarget = 'function renderMilestonesRoadmap(phases) {';
    const endIdx = appJs.indexOf(endTarget);
    if (startIdx !== -1 && endIdx !== -1) {
        appJs = appJs.substring(0, startIdx) + helperMethods + '\n' + newRenderWidgets + '\n}\n\n' + appJs.substring(endIdx);
        console.log('✓ Successfully replaced renderDashboardWidgets in app.js');
    }
}

fs.writeFileSync('src/public/app.js', isCrlf ? appJs.replace(/\n/g, '\r\n') : appJs, 'utf8');
console.log('Finished updating src/public/app.js');

