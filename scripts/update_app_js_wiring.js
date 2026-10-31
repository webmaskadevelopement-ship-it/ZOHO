const fs = require('fs');

let appJs = fs.readFileSync('src/public/app.js', 'utf8');
const isCrlf = appJs.includes('\r\n');
if (isCrlf) {
    appJs = appJs.replace(/\r\n/g, '\n');
}

// 1. Update openNewProjectFlow to pre-select currentUser and fill custom input
const oldOpenFlow = `    // Populate Owner select dynamically with genuine users
    const ownerSelect = document.getElementById('createProjOwner');
    if (ownerSelect) {
        populateUserSelect(ownerSelect, currentUser?.id);
    }`;

const newOpenFlow = `    // Populate Owner select dynamically with genuine users
    const ownerSelect = document.getElementById('createProjOwner');
    if (ownerSelect) {
        populateUserSelect(ownerSelect, currentUser?.id);
        if (currentUser?.id && ownerSelect.querySelector('option[value="' + currentUser.id + '"]')) {
            ownerSelect.value = currentUser.id;
        }
    }
    const customOwnerInput = document.getElementById('createProjOwnerCustom');
    if (customOwnerInput) {
        customOwnerInput.value = currentUser?.name ? (currentUser.name + ' (@' + (currentUser.username || currentUser.email.split('@')[0]) + ')') : '';
    }`;

if (appJs.includes(oldOpenFlow)) {
    appJs = appJs.replace(oldOpenFlow, newOpenFlow);
    console.log('✓ Updated openNewProjectFlow');
}

// 2. Support custom owner in formModalCreateProject
const oldOwnerRead = `        const name = nameInput?.value.trim();
        const keyPrefix = prefixInput?.value.trim() || 'WE-';
        const ownerId = ownerSelect?.value || currentUser?.id;`;

const newOwnerRead = `        const name = nameInput?.value.trim();
        const keyPrefix = prefixInput?.value.trim() || 'WE-';
        const customOwner = document.getElementById('createProjOwnerCustom')?.value?.trim();
        let ownerId = ownerSelect?.value || currentUser?.id;
        if (customOwner) {
            const matched = liveUsersCache.find(u =>
                (u.username && customOwner.toLowerCase().includes(u.username.toLowerCase())) ||
                (u.name && customOwner.toLowerCase().includes(u.name.toLowerCase())) ||
                (u.email && customOwner.toLowerCase().includes(u.email.toLowerCase()))
            );
            if (matched) ownerId = matched.id || matched.user_id;
        }`;

if (appJs.includes(oldOwnerRead)) {
    appJs = appJs.replace(oldOwnerRead, newOwnerRead);
    console.log('✓ Updated ownerId extraction');
}

// 3. Immediately select newly created project
const oldProjCreated = `            if (res.success && res.data) {
                closeModal('modalCreateProject');
                showToastNotification('✓ Project created successfully!', 'success');
                await loadProjectsList();
                if (res.data.id) {
                    selectProject(res.data.id);
                }
            }`;

const newProjCreated = `            if (res.success && res.data) {
                closeModal('modalCreateProject');
                showToastNotification('✓ Project created successfully!', 'success');
                currentProjectId = res.data.id;
                sessionStorage.setItem('life_pms_project_id', currentProjectId);
                await loadProjectsList();
                selectProject(res.data.id);
                updateNavbarProjectName();
                await loadTaskSheetView();
                await loadGlobalDashboardStats();
            }`;

if (appJs.includes(oldProjCreated)) {
    appJs = appJs.replace(oldProjCreated, newProjCreated);
    console.log('✓ Updated project created handler');
}

// 4. Update loadTeamDirectory: display Username column & PDF authorized users
const oldTeamTbody = `    const tbody = document.getElementById('teamMembersTbody');
    if (tbody) {
        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No team members found. Click "+ Invite Users" to add collaborators.</td></tr>';
        } else {
            tbody.innerHTML = members.map(m => \`
                <tr>
                    <td><strong>\${escapeHtml(m.name || 'Team Member')}</strong></td>
                    <td style="color:var(--text-secondary);">\${escapeHtml(m.email || '')}</td>
                    <td><span class="badge-subtle badge-success">\${escapeHtml(m.role || 'Member')}</span></td>
                    <td>\${escapeHtml(m.department || 'Operations')}</td>
                    <td style="font-family:var(--font-mono); font-weight:600;">$\${m.cost_per_hour || 85}/hr</td>
                    <td><span style="color:#22C55E; font-size:11px;">● Active</span></td>
                    <td style="text-align:right;">
                        <button class="btn btn-outline btn-sm btn-edit-role" data-user-id="\${m.id}" data-user-name="\${escapeHtml(m.name || '')}" data-user-email="\${escapeHtml(m.email || '')}" data-user-role="\${m.role || 'employee'}" data-user-cost="\${m.cost_per_hour || 85}">Edit Role</button>
                    </td>
                </tr>
            \`).join('');
        }
    }`;

const newTeamTbody = `    const tbody = document.getElementById('teamMembersTbody');
    if (tbody) {
        const pdfAuthorized = [
            'ravi.bhadoria', 'ananya.gupta', 'ineet', 'nikhil', 'ritika',
            'shweta', 'ekta', 'abhishek', 'prince', 'ali', 'admin', 'manager'
        ];
        const displayMembers = members.filter(m => {
            const uName = (m.username || '').toLowerCase();
            const uMail = (m.email || '').toLowerCase();
            return pdfAuthorized.some(a => uName === a || uMail.includes(a) || uMail.includes('webmaska'));
        });

        if (displayMembers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No authorized team members found.</td></tr>';
        } else {
            tbody.innerHTML = displayMembers.map(m => {
                const uName = m.username || (m.email ? m.email.split('@')[0] : 'user');
                return \`
                    <tr>
                        <td><strong>\${escapeHtml(m.name || 'Team Member')}</strong></td>
                        <td style="color:#38BDF8; font-weight:500;">@\${escapeHtml(uName)}</td>
                        <td style="color:var(--text-secondary);">\${escapeHtml(m.email || '')}</td>
                        <td><span class="badge-subtle badge-success">\${escapeHtml(m.role || 'Employee')}</span></td>
                        <td>\${escapeHtml(m.department || 'Engineering')}</td>
                        <td><span style="color:#22C55E; font-size:11px; font-weight:600;">● Active</span></td>
                        <td style="text-align:right; white-space:nowrap;">
                            <button type="button" class="btn btn-xs btn-primary" onclick="openInviteModalForMember('\${m.id}')" style="font-size:11px; padding:3px 8px; margin-right:4px;">+ Invite to Project</button>
                            <button class="btn btn-outline btn-sm btn-edit-role" data-user-id="\${m.id}" data-user-name="\${escapeHtml(m.name || '')}" data-user-email="\${escapeHtml(m.email || '')}" data-user-role="\${m.role || 'employee'}" data-user-cost="\${m.cost_per_hour || 85}">Edit</button>
                        </td>
                    </tr>
                \`;
            }).join('');
        }
    }`;

if (appJs.includes(oldTeamTbody)) {
    appJs = appJs.replace(oldTeamTbody, newTeamTbody);
    console.log('✓ Updated loadTeamDirectory');
}

// 5. Update setupAddIssueModal to handle project
const oldAddIssueFetch = `        const res = await apiFetch('/api/v1/issues', {
            method: 'POST',
            body: JSON.stringify({
                projectId: currentProjectId,
                title,
                severity,
                classification,
                description
            })
        });`;

const newAddIssueFetch = `        let projId = document.getElementById('newIssueProject')?.value || currentProjectId || (allProjectsCache[0]?.id);
        if (!projId) {
            try {
                const autoProj = await apiFetch('/api/v1/projects', {
                    method: 'POST',
                    body: JSON.stringify({ name: 'Workspace Main Project', keyPrefix: 'WE-01', isPublic: 1 })
                });
                if (autoProj.success && autoProj.data) {
                    allProjectsCache.push(autoProj.data);
                    projId = autoProj.data.id;
                    currentProjectId = projId;
                    sessionStorage.setItem('life_pms_project_id', currentProjectId);
                }
            } catch (err) {}
        }

        const res = await apiFetch('/api/v1/issues', {
            method: 'POST',
            body: JSON.stringify({
                projectId: projId,
                title,
                severity,
                classification,
                description
            })
        });`;

if (appJs.includes(oldAddIssueFetch)) {
    appJs = appJs.replace(oldAddIssueFetch, newAddIssueFetch);
    console.log('✓ Updated addIssue submit logic');
}

// 6. Update setupAddTaskModal to support project selector & auto project creation
const oldAddTaskFetch = `        const res = await apiFetch(\`/api/v1/tasks/project/\${currentProjectId}\`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                taskListId,
                note,
                priority,
                startDate,
                endDate,
                ownerIds: ownerId ? [ownerId] : []
            })
        });`;

const newAddTaskFetch = `        let projId = document.getElementById('newTaskProject')?.value || currentProjectId || (allProjectsCache[0]?.id);
        if (!projId) {
            try {
                const autoProj = await apiFetch('/api/v1/projects', {
                    method: 'POST',
                    body: JSON.stringify({ name: 'Workspace Main Project', keyPrefix: 'WE-01', isPublic: 1 })
                });
                if (autoProj.success && autoProj.data) {
                    allProjectsCache.push(autoProj.data);
                    projId = autoProj.data.id;
                    currentProjectId = projId;
                    sessionStorage.setItem('life_pms_project_id', currentProjectId);
                }
            } catch (err) {}
        }

        const res = await apiFetch(\`/api/v1/tasks/project/\${projId}\`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                taskListId: taskListId || null,
                note,
                priority,
                startDate,
                endDate,
                ownerIds: ownerId ? [ownerId] : []
            })
        });`;

if (appJs.includes(oldAddTaskFetch)) {
    appJs = appJs.replace(oldAddTaskFetch, newAddTaskFetch);
    console.log('✓ Updated addTask submit logic');
}

// 7. Update setupInviteMemberModal to send in-app project invitations
const oldInviteSetup = `function setupInviteMemberModal() {
    document.getElementById('btnInviteUsers')?.addEventListener('click', () => openModal('modalInviteMember'));
    document.getElementById('btnTeamInviteMemberModal')?.addEventListener('click', () => openModal('modalInviteMember'));

    document.querySelectorAll('[data-close="modalInviteMember"]').forEach(b => {
        b.addEventListener('click', () => closeModal('modalInviteMember'));
    });

    document.getElementById('formModalInviteMember')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('inviteName');
        const emailInput = document.getElementById('inviteEmail');
        const roleInput = document.getElementById('inviteRole');
        const submitBtn = document.getElementById('btnSubmitInviteMember');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const role = roleInput ? roleInput.value : 'employee';

        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            alert('Please enter a valid recipient email address.');
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending Invitation...';
        }

        try {
            // 1. Dual-write directly to Firebase Firestore collection "submitted_emails" and "invited_members"
            let fbNotice = '';
            if (window.firebaseAuthClient?.saveSubmittedEmailToFirebase) {
                try {
                    const fbRes = await window.firebaseAuthClient.saveSubmittedEmailToFirebase({
                        email,
                        name,
                        role,
                        source: 'invite_team_modal',
                        portalId: currentPortalId,
                        metadata: { invitedBy: currentUserEmail }
                    });
                    if (fbRes?.syncedToFirestore || fbRes?.success) {
                        fbNotice = '\\n✓ Record successfully saved to Firebase Firestore collections "invited_members" & "submitted_emails" (viewable in Firebase Console).';
                    }
                } catch (fbErr) {
                    console.warn('[Firebase] Dual-write notice:', fbErr.message);
                }
            }

            // 2. Dual-write to local SQLite database
            const res = await apiFetch('/api/v1/portals/invite', {
                method: 'POST',
                body: JSON.stringify({ email, name, role })
            });

            if (res.success) {
                const token = res.data?.token || 'temp-token';
                const shareableLink = \`\${window.location.origin}/login?token=\${token}&email=\${encodeURIComponent(email)}&name=\${encodeURIComponent(name)}&role=\${role}\`;

                closeModal('modalInviteMember');
                if (nameInput) nameInput.value = '';
                if (emailInput) emailInput.value = '';

                showInvitationSuccessModal({
                    email,
                    name,
                    role,
                    shareableLink,
                    fbNotice,
                    isRealSmtpConfigured: res.data?.emailDelivered || false
                });

                await loadTeamDirectory();
            } else {
                alert(res.error || 'Failed to send invitation.');
            }
        } catch (err) {
            alert('Invitation error: ' + err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Invitation';
            }
        }
    });
}`;

const newInviteSetup = `function openInviteModalForMember(userId) {
    populateInviteProjectModal(userId);
    openModal('modalInviteMember');
}
window.openInviteModalForMember = openInviteModalForMember;

function populateInviteProjectModal(preselectedUserId = null) {
    const projSelect = document.getElementById('inviteProjectSelect');
    if (projSelect) {
        if (allProjectsCache.length === 0) {
            projSelect.innerHTML = '<option value="" disabled selected>No projects created yet. Please create a project first.</option>';
        } else {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }
    }

    const memberSelect = document.getElementById('inviteMemberSelect');
    if (memberSelect && preselectedUserId) {
        memberSelect.value = preselectedUserId;
    }
}

function setupInviteMemberModal() {
    document.getElementById('btnInviteUsers')?.addEventListener('click', () => {
        populateInviteProjectModal();
        openModal('modalInviteMember');
    });
    document.getElementById('btnTeamInviteMemberModal')?.addEventListener('click', () => {
        populateInviteProjectModal();
        openModal('modalInviteMember');
    });

    document.querySelectorAll('[data-close="modalInviteMember"]').forEach(b => {
        b.addEventListener('click', () => closeModal('modalInviteMember'));
    });

    document.getElementById('formModalInviteMember')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projSelect = document.getElementById('inviteProjectSelect');
        const memberSelect = document.getElementById('inviteMemberSelect');
        const roleSelect = document.getElementById('inviteProjectRole');
        const messageInput = document.getElementById('inviteProjectMessage');
        const submitBtn = document.getElementById('btnSubmitInviteMember');

        const projectId = projSelect?.value;
        const receiverId = memberSelect?.value;
        const role = roleSelect?.value || 'employee';
        const message = messageInput?.value.trim() || 'Invited you to collaborate on this project in Life PMS.';

        if (!projectId) {
            alert('Please select a project to invite the member to.');
            return;
        }

        if (!receiverId) {
            alert('Please select an authorized team member from the list.');
            return;
        }

        const selectedOption = memberSelect.options[memberSelect.selectedIndex];
        const memberName = selectedOption ? selectedOption.text.split('(')[0].trim() : 'Team Member';
        const projName = projSelect.options[projSelect.selectedIndex]?.text || 'Project';

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending In-App Invite...';
        }

        try {
            const res = await apiFetch('/api/v1/requests', {
                method: 'POST',
                body: JSON.stringify({
                    receiver_id: receiverId,
                    request_type: 'PROJECT_INVITE',
                    target_entity_id: projectId,
                    payload: {
                        projectId,
                        projectName: projName,
                        role,
                        message,
                        inviterName: currentUser?.name || 'Administrator',
                        inviterEmail: currentUser?.email
                    }
                })
            });

            if (res.success) {
                closeModal('modalInviteMember');
                if (messageInput) messageInput.value = '';
                alert(\`✓ In-App Project Invitation successfully sent to \${memberName}!\\n\\nThey will receive it directly within their application account to Accept or Decline.\`);
            } else {
                alert(res.error || 'Failed to send invitation.');
            }
        } catch (err) {
            alert('Invitation error: ' + err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send In-App Invitation';
            }
        }
    });
}`;

if (appJs.includes(oldInviteSetup)) {
    appJs = appJs.replace(oldInviteSetup, newInviteSetup);
    console.log('✓ Successfully upgraded setupInviteMemberModal in app.js');
}

// 8. Also ensure populating project dropdowns when opening Add Task and Add Issue modals
const oldOpenTaskModal = `    openBtns.forEach(b => b?.addEventListener('click', async () => {
        const select = document.getElementById('newTaskListSelect');`;

const newOpenTaskModal = `    openBtns.forEach(b => b?.addEventListener('click', async () => {
        // Populate Projects Dropdown in modalAddTask
        const projSelect = document.getElementById('newTaskProject');
        if (projSelect) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }
        const select = document.getElementById('newTaskListSelect');`;

if (appJs.includes(oldOpenTaskModal)) {
    appJs = appJs.replace(oldOpenTaskModal, newOpenTaskModal);
    console.log('✓ Added project dropdown population on open modalAddTask');
}

const oldOpenIssueModal = `function setupAddIssueModal() {
    document.getElementById('btnReportIssueModalTrigger')?.addEventListener('click', () => openModal('modalAddIssue'));
    document.getElementById('btnHeaderAddIssueHome')?.addEventListener('click', () => openModal('modalAddIssue'));`;

const newOpenIssueModal = `function setupAddIssueModal() {
    function populateIssueProjects() {
        const projSelect = document.getElementById('newIssueProject');
        if (projSelect && allProjectsCache.length > 0) {
            projSelect.innerHTML = allProjectsCache.map(p =>
                \`<option value="\${p.id}" \${p.id === currentProjectId ? 'selected' : ''}>\${escapeHtml(p.name)}</option>\`
            ).join('');
        }
    }
    document.getElementById('btnReportIssueModalTrigger')?.addEventListener('click', () => { populateIssueProjects(); openModal('modalAddIssue'); });
    document.getElementById('btnHeaderAddIssueHome')?.addEventListener('click', () => { populateIssueProjects(); openModal('modalAddIssue'); });`;

if (appJs.includes(oldOpenIssueModal)) {
    appJs = appJs.replace(oldOpenIssueModal, newOpenIssueModal);
    console.log('✓ Added project dropdown population on open modalAddIssue');
}

fs.writeFileSync('src/public/app.js', isCrlf ? appJs.replace(/\n/g, '\r\n') : appJs, 'utf8');
console.log('=== FINISHED UPDATING src/public/app.js ===\n');
