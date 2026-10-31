const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../src/public/index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Update sideNavApprovals
const oldSidebarNav = `<a href="#finance" class="sidebar-item" data-view="finance" id="sideNavApprovals">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>My Approvals</span>
                    </a>`;

const newSidebarNav = `<a href="#approvals" class="sidebar-item" data-view="approvals" id="sideNavApprovals">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span style="flex:1;">My Approvals</span>
                        <span class="badge-subtle badge-success" id="sidebarApprovalsCount" style="display:none; font-size:10px; padding:2px 6px;">0</span>
                    </a>`;

html = html.replace(/\r\n/g, '\n');
if (html.includes(oldSidebarNav.replace(/\r\n/g, '\n'))) {
    html = html.replace(oldSidebarNav.replace(/\r\n/g, '\n'), newSidebarNav.replace(/\r\n/g, '\n'));
    console.log('✓ Updated sideNavApprovals in index.html');
}

// 2. Insert view-my-approvals panel before view-collaboration
const targetBeforeCollab = `                <!-- VIEW 2.5: COLLABORATION (Exact Zoho Projects Screenshot 3 Parity) -->`;

const approvalsPanelHtml = `                <!-- VIEW 2.4: MY APPROVALS (Project Collaboration Invitations & Review) -->
                <div id="view-my-approvals" class="viewport-panel">
                    <div class="projects-page-header">
                        <div class="projects-header-left">
                            <h2 class="projects-main-title">My Approvals</h2>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                                Review project collaboration invitations, approval requests, and member access statuses.
                            </div>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button type="button" class="btn btn-outline btn-sm" id="btnRefreshApprovals" title="Refresh Approvals">🔄 Refresh</button>
                            <button type="button" class="btn btn-primary btn-sm" id="btnQuickInviteApprovals">+ Invite Collaborator</button>
                        </div>
                    </div>

                    <!-- Status Summary Stat Cards -->
                    <div class="stats-row-grid" style="grid-template-columns: repeat(4, 1fr); margin: 16px 0;">
                        <div class="stat-card" style="padding:14px;">
                            <span class="stat-label">Total Requests</span>
                            <div class="stat-value" id="approvalsTotalCount">0</div>
                        </div>
                        <div class="stat-card" style="padding:14px; border-left:3px solid #10B981;">
                            <span class="stat-label">Approved / Accepted</span>
                            <div class="stat-value" id="approvalsAcceptedCount" style="color:#10B981;">0</div>
                        </div>
                        <div class="stat-card" style="padding:14px; border-left:3px solid #F59E0B;">
                            <span class="stat-label">Pending Approval</span>
                            <div class="stat-value" id="approvalsPendingCount" style="color:#F59E0B;">0</div>
                        </div>
                        <div class="stat-card" style="padding:14px; border-left:3px solid #EF4444;">
                            <span class="stat-label">Rejected / Cancelled</span>
                            <div class="stat-value" id="approvalsRejectedCount" style="color:#EF4444;">0</div>
                        </div>
                    </div>

                    <!-- Filter Tabs / Chips -->
                    <div class="zoho-sub-toolbar" style="margin-bottom:12px;">
                        <div class="sub-toolbar-left">
                            <div class="view-chip-group" id="approvalsFilterGroup">
                                <button type="button" class="view-chip-btn active" data-approval-filter="all">All Approvals</button>
                                <button type="button" class="view-chip-btn" data-approval-filter="accepted">✓ Approved / Accepted</button>
                                <button type="button" class="view-chip-btn" data-approval-filter="pending">⏳ Pending</button>
                                <button type="button" class="view-chip-btn" data-approval-filter="rejected">✕ Rejected</button>
                            </div>
                        </div>
                    </div>

                    <!-- Data Table -->
                    <div class="sheet-table-wrapper">
                        <table class="tasks-sheet-table" id="approvalsTable">
                            <thead>
                                <tr>
                                    <th style="width:140px;">Request Type</th>
                                    <th>Target Project</th>
                                    <th>Invited By (Sender)</th>
                                    <th>Collaborator (Invitee)</th>
                                    <th style="width:120px;">Role</th>
                                    <th style="width:150px; text-align:center;">Status</th>
                                    <th style="width:130px;">Date</th>
                                    <th style="width:130px; text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="approvalsTableTbody">
                                <tr>
                                    <td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">
                                        Loading project collaboration approvals...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- VIEW 2.5: COLLABORATION (Exact Zoho Projects Screenshot 3 Parity) -->`;

if (!html.includes('id="view-my-approvals"')) {
    html = html.replace(targetBeforeCollab, approvalsPanelHtml);
    console.log('✓ Inserted view-my-approvals panel into index.html');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Done updating index.html.');

