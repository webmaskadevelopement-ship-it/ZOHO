const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'public', 'app.js');
let code = fs.readFileSync(targetPath, 'utf8');
const isCrlf = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

// 1. Add isUserProjectOwnerOrMemberClient after findPdfUserClient
const findPdfUserClientMarker = `function findPdfUserClient(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).toLowerCase().trim();
    return PDF_USERS_DIRECTORY_CLIENT.find(u =>
        u.id.toLowerCase() === clean ||
        u.uuid.toLowerCase() === clean ||
        u.slugId.toLowerCase() === clean ||
        u.email.toLowerCase() === clean ||
        u.username.toLowerCase() === clean ||
        u.name.toLowerCase() === clean
    );
}`;

const isUserProjectOwnerOrMemberClientCode = `

function isUserProjectOwnerOrMemberClient(proj, user) {
    if (!proj || !user) return false;
    const uId = String(user.id || user.userId || '').toLowerCase();
    const uEmail = String(user.email || '').toLowerCase().trim();
    const uName = String(user.username || '').toLowerCase().trim();

    const targetUser = findPdfUserClient(uId) || findPdfUserClient(uEmail) || findPdfUserClient(uName);
    const validIds = new Set([uId, uEmail, uName].filter(Boolean));
    if (targetUser) {
        validIds.add(targetUser.id.toLowerCase());
        validIds.add(targetUser.uuid.toLowerCase());
        validIds.add(targetUser.slugId.toLowerCase());
        validIds.add(targetUser.email.toLowerCase());
        validIds.add(targetUser.username.toLowerCase());
    }

    const pOwnerId = String(proj.owner_id || proj.ownerId || '').toLowerCase();
    const pOwnerEmail = String(proj.owner_email || proj.ownerEmail || '').toLowerCase();
    const pOwnerUser = String(proj.owner_username || proj.ownerUsername || '').toLowerCase();

    if (pOwnerId && validIds.has(pOwnerId)) return true;
    if (pOwnerEmail && validIds.has(pOwnerEmail)) return true;
    if (pOwnerUser && validIds.has(pOwnerUser)) return true;

    // Check members
    let members = [];
    try {
        members = Array.isArray(proj.member_ids) ? proj.member_ids : (Array.isArray(proj.memberIds) ? proj.memberIds : (typeof proj.member_ids === 'string' ? JSON.parse(proj.member_ids || '[]') : []));
    } catch (e) { members = []; }

    for (const m of members) {
        const mStr = String(m).toLowerCase();
        if (validIds.has(mStr)) return true;
        const mUser = findPdfUserClient(mStr);
        if (mUser && targetUser && mUser.id === targetUser.id) return true;
    }
    return false;
}`;

if (!code.includes(findPdfUserClientMarker)) {
    console.error('findPdfUserClientMarker not found in app.js');
    process.exit(1);
}
code = code.replace(findPdfUserClientMarker, findPdfUserClientMarker + isUserProjectOwnerOrMemberClientCode);

// 2. Update handleStaticApi projects filter
const staticProjectsFilterOld = `        if (currentUser && currentUser.role !== 'admin') {
            const myId = currentUser.id;
            const myEmail = currentUser.email;
            projs = projs.filter(p => {
                const isPublic = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                const isOwner = p.owner_id === myId || p.ownerId === myId || p.owner_email === myEmail;
                let members = [];
                try {
                    members = Array.isArray(p.member_ids) ? p.member_ids : (typeof p.member_ids === 'string' ? JSON.parse(p.member_ids || '[]') : []);
                } catch (e) { members = []; }
                const isMember = members.includes(myId) || members.includes(myEmail);
                return isPublic || isOwner || isMember;
            });
        }`;

const staticProjectsFilterNew = `        if (currentUser && currentUser.role !== 'admin') {
            projs = projs.filter(p => {
                const isPublic = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                if (isPublic) return true;
                return isUserProjectOwnerOrMemberClient(p, currentUser);
            });
        }`;

if (!code.includes(staticProjectsFilterOld)) {
    console.error('staticProjectsFilterOld not found in app.js');
    process.exit(1);
}
code = code.replace(staticProjectsFilterOld, staticProjectsFilterNew);

// 3. Update loadProjectsList filter
const loadProjectsListFilterOld = `        // Apply user scoping for non-admin users
        if (currentUser && currentUser.role !== 'admin') {
            const myId = currentUser.id;
            const myEmail = currentUser.email;
            merged = merged.filter(p => {
                const isPublic = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                const isOwner = p.owner_id === myId || p.ownerId === myId || p.owner_email === myEmail;
                let members = [];
                try {
                    members = Array.isArray(p.member_ids) ? p.member_ids : (typeof p.member_ids === 'string' ? JSON.parse(p.member_ids || '[]') : []);
                } catch (e) { members = []; }
                const isMember = members.includes(myId) || members.includes(myEmail);
                return isPublic || isOwner || isMember;
            });
        }`;

const loadProjectsListFilterNew = `        // Apply user scoping for non-admin users (Public vs Private visibility)
        if (currentUser && currentUser.role !== 'admin') {
            merged = merged.filter(p => {
                const isPublic = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                if (isPublic) return true; // Public projects visible to all registered users
                return isUserProjectOwnerOrMemberClient(p, currentUser); // Private projects strictly visible only to creator & members
            });
        }`;

if (!code.includes(loadProjectsListFilterOld)) {
    console.error('loadProjectsListFilterOld not found in app.js');
    process.exit(1);
}
code = code.replace(loadProjectsListFilterOld, loadProjectsListFilterNew);

// 4. Update loadTaskSheetView to save merged tasks to localStorage
const taskSheetCacheOld = `    allTasksCache = tasks;
    let taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data) && tlRes.data.length > 0) ? tlRes.data : allTaskListsCache;`;

const taskSheetCacheNew = `    allTasksCache = tasks;
    const otherTasks = localTasks.filter(t => t.projectId && t.projectId !== currentProjectId && t.project_id !== currentProjectId);
    localStorage.setItem('life_pms_tasks', JSON.stringify([...tasks, ...otherTasks]));
    let taskLists = (tlRes && tlRes.success && Array.isArray(tlRes.data) && tlRes.data.length > 0) ? tlRes.data : allTaskListsCache;`;

if (!code.includes(taskSheetCacheOld)) {
    console.error('taskSheetCacheOld not found in app.js');
    process.exit(1);
}
code = code.replace(taskSheetCacheOld, taskSheetCacheNew);

// 5. Update loadProjectIssues to save merged issues to localStorage
const issuesCacheOld = `    issues = Array.from(issueMap.values());
    allIssuesCache = issues;

    const tbody = document.getElementById('issuesSheetTbody');`;

const issuesCacheNew = `    issues = Array.from(issueMap.values());
    allIssuesCache = issues;
    const otherIssues = localIssues.filter(i => i.projectId && i.projectId !== currentProjectId && i.project_id !== currentProjectId);
    localStorage.setItem('life_pms_issues', JSON.stringify([...issues, ...otherIssues]));

    const tbody = document.getElementById('issuesSheetTbody');`;

if (!code.includes(issuesCacheOld)) {
    console.error('issuesCacheOld not found in app.js');
    process.exit(1);
}
code = code.replace(issuesCacheOld, issuesCacheNew);

fs.writeFileSync(targetPath, isCrlf ? code.replace(/\n/g, '\r\n') : code, 'utf8');
console.log('Successfully patched src/public/app.js with client-side visibility scoping and cross-device localStorage sync!');

