const fs = require('fs');

let appJs = fs.readFileSync('src/public/app.js', 'utf8');
const isCrlf = appJs.includes('\r\n');
if (isCrlf) {
    appJs = appJs.replace(/\r\n/g, '\n');
}

const targetStart = 'async function loadTaskSheetView() {';
const targetEnd = 'tbody.querySelectorAll(\'.task-item-row\').forEach(row => {';

const enhancedLoadTaskSheet = `async function loadTaskSheetView() {
    const [res, tlRes] = await Promise.all([
        apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\${currentTasksFilter === 'my' ? '?my=true' : ''}\`),
        apiFetch(\`/api/v1/task-lists/project/\${currentProjectId}\`).catch(() => ({ success: false }))
    ]);
    const tasks = res.data || [];
    allTasksCache = tasks;
    const taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data)) ? tlRes.data : allTaskListsCache;
    allTaskListsCache = taskLists;

    const tbody = document.getElementById('taskSheetTbody');
    const totalCountEl = document.getElementById('taskSheetTotalCount');
    if (totalCountEl) totalCountEl.innerHTML = \`<span>Total Count : <strong style="color:var(--text-primary); margin-left:4px;">\${tasks.length}</strong></span>\`;

    if (!tbody) return;
    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 28px; color: var(--text-secondary);">No tasks configured yet. Click <strong>Add Task</strong> to create one.</td></tr>';
        return;
    }

    const currentProj = allProjectsCache.find(p => p.id === currentProjectId);
    const projName = currentProj ? currentProj.name : 'Project';

    function renderTaskRow(t) {
        const isCompleted = t.is_completed || t.status_id === 'completed' || t.status_id === 'closed';
        const isTesting = t.status_id === 'to_be_tested' || (t.tags && t.tags.includes('testing'));
        const statusLabel = isCompleted ? 'Closed' : (isTesting ? 'To be Tested' : (t.status_id === 'in_progress' ? 'In Progress' : 'Open'));
        const statusClass = isCompleted ? 'status-closed' : (isTesting ? 'status-to-be-tested' : (t.status_id === 'in_progress' ? 'status-progress' : 'status-open'));
        const taskId = t.id;
        const taskKey = t.prefix_key || ('RP1-T' + (t.sequence_number || 1));

        const rawOwners = Array.isArray(t.owner_ids) ? t.owner_ids : (typeof t.owner_ids === 'string' ? JSON.parse(t.owner_ids || '[]') : []);
        const firstOwnerId = t.assignee_id || (rawOwners.length > 0 ? rawOwners[0] : null);
        const owner = firstOwnerId ? getUserDisplay(firstOwnerId) : null;

        return \`
            <tr class="task-item-row" data-task-id="\${taskId}">
                <td><input type="checkbox" class="task-row-checkbox" \${isCompleted ? 'checked' : ''}></td>
                <td><span class="task-id-tag task-key-link" data-task-id="\${taskId}" style="cursor:pointer; font-weight:600;" title="Inspect Task">\${taskKey}</span></td>
                <td><a href="javascript:void(0)" class="task-name-link" data-task-id="\${taskId}" title="Open Task Details" style="font-weight:500;">\${escapeHtml(t.name)}</a></td>
                <td style="color:var(--text-secondary); font-size:12px;">\${escapeHtml(projName)}</td>
                <td class="owner-cell">
                    \${owner && owner.name !== 'Unassigned' ? \`<span class="owner-avatar-icon" style="background:#475569; color:#fff; font-size:10px;">\${owner.initials}</span><span style="font-size:12px;">\${owner.name}</span>\` : \`<span class="owner-avatar-icon unassigned"></span><span style="color:var(--text-muted); font-size:12px;">Unassigned</span>\`}
                </td>
                <td><span class="status-pill-zoho \${statusClass}">\${statusLabel}</span></td>
                <td style="color:var(--text-secondary); font-family:var(--font-mono); font-size:11.5px;">\${t.start_date ? t.start_date.split('T')[0] : '2026-10-31'}</td>
            </tr>
        \`;
    }

    if (taskLists.length > 0) {
        let fullHtml = '';
        taskLists.forEach(tl => {
            const listTasks = tasks.filter(t => t.task_list_id === tl.id);
            fullHtml += \`
                <tr class="tasklist-group-header-row" style="background:#181B20; border-bottom:1px solid #232730;">
                    <td colspan="7" style="padding:8px 12px;">
                        <div style="display:flex; align-items:center; justify-content:space-between;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size:10px; color:var(--text-muted);">▼</span>
                                <span style="font-size:12px; color:var(--text-muted);">☰</span>
                                <strong style="color:var(--text-primary); font-size:13px;">\${escapeHtml(tl.name)} (\${listTasks.length})</strong>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px; font-size:11.5px;">
                                <button type="button" class="btn-group-action" onclick="openAddTaskForList('\${tl.id}')" style="background:none; border:none; color:var(--theme-sky); cursor:pointer; font-size:11.5px;">+ Add Task</button>
                                <button type="button" class="btn-group-action" onclick="openAddTaskListModal()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:11.5px;">Add Task List</button>
                                <span style="color:var(--text-muted); font-size:11.5px; cursor:pointer;">💡 Suggestions</span>
                            </div>
                        </div>
                    </td>
                </tr>
            \`;
            if (listTasks.length > 0) {
                fullHtml += listTasks.map(renderTaskRow).join('');
            }
        });

        // Uncategorized tasks if any
        const uncatTasks = tasks.filter(t => !t.task_list_id || !taskLists.some(tl => tl.id === t.task_list_id));
        if (uncatTasks.length > 0) {
            fullHtml += \`
                <tr class="tasklist-group-header-row" style="background:#181B20; border-bottom:1px solid #232730;">
                    <td colspan="7" style="padding:8px 12px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:10px; color:var(--text-muted);">▼</span>
                            <span style="font-size:12px; color:var(--text-muted);">☰</span>
                            <strong style="color:var(--text-primary); font-size:13px;">General Tasks (\${uncatTasks.length})</strong>
                        </div>
                    </td>
                </tr>
            \`;
            fullHtml += uncatTasks.map(renderTaskRow).join('');
        }
        tbody.innerHTML = fullHtml;
    } else {
        tbody.innerHTML = tasks.map(renderTaskRow).join('');
    }
`;

const startIdx = appJs.indexOf(targetStart);
const endIdx = appJs.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    appJs = appJs.substring(0, startIdx) + enhancedLoadTaskSheet + '\n\n    ' + appJs.substring(endIdx);
    fs.writeFileSync('src/public/app.js', isCrlf ? appJs.replace(/\n/g, '\r\n') : appJs, 'utf8');
    console.log('✓ Successfully upgraded loadTaskSheetView with Task List grouping and Screenshot 2 styles');
} else {
    console.error('Target not found in app.js for loadTaskSheetView');
}

