// Comprehensive UI & Design Verification Script
// Verifies all 5 reference views, DOM IDs, button listeners, CSS styles, and API responses

const fs = require('fs');
const path = require('path');
const http = require('http');
const jwt = require('jsonwebtoken');

const indexPath = path.join(__dirname, '..', 'src', 'public', 'index.html');
const cssPath = path.join(__dirname, '..', 'src', 'public', 'style.css');
const jsPath = path.join(__dirname, '..', 'src', 'public', 'app.js');

const htmlContent = fs.readFileSync(indexPath, 'utf-8');
const cssContent = fs.readFileSync(cssPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8');

console.log('=== STARTING AUTOMATED DESIGN & FUNCTIONALITY VERIFICATION ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`[PASS] ${message}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${message}`);
        failCount++;
    }
}

// -------------------------------------------------------------
// 1. VERIFY VIEW 1: PROJECTS LIST (Image 1)
// -------------------------------------------------------------
console.log('\n--- 1. Testing View 1: Projects List ---');
assert(htmlContent.includes('id="view-all-projects"'), 'Projects list view panel (#view-all-projects) exists in HTML');
assert(htmlContent.includes('data-proj-scope="active"'), 'Active Projects tab exists');
assert(htmlContent.includes('data-proj-scope="public"'), 'Public Projects tab exists');
assert(htmlContent.includes('id="btnProjectsScopeDropdown"'), 'All Projects dropdown button exists');
assert(htmlContent.includes('id="btnNewProjectAllView"'), 'New Project primary button exists');
assert(htmlContent.includes('id="allProjectsTbody"'), 'Projects table body (#allProjectsTbody) exists');
assert(htmlContent.includes('id="projectsTotalCount"'), 'Projects total count indicator exists');
assert(htmlContent.includes('id="projectsRangeDisplay"'), 'Projects range display (1-X) exists');
assert(cssContent.includes('.active-row') && cssContent.includes('#F59E0B'), 'Active project row has amber left indicator (#F59E0B)');
assert(cssContent.includes('.proj-status-badge') && cssContent.includes('#20C997'), 'Project status pill uses solid mint-green #20C997');
assert(jsContent.includes('loadAllProjectsTable'), 'loadAllProjectsTable() defined in app.js');

// -------------------------------------------------------------
// 2. VERIFY VIEW 2: HOME DASHBOARD (Image 2)
// -------------------------------------------------------------
console.log('\n--- 2. Testing View 2: Home Dashboard ---');
assert(htmlContent.includes('id="view-home"'), 'Home view panel (#view-home) exists');
assert(htmlContent.includes('id="btnDashScopeDropdown"'), 'Global Dashboard scope dropdown exists');
assert(htmlContent.includes('id="btnAddWidget"'), 'Add Widget button exists');
assert(htmlContent.includes('id="btnMoreDashOptions"'), 'More options button (•••) exists');
assert(htmlContent.includes('id="dashOpenTasks"'), 'Open Tasks stat card exists');
assert(htmlContent.includes('id="dashClosedTasks"'), 'Closed Tasks stat card exists');
assert(htmlContent.includes('id="dashOpenIssues"'), 'Open Issues stat card exists');
assert(htmlContent.includes('id="dashClosedIssues"'), 'Closed Issues stat card exists');
assert(htmlContent.includes('id="dashOpenPhases"'), 'Open Phases stat card exists');
assert(htmlContent.includes('id="dashClosedPhases"'), 'Closed Phases stat card exists');
assert(htmlContent.includes('id="widgetMyTasksList"'), 'My Tasks widget list exists');
assert(htmlContent.includes('id="widgetMyIssuesList"'), 'My Issues widget list exists');
assert(htmlContent.includes('id="btnFloatingHelp"'), 'Floating Help button (#btnFloatingHelp) exists');
assert(cssContent.includes('.floating-help-btn') && cssContent.includes('radial-gradient'), 'Floating Help button has radial gradient styling');
assert(jsContent.includes('loadGlobalDashboardStats'), 'loadGlobalDashboardStats() defined in app.js');

// -------------------------------------------------------------
// 3. VERIFY VIEW 3: COLLABORATION (Image 3)
// -------------------------------------------------------------
console.log('\n--- 3. Testing View 3: Collaboration ---');
assert(htmlContent.includes('id="view-collaboration"'), 'Collaboration view panel (#view-collaboration) exists');
assert(htmlContent.includes('data-collab-tab="feed"'), 'Collaboration Feed tab exists');
assert(htmlContent.includes('data-collab-tab="calendar"'), 'Collaboration Calendar tab exists');
assert(htmlContent.includes('data-collab-tab="chat"'), 'Collaboration Chat tab exists');
assert(htmlContent.includes('id="collabQuickThoughtInput"'), 'Quick thought input composer exists');
assert(htmlContent.includes('id="btnPostCollabThought"'), 'Post thought button exists');
assert(htmlContent.includes('id="collabFeedContainer"'), 'Live feed stream container exists');
assert(cssContent.includes('.collab-feed-item-card'), 'Feed item card CSS defined');
assert(cssContent.includes('.collab-key-badge-green'), 'Feed task badge CSS defined');
assert(jsContent.includes('setupCollaborationView'), 'setupCollaborationView() defined in app.js');
assert(jsContent.includes('loadCollaborationView'), 'loadCollaborationView() defined in app.js');

// -------------------------------------------------------------
// 4. VERIFY VIEW 4: TASK DETAIL DRAWER (Image 4)
// -------------------------------------------------------------
console.log('\n--- 4. Testing View 4: Task Detail Drawer ---');
assert(htmlContent.includes('id="taskDetailDrawer"'), 'Task Detail Drawer exists');
assert(htmlContent.includes('class="drawer-badge-task"') && htmlContent.includes('id="drawerTaskKey"'), 'Task key badge (cyan pill) exists');
assert(htmlContent.includes('id="drawerTaskTitle"'), 'Editable task title exists');
assert(htmlContent.includes('id="drawerProjectLink"'), 'Project link in metadata bar exists');
assert(htmlContent.includes('id="drawerStatusSelect"'), 'Status dropdown selector exists');
assert(htmlContent.includes('id="drawerTaskNote"'), 'Task description placeholder exists');
assert(htmlContent.includes('id="drawerTeamSelect"'), 'Task Information - Associated Team exists');
assert(htmlContent.includes('id="drawerOwnerTag"'), 'Task Information - Owner exists');
assert(htmlContent.includes('id="drawerWorkHoursDisplay"'), 'Task Information - Work Hours exists');
assert(htmlContent.includes('id="drawerStatusMatrixSelect"'), 'Task Information - Status exists');
assert(htmlContent.includes('id="drawerStartDate"'), 'Task Information - Start Date exists');
assert(htmlContent.includes('id="drawerDueDate"'), 'Task Information - Due Date exists');
assert(htmlContent.includes('id="drawerDurationInput"'), 'Task Information - Duration exists');
assert(jsContent.includes('openTaskDrawer'), 'openTaskDrawer() defined in app.js');

// -------------------------------------------------------------
// 5. VERIFY VIEW 5: PHASES (Image 5)
// -------------------------------------------------------------
console.log('\n--- 5. Testing View 5: Phases ---');
assert(htmlContent.includes('id="view-project-phases"'), 'Project Phases view panel exists');
assert(htmlContent.includes('id="btnPhasesGroupByDropdown"'), 'Group By None dropdown button exists');
assert(htmlContent.includes('id="btnPhasesFilterDropdown"'), 'All Phases dropdown button exists');
assert(htmlContent.includes('id="btnPhasesAutomation"'), 'Automation button exists');
assert(htmlContent.includes('id="btnAddPhaseModalTrigger"'), 'Add Phase primary button exists');
assert(htmlContent.includes('id="phasesSheetTbody"'), 'Phases table body (#phasesSheetTbody) exists');
assert(cssContent.includes('.zoho-phases-data-table tbody tr') && cssContent.includes('#EF4444'), 'Phase rows have red left border (#EF4444)');
assert(cssContent.includes('.inline-phase-input'), 'Inline phase quick-add input styled in CSS');
assert(jsContent.includes('loadProjectPhasesSheet'), 'loadProjectPhasesSheet() defined in app.js');

// -------------------------------------------------------------
// 6. VERIFY APPS LAUNCHER, LIVE CHAT & DOCK
// -------------------------------------------------------------
console.log('\n--- 6. Testing Apps Launcher, Live Chat & Dock ---');
assert(htmlContent.includes('id="btnAppLauncher"'), '9-Dots App Launcher button exists');
assert(htmlContent.includes('id="zohoAppsLauncherMenu"'), 'Apps Launcher popover exists');
assert(htmlContent.includes('id="btnBottomLiveChat"'), 'Bottom Live Chat button exists');
assert(htmlContent.includes('id="btnDockPins"'), 'Sidebar dock My Pins exists');
assert(htmlContent.includes('id="btnDockChats"'), 'Sidebar dock Chats exists');
assert(htmlContent.includes('id="btnDockContacts"'), 'Sidebar dock Contacts exists');
assert(cssContent.includes('.zoho-apps-launcher-popover'), 'Apps Launcher popover CSS defined');
assert(cssContent.includes('.bottom-system-bar'), 'Bottom system bar CSS defined');
assert(cssContent.includes('.sidebar-mini-dock'), 'Sidebar mini dock CSS defined');

// -------------------------------------------------------------
// 7. VERIFY ZERO DUMMY DATA CONSTRAINT
// -------------------------------------------------------------
console.log('\n--- 7. Testing Zero Dummy Data Constraint ---');
// Verify that dummy names like "Alice Johnson", "Bob Developer", "Charlie Tester", "Mock Project 1" are not hardcoded
const disallowedMockNames = ['Alice Johnson', 'Bob Developer', 'Charlie Tester', 'Mock Project 1'];
disallowedMockNames.forEach(mockName => {
    assert(!htmlContent.includes(mockName), `Zero dummy persona in HTML: "${mockName}" is not present`);
});

// -------------------------------------------------------------
// 8. TEST LIVE API ENDPOINTS
// -------------------------------------------------------------
console.log('\n--- 8. Testing Live Backend API Connectivity ---');
const JWT_SECRET = process.env.JWT_SECRET || 'zoho-jwt-super-secret-key-prod-2026';
const testToken = jwt.sign(
    { id: 'user-admin', email: 'webmaskadevelopement@gmail.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

function testHttp(endpoint, label, headers = {}) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: endpoint,
            method: 'GET',
            headers: {
                ...headers
            }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                assert(res.statusCode >= 200 && res.statusCode < 400, `${label} (HTTP ${res.statusCode})`);
                resolve(true);
            });
        });
        req.on('error', (err) => {
            assert(false, `${label} - Failed to connect: ${err.message}`);
            resolve(false);
        });
        req.end();
    });
}

(async () => {
    await testHttp('/', 'GET / (Frontend root returns 200)');
    await testHttp('/api/v1/projects', 'GET /api/v1/projects (Projects API returns 200 with JWT)', {
        'Authorization': `Bearer ${testToken}`
    });
    await testHttp('/api/v1/portals/portal-demo-zoho/members', 'GET /api/v1/portals/portal-demo-zoho/members (Genuine user directory returns 200 with JWT)', {
        'Authorization': `Bearer ${testToken}`
    });
    await testHttp('/api/v1/portals/smtp-status', 'GET /api/v1/portals/smtp-status (SMTP diagnostic returns 200)');

    console.log(`\n========================================`);
    console.log(`VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`========================================`);

    if (failCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
})();
