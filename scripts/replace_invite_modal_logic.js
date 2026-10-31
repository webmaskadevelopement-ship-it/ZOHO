const fs = require('fs');

let appJs = fs.readFileSync('src/public/app.js', 'utf8');
const isCrlf = appJs.includes('\r\n');
if (isCrlf) {
    appJs = appJs.replace(/\r\n/g, '\n');
}

const targetStart = 'function setupInviteMemberModal() {';
const targetEnd = 'function setupImportExportModal() {';

const startIdx = appJs.indexOf(targetStart);
const endIdx = appJs.indexOf(targetEnd);

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not locate indices for setupInviteMemberModal');
    process.exit(1);
}

const replacement = `function openInviteModalForMember(userId) {
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
}

`;

appJs = appJs.substring(0, startIdx) + replacement + appJs.substring(endIdx);
fs.writeFileSync('src/public/app.js', isCrlf ? appJs.replace(/\n/g, '\r\n') : appJs, 'utf8');
console.log('✓ Successfully replaced setupInviteMemberModal in src/public/app.js');

