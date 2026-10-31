const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/public/app.js');
let code = fs.readFileSync(file, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

const target = `            // If accepted, refresh active project or task views
            if (action === 'ACCEPT') {
                if (typeof loadProjectsList === 'function') await loadProjectsList();
                if (typeof loadCurrentTaskView === 'function') await loadCurrentTaskView();
            }`;

const replacement = `            // Update in local storage
            let localReqs = JSON.parse(localStorage.getItem('life_pms_in_app_requests') || '[]');
            const rIdx = localReqs.findIndex(r => r.id === requestId);
            if (rIdx !== -1) {
                localReqs[rIdx].status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
                localReqs[rIdx].responded_at = new Date().toISOString();
                localStorage.setItem('life_pms_in_app_requests', JSON.stringify(localReqs));
            }

            // Update in Cloud Firestore
            if (window.firebaseAuthClient?.updateInAppRequestInFirestore) {
                window.firebaseAuthClient.updateInAppRequestInFirestore(requestId, {
                    status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
                    responded_at: new Date().toISOString()
                }).catch(() => {});
            }

            // If accepted, refresh active project or task views
            if (action === 'ACCEPT') {
                if (typeof loadProjectsList === 'function') await loadProjectsList();
                if (typeof loadCurrentTaskView === 'function') await loadCurrentTaskView();
            }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    if (isCRLF) code = code.replace(/\n/g, '\r\n');
    fs.writeFileSync(file, code, 'utf8');
    console.log('✓ Patched handleRespondRequest');
} else {
    console.log('Target not found in app.js');
}
