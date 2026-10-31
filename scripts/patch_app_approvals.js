const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(appPath, 'utf8');

// 1. Update panelMap to include approvals
const oldPanelMap = `const panelMap = {
    'home': 'view-home',
    'projects': 'view-all-projects',
    'allprojects': 'view-all-projects',
    'collaboration': 'view-collaboration',`;

const newPanelMap = `const panelMap = {
    'home': 'view-home',
    'projects': 'view-all-projects',
    'allprojects': 'view-all-projects',
    'collaboration': 'view-collaboration',
    'approvals': 'view-my-approvals',`;

if (code.includes(oldPanelMap)) {
    code = code.replace(oldPanelMap, newPanelMap);
    console.log('✓ Updated panelMap with approvals');
}

// 2. Update isGlobalScope in switchActiveView
const oldGlobalScope = `const isGlobalScope = (viewName === 'home' || viewName === 'projects' || viewName === 'allprojects' || viewName === 'collaboration');`;
const newGlobalScope = `const isGlobalScope = (viewName === 'home' || viewName === 'projects' || viewName === 'allprojects' || viewName === 'collaboration' || viewName === 'approvals');`;

if (code.includes(oldGlobalScope)) {
    code = code.replace(oldGlobalScope, newGlobalScope);
    console.log('✓ Updated isGlobalScope in switchActiveView');
}

// 3. Update hash updating in switchActiveView
const oldHashCheck = `if (viewName === 'home' || viewName === 'projects' || viewName === 'collaboration') {`;
const newHashCheck = `if (viewName === 'home' || viewName === 'projects' || viewName === 'collaboration' || viewName === 'approvals') {`;

if (code.includes(oldHashCheck)) {
    code = code.replace(oldHashCheck, newHashCheck);
    console.log('✓ Updated hash check in switchActiveView');
}

// 4. Update loadPanelData to include case 'view-my-approvals'
const oldLoadPanel = `        case 'view-collaboration':
            await loadCollaborationView();
            break;`;

const newLoadPanel = `        case 'view-collaboration':
            await loadCollaborationView();
            break;
        case 'view-my-approvals':
            await loadApprovalsView();
            break;`;

if (code.includes(oldLoadPanel)) {
    code = code.replace(oldLoadPanel, newLoadPanel);
    console.log('✓ Added case view-my-approvals in loadPanelData');
}

// 5. Add setupApprovalsView() call in initApp
const oldInitTarget = `    setupInAppRequests();
    setupSignOut();`;

const newInitTarget = `    setupInAppRequests();
    setupApprovalsView();
    setupSignOut();`;

if (code.includes(oldInitTarget)) {
    code = code.replace(oldInitTarget, newInitTarget);
    console.log('✓ Added setupApprovalsView() in initApp');
}

// 6. Append Approvals Implementation functions before end of file
const approvalsLogic = `
/* ==========================================================================
   My Approvals View Implementation (Project Collaboration & Access Approvals)
   ========================================================================== */
let allApprovalsCache = [];
let currentApprovalsFilter = 'all';

function setupApprovalsView() {
    // Refresh button
    document.getElementById('btnRefreshApprovals')?.addEventListener('click', async () => {
        await loadApprovalsView();
    });

    // Quick Invite button opens invite modal
    document.getElementById('btnQuickInviteApprovals')?.addEventListener('click', () => {
        if (typeof populateInviteProjectModal === 'function') populateInviteProjectModal();
        openModal('modalInviteMember');
    });

    // Filter Chips
    const filterGroup = document.getElementById('approvalsFilterGroup');
    if (filterGroup) {
        filterGroup.querySelectorAll('.view-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filterGroup.querySelectorAll('.view-chip-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentApprovalsFilter = btn.getAttribute('data-approval-filter') || 'all';
                renderApprovalsTable();
            });
        });
    }
}

async function loadApprovalsView() {
    const tbody = document.getElementById('approvalsTableTbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">Loading collaboration approvals...</td></tr>';
    }

    try {
        const res = await apiFetch('/api/v1/requests/approvals');
        if (res.success && Array.isArray(res.data)) {
            allApprovalsCache = res.data;
        } else {
            allApprovalsCache = [];
        }
    } catch (err) {
        console.warn('[Approvals] Error fetching approvals:', err.message);
        // Fallback to local cache if present
        allApprovalsCache = JSON.parse(localStorage.getItem('life_pms_approvals') || '[]');
    }

    updateApprovalsCounters();
    renderApprovalsTable();
}

function updateApprovalsCounters() {
    const total = allApprovalsCache.length;
    const accepted = allApprovalsCache.filter(r => r.status === 'ACCEPTED' || r.status === 'APPROVED').length;
    const pending = allApprovalsCache.filter(r => r.status === 'PENDING').length;
    const rejected = allApprovalsCache.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED').length;

    const elTotal = document.getElementById('approvalsTotalCount');
    const elAccepted = document.getElementById('approvalsAcceptedCount');
    const elPending = document.getElementById('approvalsPendingCount');
    const elRejected = document.getElementById('approvalsRejectedCount');
    const elSidebarBadge = document.getElementById('sidebarApprovalsCount');

    if (elTotal) elTotal.textContent = total;
    if (elAccepted) elAccepted.textContent = accepted;
    if (elPending) elPending.textContent = pending;
    if (elRejected) elRejected.textContent = rejected;

    if (elSidebarBadge) {
        if (pending > 0) {
            elSidebarBadge.textContent = pending;
            elSidebarBadge.style.display = 'inline-block';
        } else {
            elSidebarBadge.style.display = 'none';
        }
    }
}

function renderApprovalsTable() {
    const tbody = document.getElementById('approvalsTableTbody');
    if (!tbody) return;

    let items = allApprovalsCache;
    if (currentApprovalsFilter === 'accepted') {
        items = allApprovalsCache.filter(r => r.status === 'ACCEPTED' || r.status === 'APPROVED');
    } else if (currentApprovalsFilter === 'pending') {
        items = allApprovalsCache.filter(r => r.status === 'PENDING');
    } else if (currentApprovalsFilter === 'rejected') {
        items = allApprovalsCache.filter(r => r.status === 'REJECTED' || r.status === 'CANCELLED');
    }

    if (items.length === 0) {
        tbody.innerHTML = \`
            <tr>
                <td colspan="8" style="text-align:center; padding:36px; color:var(--text-secondary);">
                    <div style="font-size:24px; margin-bottom:8px;">📁</div>
                    <div>No collaboration approvals found in this view.</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">When you invite team members or collaborate on projects, requests and their approval statuses will appear here.</div>
                </td>
            </tr>
        \`;
        return;
    }

    const currentUserId = currentUser ? currentUser.id : null;

    tbody.innerHTML = items.map(item => {
        const sender = item.sender || {};
        const receiver = item.receiver || {};
        const project = item.project || {};
        const isReceiver = currentUserId && (receiver.id === currentUserId || receiver.email === currentUser?.email);
        const isSender = currentUserId && (sender.id === currentUserId || sender.email === currentUser?.email);

        // Status badge
        let statusBadge = '';
        if (item.status === 'ACCEPTED' || item.status === 'APPROVED') {
            statusBadge = \`<span style="background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3); border-radius:4px; padding:3px 8px; font-weight:600; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><span>✓</span> Approved / Accepted</span>\`;
        } else if (item.status === 'PENDING') {
            statusBadge = \`<span style="background:rgba(245,158,11,0.15); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); border-radius:4px; padding:3px 8px; font-weight:600; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><span>⏳</span> Pending Approval</span>\`;
        } else if (item.status === 'REJECTED') {
            statusBadge = \`<span style="background:rgba(239,68,68,0.15); color:#EF4444; border:1px solid rgba(239,68,68,0.3); border-radius:4px; padding:3px 8px; font-weight:600; font-size:11px; display:inline-flex; align-items:center; gap:4px;"><span>✕</span> Rejected</span>\`;
        } else {
            statusBadge = \`<span class="badge-subtle">\${escapeHtml(item.status)}</span>\`;
        }

        // Action buttons
        let actionButtons = '';
        if (item.status === 'PENDING' && isReceiver) {
            actionButtons = \`
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button type="button" class="btn btn-xs btn-primary" onclick="handleApprovalsRespond('\${item.id}', 'ACCEPT')">Accept</button>
                    <button type="button" class="btn btn-xs btn-outline" onclick="handleApprovalsRespond('\${item.id}', 'REJECT')">Decline</button>
                </div>
            \`;
        } else if (item.status === 'PENDING' && isSender) {
            actionButtons = \`
                <div style="display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-xs btn-outline" style="color:#EF4444;" onclick="handleCancelApprovalRequest('\${item.id}')">Cancel</button>
                </div>
            \`;
        } else if (item.status === 'ACCEPTED' || item.status === 'APPROVED') {
            const targetProjId = project.id || item.target_entity_id;
            actionButtons = \`
                <div style="display:flex; justify-content:flex-end;">
                    <button type="button" class="btn btn-xs btn-outline" onclick="handleOpenApprovedProject('\${targetProjId}')">View Project &rarr;</button>
                </div>
            \`;
        } else {
            actionButtons = \`<span style="color:var(--text-muted); font-size:11px;">Completed</span>\`;
        }

        // Formatted Date
        const dateStr = item.responded_at || item.created_at;
        const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

        // Project display
        const projName = project.name || 'Project Workspace';
        const projPrefix = project.key_prefix ? \`<span style="font-size:10px; color:var(--text-muted); font-family:monospace;">\${escapeHtml(project.key_prefix)}</span> \` : '';

        return \`
            <tr id="approval-row-\${item.id}">
                <td>
                    <span class="badge-project" style="font-size:11px; padding:2px 8px;">Project Collaboration</span>
                </td>
                <td>
                    <div style="font-weight:600; color:var(--text-primary);">\${projPrefix}\${escapeHtml(projName)}</div>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="user-avatar-sm" style="width:24px; height:24px; font-size:10px; background:#1E293B; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#38BDF8; font-weight:bold;">
                            \${(sender.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-size:12px; font-weight:500;">\${escapeHtml(sender.name || 'Teammate')} \${isSender ? '<span style="color:var(--text-muted); font-size:10px;">(You)</span>' : ''}</div>
                            <div style="font-size:10px; color:var(--text-muted);">@\${escapeHtml(sender.username || sender.email?.split('@')[0] || '')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="user-avatar-sm" style="width:24px; height:24px; font-size:10px; background:#1E293B; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#10B981; font-weight:bold;">
                            \${(receiver.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-size:12px; font-weight:500;">\${escapeHtml(receiver.name || 'Collaborator')} \${isReceiver ? '<span style="color:var(--text-muted); font-size:10px;">(You)</span>' : ''}</div>
                            <div style="font-size:10px; color:var(--text-muted);">@\${escapeHtml(receiver.username || receiver.email?.split('@')[0] || '')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge-subtle" style="font-size:10px; text-transform:capitalize;">\${escapeHtml(item.role || 'Employee')}</span>
                </td>
                <td style="text-align:center;">
                    \${statusBadge}
                </td>
                <td style="font-size:12px; color:var(--text-secondary);">
                    \${formattedDate}
                </td>
                <td style="text-align:right;">
                    \${actionButtons}
                </td>
            </tr>
        \`;
    }).join('');
}

async function handleApprovalsRespond(requestId, action) {
    try {
        const res = await apiFetch(\`/api/v1/requests/\${requestId}/respond\`, {
            method: 'PATCH',
            body: JSON.stringify({ action })
        });

        if (res.success) {
            // Update local cache
            const item = allApprovalsCache.find(r => r.id === requestId);
            if (item) {
                item.status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
                item.responded_at = new Date().toISOString();
                item.is_approved = action === 'ACCEPT';
                item.approval_status = action === 'ACCEPT' ? 'Approved / Accepted' : 'Rejected';
            }

            // Sync project list so the newly accepted project is loaded into the user workspace
            if (action === 'ACCEPT') {
                if (typeof loadProjectsList === 'function') await loadProjectsList();
            }

            // Also refresh incoming requests badge
            if (typeof fetchIncomingRequests === 'function') await fetchIncomingRequests();

            updateApprovalsCounters();
            renderApprovalsTable();

            alert(\`✓ Request has been \${action === 'ACCEPT' ? 'Approved & Accepted' : 'Declined'}.\`);
        } else {
            alert(res.error || 'Failed to process request.');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}
window.handleApprovalsRespond = handleApprovalsRespond;

async function handleCancelApprovalRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this pending invitation?')) return;
    try {
        const res = await apiFetch(\`/api/v1/requests/\${requestId}\`, {
            method: 'DELETE'
        });
        if (res.success) {
            allApprovalsCache = allApprovalsCache.filter(r => r.id !== requestId);
            updateApprovalsCounters();
            renderApprovalsTable();
            alert('✓ Pending request cancelled.');
        } else {
            alert(res.error || 'Failed to cancel request.');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}
window.handleCancelApprovalRequest = handleCancelApprovalRequest;

function handleOpenApprovedProject(projectId) {
    if (!projectId) return;
    currentProjectId = projectId;
    sessionStorage.setItem('life_pms_project_id', projectId);
    switchActiveView('tasks');
}
window.handleOpenApprovedProject = handleOpenApprovedProject;
`;

// Append approvals logic
code += '\n' + approvalsLogic;

fs.writeFileSync(appPath, code, 'utf8');
console.log('✓ Successfully patched src/public/app.js with My Approvals logic');

