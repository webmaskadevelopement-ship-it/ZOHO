const fs = require('fs');

let html = fs.readFileSync('src/public/index.html', 'utf8');
const isCrlf = html.includes('\r\n');
if (isCrlf) {
    html = html.replace(/\r\n/g, '\n');
}

const target = `<div class="dash-widgets-grid">
                        <div class="widget-box" id="widgetBoxMyTasks">`;

const replacement = `<div class="dash-widgets-grid" id="projectDashboardWidgetsGrid">
                        <!-- Widget 1: Task Status Donut Chart (Screenshot 4) -->
                        <div class="widget-box" id="widgetBoxTaskStatus">
                            <div class="widget-box-header">
                                <div>
                                    <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0;">Task Status</h3>
                                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;" id="dashTaskStatusSubtitle">Total: 0 Tasks</div>
                                </div>
                                <button type="button" class="widget-tool-icon" id="btnTaskStatusOptions" title="Widget Options">•••</button>
                            </div>
                            <div class="widget-body" style="padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:220px;">
                                <div id="dashTaskStatusChartContainer" style="width:160px; height:160px; position:relative; display:flex; align-items:center; justify-content:center;">
                                    <!-- Dynamic SVG Donut Chart -->
                                </div>
                                <div id="dashTaskStatusLegend" style="display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:14px; font-size:11.5px;">
                                    <span style="display:inline-flex; align-items:center; gap:5px; color:#EF4444;"><span style="width:8px; height:8px; border-radius:2px; background:#EF4444;"></span> Closed - <strong id="legendClosedCount">0</strong></span>
                                    <span style="display:inline-flex; align-items:center; gap:5px; color:#F97316;"><span style="width:8px; height:8px; border-radius:2px; background:#F97316;"></span> To be Tested - <strong id="legendTestedCount">0</strong></span>
                                    <span style="display:inline-flex; align-items:center; gap:5px; color:#22C55E;"><span style="width:8px; height:8px; border-radius:2px; background:#22C55E;"></span> Open - <strong id="legendOpenCount">0</strong></span>
                                </div>
                            </div>
                        </div>

                        <!-- Widget 2: Overdue Work Items (Screenshot 4) -->
                        <div class="widget-box" id="widgetBoxOverdueItems">
                            <div class="widget-box-header">
                                <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0;">Overdue Work Items</h3>
                                <button type="button" class="widget-tool-icon" title="Widget Options">•••</button>
                            </div>
                            <div class="widget-body" style="padding:24px 16px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:220px; text-align:center;">
                                <div class="overdue-smile-icon-wrap" style="margin-bottom:12px;">
                                    <svg width="68" height="68" viewBox="0 0 68 68" fill="none" style="opacity:0.85;">
                                        <!-- ground lines -->
                                        <line x1="14" y1="52" x2="54" y2="52" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
                                        <line x1="20" y1="57" x2="48" y2="57" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
                                        <!-- document outline -->
                                        <path d="M22 14h18l8 8v24a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" stroke="#64748B" stroke-width="2.2" fill="#1E293B"/>
                                        <!-- folded corner -->
                                        <path d="M40 14v8h8" stroke="#64748B" stroke-width="2.2"/>
                                        <!-- smile eyes and mouth -->
                                        <circle cx="28" cy="31" r="1.5" fill="#94A3B8"/>
                                        <circle cx="36" cy="31" r="1.5" fill="#94A3B8"/>
                                        <path d="M28 37c2 2.5 5 2.5 8 0" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
                                    </svg>
                                </div>
                                <div style="font-size:12.5px; color:#94A3B8; font-weight:500;">Good job! No overdue work item(s) for now.</div>
                            </div>
                        </div>

                        <!-- Widget 3: Team Status Table (Screenshot 4) -->
                        <div class="widget-box" id="widgetBoxTeamStatus">
                            <div class="widget-box-header">
                                <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0;">Team Status</h3>
                                <button type="button" class="widget-tool-icon" title="Widget Options">•••</button>
                            </div>
                            <div class="widget-body" style="padding:0; overflow-x:auto;">
                                <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                                    <thead>
                                        <tr style="border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                                            <th style="padding:10px 14px;">Users</th>
                                            <th style="padding:10px 14px; text-align:center;">Tasks</th>
                                            <th style="padding:10px 14px; text-align:center;">Issues</th>
                                        </tr>
                                    </thead>
                                    <tbody id="dashTeamStatusTbody">
                                        <!-- Populated dynamically -->
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Widget 4: Issues Status (Screenshot 4) -->
                        <div class="widget-box" id="widgetBoxIssuesStatus">
                            <div class="widget-box-header">
                                <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0;">Issues Status</h3>
                                <button type="button" class="widget-tool-icon" title="Widget Options">•••</button>
                            </div>
                            <div class="widget-body" style="padding:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:180px;">
                                <div id="dashIssuesStatusContainer" style="text-align:center; color:var(--text-secondary); font-size:12.5px;">
                                    <div style="font-size:24px; font-weight:700; color:var(--text-primary); margin-bottom:4px;" id="dashIssuesCountDisplay">0</div>
                                    <div>Open Issues in Workspace</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Additional Collapsible Section -->
                    <div class="dash-widgets-grid" style="margin-top:16px; display:none;" id="dashLegacyWidgetsSection">
                        <div class="widget-box" id="widgetBoxMyTasks">`;

if (html.includes(target)) {
    html = html.replace(target, replacement);
    fs.writeFileSync('src/public/index.html', isCrlf ? html.replace(/\n/g, '\r\n') : html, 'utf8');
    console.log('✓ Successfully injected Screenshot 4 Dashboard widgets into index.html');
} else {
    console.error('Target not found in index.html');
}
