const fs = require('fs');

console.log('=== APPLYING COMPREHENSIVE FIXES FOR ALL 6 USER REQUIREMENTS ===\n');

// =========================================================================
// 1. UPDATE src/modules/requests/requests.service.js
// =========================================================================
let reqService = fs.readFileSync('src/modules/requests/requests.service.js', 'utf8');

// Ensure PDF Whitelist check in createRequest
if (!reqService.includes('AUTHORIZED_PDF_IDENTIFIERS')) {
    const targetCheck = "if (!receiver) {\n            throw new Error('Target recipient could not be found by receiver_id, username, or email.');\n        }";
    const replacementCheck = `if (!receiver) {
            throw new Error('Target recipient could not be found by receiver_id, username, or email.');
        }

        // Security & Access Control: Enforce strict PDF credentials whitelist
        const AUTHORIZED_PDF_IDENTIFIERS = [
            'ravi.bhadoria', 'ravi.bhadoria@zoho.com',
            'ananya.gupta', 'ananya.gupta@zoho.com',
            'ineet', 'ineet@zoho.com',
            'nikhil', 'nikhil@zoho.com',
            'ritika', 'ritika@zoho.com',
            'shweta', 'shweta@zoho.com',
            'ekta', 'ekta@zoho.com',
            'abhishek', 'abhishek@zoho.com',
            'prince', 'prince@zoho.com',
            'ali', 'ali@zoho.com',
            'admin', 'webmaskadevelopement@gmail.com',
            'manager', 'backend.webmaska@gmail.com',
            'ritika.sharma', 'ritikasharma49527@gmail.com',
            'varun', 'varunvashisth028@gmail.com',
            'webmaskafilms', 'webmaskafilms@gmail.com'
        ];
        const rUser = (receiver.username || '').toLowerCase().trim();
        const rMail = (receiver.email || '').toLowerCase().trim();
        const isAuth = AUTHORIZED_PDF_IDENTIFIERS.includes(rUser) || AUTHORIZED_PDF_IDENTIFIERS.includes(rMail);
        if (!isAuth) {
            throw new Error('Security Policy: Invitations can only be sent to authorized team members listed in the specification.');
        }`;

    reqService = reqService.replace(targetCheck, replacementCheck);
    fs.writeFileSync('src/modules/requests/requests.service.js', reqService, 'utf8');
    console.log('✓ Updated requests.service.js with authorized PDF credentials whitelist');
} else {
    console.log('• requests.service.js already contains AUTHORIZED_PDF_IDENTIFIERS');
}

// =========================================================================
// 2. UPDATE src/public/index.html
// =========================================================================
let indexHtml = fs.readFileSync('src/public/index.html', 'utf8');
const isCrlf = indexHtml.includes('\r\n');
if (isCrlf) {
    indexHtml = indexHtml.replace(/\r\n/g, '\n');
}

// A. Update New Project Modal: Owner field (Select + Editable Datalist)
const oldOwnerField = `<div class="form-row">
                                <label>Owner <span class="required-asterisk">*</span></label>
                                <select id="createProjOwner" class="input-styled" required>
                                    <!-- Populated dynamically with genuine users -->
                                </select>
                            </div>`;

const newOwnerField = `<div class="form-row">
                                <label>Owner <span class="required-asterisk">*</span></label>
                                <div style="display:flex; gap:8px;">
                                    <select id="createProjOwner" class="input-styled" style="flex:1;">
                                        <option value="efac5612-9ff8-4f2a-884d-46ff5e470584">Ravi Bhadoria (@ravi.bhadoria)</option>
                                        <option value="cf3817b6-562e-4c65-9d17-b4eb1ada5cd8">Ananya Gupta (@ananya.gupta)</option>
                                        <option value="ce170463-92f6-4f03-b801-9b57b82e862f">Ineet (@ineet)</option>
                                        <option value="f6419896-0f5b-4c42-a0c1-587d9829d647">Nikhil (@nikhil)</option>
                                        <option value="2eb4f501-5197-41be-a232-0ecbdf4e91f8">Ritika (@ritika)</option>
                                        <option value="8df8b7cd-1563-4e2a-a7f4-552a69ed160e">Shweta (@shweta)</option>
                                        <option value="c5783c9c-172c-435a-840b-bb4a33f627f8">Ekta (@ekta)</option>
                                        <option value="b12a7c5d-4a90-40ad-b88f-16db239199b8">Abhishek (@abhishek)</option>
                                        <option value="f0ca2e5f-4528-4188-a00c-45e23a77c903">Prince (@prince)</option>
                                        <option value="324a1d25-0fe8-46b8-88c0-13a41fe93331">Ali (@ali)</option>
                                        <option value="d60fc0c9-63f9-4f36-8430-d0cf30b892ac">Nikhil Kaushik (@admin)</option>
                                        <option value="0e4352f0-b919-449a-b68a-2091efa145d4">Tushar (@manager)</option>
                                    </select>
                                    <input type="text" id="createProjOwnerCustom" class="input-styled" style="flex:1;" placeholder="Or type custom owner..." list="ownersDatalist">
                                    <datalist id="ownersDatalist">
                                        <option value="Ravi Bhadoria (@ravi.bhadoria)">
                                        <option value="Ananya Gupta (@ananya.gupta)">
                                        <option value="Ineet (@ineet)">
                                        <option value="Nikhil (@nikhil)">
                                        <option value="Ritika (@ritika)">
                                        <option value="Shweta (@shweta)">
                                        <option value="Ekta (@ekta)">
                                        <option value="Abhishek (@abhishek)">
                                        <option value="Prince (@prince)">
                                        <option value="Ali (@ali)">
                                        <option value="Nikhil Kaushik (@admin)">
                                        <option value="Tushar (@manager)">
                                    </datalist>
                                </div>
                            </div>`;

if (indexHtml.includes(oldOwnerField)) {
    indexHtml = indexHtml.replace(oldOwnerField, newOwnerField);
    console.log('✓ Updated createProjOwner with select options and custom text input');
}

// B. Update Add Task Modal: Add Project Selector
const oldAddTaskFormStart = `<form id="formModalAddTask" class="modal-dialog-body">
                        <div class="form-row">
                            <label>Task Name *</label>
                            <input type="text" id="newTaskName" class="input-styled" required placeholder="e.g. Implement multi-tenant schema partitioning">
                        </div>`;

const newAddTaskFormStart = `<form id="formModalAddTask" class="modal-dialog-body">
                        <div class="form-row">
                            <label>Project <span class="required-asterisk">*</span></label>
                            <select id="newTaskProject" class="input-styled" required></select>
                        </div>
                        <div class="form-row">
                            <label>Task Name <span class="required-asterisk">*</span></label>
                            <input type="text" id="newTaskName" class="input-styled" required placeholder="e.g. Implement multi-tenant schema partitioning">
                        </div>`;

if (indexHtml.includes(oldAddTaskFormStart)) {
    indexHtml = indexHtml.replace(oldAddTaskFormStart, newAddTaskFormStart);
    console.log('✓ Added Project selector to modalAddTask in index.html');
}

// C. Update Add Issue Modal: Add Project Selector
const oldAddIssueFormStart = `<form id="formModalAddIssue" class="modal-dialog-body">
                        <div class="form-row">
                            <label>Issue Title *</label>
                            <input type="text" id="newIssueTitle" class="input-styled" required placeholder="e.g. Broken authentication redirect on mobile safari">
                        </div>`;

const newAddIssueFormStart = `<form id="formModalAddIssue" class="modal-dialog-body">
                        <div class="form-row">
                            <label>Project <span class="required-asterisk">*</span></label>
                            <select id="newIssueProject" class="input-styled" required></select>
                        </div>
                        <div class="form-row">
                            <label>Issue Title <span class="required-asterisk">*</span></label>
                            <input type="text" id="newIssueTitle" class="input-styled" required placeholder="e.g. Broken authentication redirect on mobile safari">
                        </div>`;

if (indexHtml.includes(oldAddIssueFormStart)) {
    indexHtml = indexHtml.replace(oldAddIssueFormStart, newAddIssueFormStart);
    console.log('✓ Added Project selector to modalAddIssue in index.html');
}

// D. Update Team Members Table Header: Include Username
const oldTeamTableHead = `<thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Department</th>
                                        <th>Hourly Rate</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>`;

const newTeamTableHead = `<thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Username</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Department</th>
                                        <th>Status</th>
                                        <th style="text-align:right;">Actions</th>
                                    </tr>
                                </thead>`;

if (indexHtml.includes(oldTeamTableHead)) {
    indexHtml = indexHtml.replace(oldTeamTableHead, newTeamTableHead);
    console.log('✓ Updated teamMembersTable header to include Username');
}

// E. Update modalInviteMember with in-app project invitation fields
const oldInviteModal = `<!-- MODAL: INVITE TEAM MEMBER -->
            <div id="modalInviteMember" class="modal-backdrop">
                <div class="modal-dialog">
                    <div class="modal-dialog-header">
                        <h3>Invite Team Member</h3>
                        <button class="btn-close-modal" data-close="modalInviteMember">✕</button>
                    </div>
                    <form id="formModalInviteMember" class="modal-dialog-body">
                        <div class="form-row">
                            <label>Full Name *</label>
                            <input type="text" id="inviteName" class="input-styled" required placeholder="e.g. Jordan Lee">
                        </div>
                        <div class="form-row">
                            <label>Email Address *</label>
                            <input type="email" id="inviteEmail" class="input-styled" required placeholder="name@company.com">
                        </div>
                        <div class="form-row">
                            <label>Workspace Role</label>
                            <select id="inviteRole" class="input-styled">
                                <option value="employee" selected>Employee (Dev / QA / Designer)</option>
                                <option value="manager">Project Manager (PM)</option>
                                <option value="client">Client (External Stakeholder)</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                        <div class="modal-dialog-footer">
                            <button type="button" class="btn btn-outline" data-close="modalInviteMember">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="btnSubmitInviteMember">Send Invitation</button>
                        </div>
                    </form>
                </div>
            </div>`;

const newInviteModal = `<!-- MODAL: INVITE MEMBER TO PROJECT (IN-APP COLLABORATION WORKFLOW) -->
            <div id="modalInviteMember" class="modal-backdrop">
                <div class="modal-dialog" style="max-width:520px;">
                    <div class="modal-dialog-header">
                        <div>
                            <h3 style="font-size:16px; font-weight:700; color:var(--text-primary); margin:0;">Invite Member to Project</h3>
                            <p style="font-size:12px; color:var(--text-muted); margin:4px 0 0 0;">
                                Send an in-app project collaboration invitation. The invited employee will receive it directly within their app account to accept or reject.
                            </p>
                        </div>
                        <button class="btn-close-modal" data-close="modalInviteMember">✕</button>
                    </div>
                    <form id="formModalInviteMember" class="modal-dialog-body" style="padding:18px 24px;">
                        <!-- Project Selection -->
                        <div class="form-row" style="margin-bottom:14px;">
                            <label style="font-size:12.5px; font-weight:600; color:var(--text-primary); margin-bottom:6px; display:block;">Target Project <span class="required-asterisk">*</span></label>
                            <select id="inviteProjectSelect" class="input-styled" required style="width:100%;">
                                <!-- Dynamically populated with active projects -->
                            </select>
                            <span style="font-size:11px; color:var(--text-muted); margin-top:3px; display:block;">Select the project to which this employee will be granted collaboration access.</span>
                        </div>

                        <!-- Authorized Member Selection (From PDF only) -->
                        <div class="form-row" style="margin-bottom:14px;">
                            <label style="font-size:12.5px; font-weight:600; color:var(--text-primary); margin-bottom:6px; display:block;">Authorized Team Member <span class="required-asterisk">*</span></label>
                            <select id="inviteMemberSelect" class="input-styled" required style="width:100%;">
                                <option value="" disabled selected>-- Select an authorized employee from PDF list --</option>
                                <option value="efac5612-9ff8-4f2a-884d-46ff5e470584" data-username="ravi.bhadoria" data-email="ravi.bhadoria@zoho.com">Ravi Bhadoria (@ravi.bhadoria — ravi.bhadoria@zoho.com)</option>
                                <option value="cf3817b6-562e-4c65-9d17-b4eb1ada5cd8" data-username="ananya.gupta" data-email="ananya.gupta@zoho.com">Ananya Gupta (@ananya.gupta — ananya.gupta@zoho.com)</option>
                                <option value="ce170463-92f6-4f03-b801-9b57b82e862f" data-username="ineet" data-email="ineet@zoho.com">Ineet (@ineet — ineet@zoho.com)</option>
                                <option value="f6419896-0f5b-4c42-a0c1-587d9829d647" data-username="nikhil" data-email="nikhil@zoho.com">Nikhil (@nikhil — nikhil@zoho.com)</option>
                                <option value="2eb4f501-5197-41be-a232-0ecbdf4e91f8" data-username="ritika" data-email="ritika@zoho.com">Ritika (@ritika — ritika@zoho.com)</option>
                                <option value="8df8b7cd-1563-4e2a-a7f4-552a69ed160e" data-username="shweta" data-email="shweta@zoho.com">Shweta (@shweta — shweta@zoho.com)</option>
                                <option value="c5783c9c-172c-435a-840b-bb4a33f627f8" data-username="ekta" data-email="ekta@zoho.com">Ekta (@ekta — ekta@zoho.com)</option>
                                <option value="b12a7c5d-4a90-40ad-b88f-16db239199b8" data-username="abhishek" data-email="abhishek@zoho.com">Abhishek (@abhishek — abhishek@zoho.com)</option>
                                <option value="f0ca2e5f-4528-4188-a00c-45e23a77c903" data-username="prince" data-email="prince@zoho.com">Prince (@prince — prince@zoho.com)</option>
                                <option value="324a1d25-0fe8-46b8-88c0-13a41fe93331" data-username="ali" data-email="ali@zoho.com">Ali (@ali — ali@zoho.com)</option>
                                <option value="0e4352f0-b919-449a-b68a-2091efa145d4" data-username="manager" data-email="backend.webmaska@gmail.com">Tushar (@manager — backend.webmaska@gmail.com)</option>
                                <option value="d60fc0c9-63f9-4f36-8430-d0cf30b892ac" data-username="admin" data-email="webmaskadevelopement@gmail.com">Nikhil Kaushik (@admin — webmaskadevelopement@gmail.com)</option>
                            </select>
                            <span style="font-size:11px; color:#10B981; margin-top:3px; display:block;">🔒 Restricted strictly to authorized credentials specified in the system specification.</span>
                        </div>

                        <!-- Role in Project -->
                        <div class="form-row" style="margin-bottom:14px;">
                            <label style="font-size:12.5px; font-weight:600; color:var(--text-primary); margin-bottom:6px; display:block;">Project Role</label>
                            <select id="inviteProjectRole" class="input-styled" style="width:100%;">
                                <option value="employee" selected>Collaborator / Contributor</option>
                                <option value="manager">Project Manager</option>
                                <option value="reviewer">Reviewer / QA</option>
                            </select>
                        </div>

                        <!-- Optional Message -->
                        <div class="form-row" style="margin-bottom:18px;">
                            <label style="font-size:12.5px; font-weight:600; color:var(--text-primary); margin-bottom:6px; display:block;">Invitation Message (Optional)</label>
                            <textarea id="inviteProjectMessage" class="input-styled" rows="2" placeholder="e.g. Please join this project to collaborate on WBS deliverables and milestones."></textarea>
                        </div>

                        <div class="modal-dialog-footer" style="display:flex; justify-content:flex-end; gap:8px;">
                            <button type="button" class="btn btn-outline" data-close="modalInviteMember">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="btnSubmitInviteMember" style="background:#0EA5E9; color:#fff; font-weight:600;">Send In-App Invitation</button>
                        </div>
                    </form>
                </div>
            </div>`;

if (indexHtml.includes(oldInviteModal)) {
    indexHtml = indexHtml.replace(oldInviteModal, newInviteModal);
    console.log('✓ Replaced modalInviteMember with updated In-App Project Invitation workflow');
}

fs.writeFileSync('src/public/index.html', isCrlf ? indexHtml.replace(/\n/g, '\r\n') : indexHtml, 'utf8');
console.log('✓ Successfully wrote changes to src/public/index.html');

