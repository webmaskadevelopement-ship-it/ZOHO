const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/public/firebase-auth-client.js');
let code = fs.readFileSync(targetPath, 'utf8');

const isCRLF = code.includes('\r\n');
code = code.replace(/\r\n/g, '\n');

const addition = `/**
 * Save In-App Request to Cloud Firestore collection "in_app_requests"
 */
export async function saveInAppRequestToFirestore(req) {
    if (!req || !req.id) return { success: false, error: 'Request ID required' };
    if (!db) return { success: false, error: 'Firestore not initialized' };
    try {
        const rRef = doc(db, 'in_app_requests', String(req.id));
        const payload = {
            id: String(req.id),
            sender_id: req.sender_id || req.sender?.id || '',
            receiver_id: req.receiver_id || req.receiver?.id || '',
            receiver_email: req.receiver_email || req.receiver?.email || req.payload?.receiverEmail || req.email || '',
            receiver_username: req.receiver_username || req.receiver?.username || req.payload?.receiverUsername || req.username || '',
            receiver_name: req.receiver_name || req.receiver?.name || req.payload?.receiverName || '',
            sender_name: req.sender_name || req.sender?.name || req.payload?.inviterName || '',
            sender_email: req.sender_email || req.sender?.email || req.payload?.inviterEmail || '',
            sender_username: req.sender_username || req.sender?.username || req.payload?.inviterUsername || '',
            request_type: req.request_type || 'PROJECT_INVITE',
            target_entity_id: req.target_entity_id || req.payload?.projectId || '',
            project_name: req.project_name || req.project?.name || req.payload?.projectName || '',
            project_prefix: req.project_prefix || req.project?.key_prefix || req.payload?.projectPrefix || '',
            payload: req.payload || {},
            status: req.status || 'PENDING',
            created_at: req.created_at || new Date().toISOString(),
            responded_at: req.responded_at || null,
            updatedAt: new Date().toISOString()
        };
        await setDoc(rRef, payload, { merge: true });
        console.log('[Firestore] In-App Request saved to Firestore collection "in_app_requests":', req.id);

        // Also add notification for receiver if accessible
        if (payload.receiver_id) {
            try {
                const notifRef = doc(db, 'users', payload.receiver_id, 'notifications', String(req.id));
                await setDoc(notifRef, {
                    id: String(req.id),
                    requestId: String(req.id),
                    type: payload.request_type,
                    title: \`Project Invitation: \${payload.project_name || 'Workspace'}\`,
                    message: payload.payload?.message || \`\${payload.sender_name} invited you to collaborate.\`,
                    senderName: payload.sender_name,
                    senderEmail: payload.sender_email,
                    isRead: false,
                    createdAt: payload.created_at
                }, { merge: true });
            } catch (nErr) {}
        }
        return { success: true, id: req.id };
    } catch (err) {
        console.warn('[Firestore] In-App Request save notice:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch all In-App Requests from Cloud Firestore collection "in_app_requests"
 */
export async function fetchInAppRequestsFromFirestore(user = null) {
    if (!db) return [];
    try {
        const snap = await getDocs(collection(db, 'in_app_requests'));
        const list = [];
        snap.forEach(d => list.push(d.data()));
        return list;
    } catch (err) {
        console.warn('[Firestore] Fetch in_app_requests notice:', err.message);
        return [];
    }
}

/**
 * Update In-App Request in Cloud Firestore (Accept / Reject)
 */
export async function updateInAppRequestInFirestore(requestId, updateData = {}) {
    if (!requestId || !db) return { success: false };
    try {
        const rRef = doc(db, 'in_app_requests', String(requestId));
        await setDoc(rRef, {
            ...updateData,
            responded_at: updateData.responded_at || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[Firestore] In-App Request updated in Firestore:', requestId);
        return { success: true };
    } catch (err) {
        console.warn('[Firestore] In-App Request update notice:', err.message);
        return { success: false, error: err.message };
    }
}

`;

if (!code.includes('saveInAppRequestToFirestore')) {
    code = code.replace('export function listenToRealtimeNotifications', addition + 'export function listenToRealtimeNotifications');
    
    code = code.replace(
        'saveIssueToFirestore,\n    fetchProjectsFromFirestore,',
        'saveIssueToFirestore,\n    saveInAppRequestToFirestore,\n    fetchInAppRequestsFromFirestore,\n    updateInAppRequestInFirestore,\n    fetchProjectsFromFirestore,'
    );
    console.log('✓ Added Firestore in-app request methods to firebase-auth-client.js');
}

if (isCRLF) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Done patching firebase-auth-client.js');
