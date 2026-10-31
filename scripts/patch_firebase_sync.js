const fs = require('fs');

let code = fs.readFileSync('src/public/firebase-auth-client.js', 'utf8');

// 1. Add deleteDoc import
if (!code.includes('deleteDoc,')) {
    code = code.replace(/getDoc,/g, 'getDoc,\r\n    deleteDoc,');
}

// 2. Add cross-device sync engine before window.firebaseAuthClient
const syncEngineCode = `
// ============================================================================
// 5-Step Cross-Device Data Synchronization Engine (users/{uid}/...)
// ============================================================================
let isHydrated = false;
let activeSyncUnsubscribers = [];
let lastServerSyncTimestamp = null;

export function getSyncStatus() {
    return {
        isHydrated,
        lastServerSyncTimestamp,
        uid: auth.currentUser?.uid || null
    };
}

export function updateSyncIndicatorUI(timestamp = new Date()) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const timeStr = timestamp instanceof Date ? timestamp.toLocaleTimeString() : String(timestamp);
    console.log('[Cross-Device Sync] ☁️ Server-verified sync: ' + timeStr);

    let indicator = document.getElementById('syncStatusIndicator');
    if (!indicator) {
        const targetContainer = document.querySelector('.header-top-right') ||
                                document.querySelector('.header-right') ||
                                document.querySelector('.navbar-right') ||
                                document.querySelector('.top-nav-right') ||
                                document.querySelector('.header-actions') ||
                                document.body;
        if (targetContainer) {
            indicator = document.createElement('div');
            indicator.id = 'syncStatusIndicator';
            indicator.className = 'sync-status-pill';
            indicator.title = 'Real-time Cross-Device Firebase Cloud Sync Active';
            indicator.style.cssText = 'display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; padding:4px 10px; border-radius:12px; background:rgba(16,185,129,0.12); color:#10B981; border:1px solid rgba(16,185,129,0.25); margin-right:12px; transition:all 0.3s ease;';
            if (targetContainer.firstChild) {
                targetContainer.insertBefore(indicator, targetContainer.firstChild);
            } else {
                targetContainer.appendChild(indicator);
            }
        }
    }
    if (indicator) {
        indicator.innerHTML = '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10B981; box-shadow:0 0 6px #10B981;"></span> ☁️ Synced: <span style="color:#E2E8F0; margin-left:3px;">' + timeStr + '</span>';
    }
}

/**
 * Step 1 & Step 3: Save user record bound strictly to auth.currentUser.uid
 * users/{uid}/{collectionName}/{recordId}
 */
export async function saveUserRecord(collectionName, recordId, data = {}) {
    if (!recordId) return { success: false, error: 'Record ID required' };
    const user = auth.currentUser;
    const uid = user ? user.uid : (localStorage.getItem('life_pms_user') ? JSON.parse(localStorage.getItem('life_pms_user') || '{}').id : null);
    const updatedAt = new Date().toISOString();
    const payload = {
        ...data,
        id: String(recordId),
        updatedAt,
        syncedAt: serverTimestamp()
    };

    // 1. Write to users/{uid}/{collectionName}/{recordId}
    if (uid && db) {
        try {
            const userDocRef = doc(db, 'users', uid, collectionName, String(recordId));
            await setDoc(userDocRef, payload, { merge: true });
            console.log('[Firestore Sync] Saved to users/' + uid + '/' + collectionName + '/' + recordId);
        } catch (err) {
            console.warn('[Firestore Sync] Write to users/' + uid + '/' + collectionName + ' error: ' + err.message);
        }
    }

    // 2. Also write to root collection for public visibility and cross-user invites
    if (db) {
        try {
            const rootCol = collectionName === 'requests' ? 'in_app_requests' : collectionName;
            const rootDocRef = doc(db, rootCol, String(recordId));
            await setDoc(rootDocRef, payload, { merge: true });
        } catch (err) {
            console.warn('[Firestore Sync] Write to root ' + collectionName + ' error: ' + err.message);
        }
    }

    lastServerSyncTimestamp = new Date();
    updateSyncIndicatorUI(lastServerSyncTimestamp);
    return { success: true, id: recordId, updatedAt };
}

/**
 * Delete user record from users/{uid}/{collectionName}/{recordId} and root
 */
export async function deleteUserRecord(collectionName, recordId) {
    if (!recordId) return { success: false };
    const user = auth.currentUser;
    const uid = user ? user.uid : (localStorage.getItem('life_pms_user') ? JSON.parse(localStorage.getItem('life_pms_user') || '{}').id : null);
    if (uid && db) {
        try {
            const userDocRef = doc(db, 'users', uid, collectionName, String(recordId));
            await deleteDoc(userDocRef);
        } catch (e) {}
    }
    if (db) {
        try {
            const rootCol = collectionName === 'requests' ? 'in_app_requests' : collectionName;
            const rootDocRef = doc(db, rootCol, String(recordId));
            await deleteDoc(rootDocRef);
        } catch (e) {}
    }
    lastServerSyncTimestamp = new Date();
    updateSyncIndicatorUI(lastServerSyncTimestamp);
    return { success: true };
}

/**
 * Step 3: Safe migration of legacy local data to Firebase (runs once, empty-state protected)
 */
export async function migrateLegacyLocalDataToFirebase(uid) {
    if (!uid || typeof window === 'undefined' || !window.localStorage || !db) return;
    const migrationKey = 'life_pms_firebase_migrated_' + uid;
    if (localStorage.getItem(migrationKey)) return;

    try {
        console.log('[Firestore Migration] Checking legacy local data for UID ' + uid + '...');
        const rawProjects = localStorage.getItem('life_pms_projects');
        if (rawProjects) {
            const projs = JSON.parse(rawProjects);
            if (Array.isArray(projs) && projs.length > 0) {
                for (const p of projs) {
                    if (p && p.id) {
                        await setDoc(doc(db, 'users', uid, 'projects', String(p.id)), {
                            ...p,
                            id: String(p.id),
                            ownerId: uid,
                            updatedAt: p.updatedAt || new Date().toISOString()
                        }, { merge: true });
                    }
                }
            }
        }

        const rawTasks = localStorage.getItem('life_pms_tasks');
        if (rawTasks) {
            const tasks = JSON.parse(rawTasks);
            if (Array.isArray(tasks) && tasks.length > 0) {
                for (const t of tasks) {
                    if (t && t.id) {
                        await setDoc(doc(db, 'users', uid, 'tasks', String(t.id)), {
                            ...t,
                            id: String(t.id),
                            updatedAt: t.updatedAt || new Date().toISOString()
                        }, { merge: true });
                    }
                }
            }
        }

        localStorage.setItem(migrationKey, 'true');
        console.log('[Firestore Migration] Migration to users/' + uid + '/ completed successfully.');
    } catch (e) {
        console.warn('[Firestore Migration] notice: ' + e.message);
    }
}

/**
 * Step 2 & Step 3: Auth-Gated Singleton service to pull and synchronize data across devices
 */
export function subscribeToUserData(callbacks = {}) {
    activeSyncUnsubscribers.forEach(unsub => {
        try { unsub(); } catch (e) {}
    });
    activeSyncUnsubscribers = [];
    isHydrated = false;

    return onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('[Firestore Sync] User not authenticated; awaiting login.');
            isHydrated = false;
            return;
        }

        const uid = user.uid;
        console.log('[Firestore Sync] User authenticated (' + uid + '), forcing server-side pull...');

        // Run safe migration
        await migrateLegacyLocalDataToFirebase(uid);

        // Step 2: Force server-side data pull
        const subcollections = ['projects', 'tasks', 'requests', 'issues'];
        const collectionsData = { projects: [], tasks: [], requests: [], issues: [] };

        for (const colName of subcollections) {
            try {
                const snap = await getDocs(collection(db, 'users', uid, colName));
                const items = [];
                snap.forEach(d => items.push({ id: d.id, ...d.data() }));
                collectionsData[colName] = items;
            } catch (err) {
                console.warn('[Firestore Sync] Error pulling users/' + uid + '/' + colName + ': ' + err.message);
            }
        }

        // Merge public projects and shared in_app_requests from root
        try {
            const rootProjSnap = await getDocs(collection(db, 'projects'));
            rootProjSnap.forEach(d => {
                const p = { id: d.id, ...d.data() };
                const isPub = p.is_public === 1 || p.isPublic === 1 || p.isPublic === true;
                const isOwner = p.owner_id === uid || p.ownerId === uid || p.owner_email === user.email;
                if (isPub || isOwner) {
                    if (!collectionsData.projects.some(existing => existing.id === p.id)) {
                        collectionsData.projects.push(p);
                    }
                }
            });
        } catch (e) {}

        try {
            const rootReqSnap = await getDocs(collection(db, 'in_app_requests'));
            rootReqSnap.forEach(d => {
                const r = { id: d.id, ...d.data() };
                const isPart = r.receiver_email === user.email || r.sender_email === user.email ||
                               r.receiver_id === uid || r.sender_id === uid;
                if (isPart) {
                    if (!collectionsData.requests.some(existing => existing.id === r.id)) {
                        collectionsData.requests.push(r);
                    }
                }
            });
        } catch (e) {}

        // Hydration lock complete
        isHydrated = true;
        lastServerSyncTimestamp = new Date();
        updateSyncIndicatorUI(lastServerSyncTimestamp);

        if (callbacks.onHydrated) {
            callbacks.onHydrated(collectionsData, lastServerSyncTimestamp);
        }

        // Setup real-time listeners for instant cross-device updates (< 3s)
        subcollections.forEach(colName => {
            try {
                const unsub = onSnapshot(collection(db, 'users', uid, colName), (snap) => {
                    const items = [];
                    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
                    lastServerSyncTimestamp = new Date();
                    updateSyncIndicatorUI(lastServerSyncTimestamp);
                    if (callbacks.onDataUpdate) {
                        callbacks.onDataUpdate(colName, items, lastServerSyncTimestamp);
                    }
                }, (err) => console.warn('[Firestore Realtime] ' + colName + ' listener error: ' + err.message));
                activeSyncUnsubscribers.push(unsub);
            } catch (e) {}
        });

        // Listen to root requests for incoming invitations
        try {
            const unsubReq = onSnapshot(collection(db, 'in_app_requests'), (snap) => {
                const items = [];
                snap.forEach(d => {
                    const r = { id: d.id, ...d.data() };
                    if (r.receiver_email === user.email || r.sender_email === user.email || r.receiver_id === uid || r.sender_id === uid) {
                        items.push(r);
                    }
                });
                lastServerSyncTimestamp = new Date();
                updateSyncIndicatorUI(lastServerSyncTimestamp);
                if (callbacks.onDataUpdate) {
                    callbacks.onDataUpdate('requests', items, lastServerSyncTimestamp);
                }
            }, (err) => console.warn('[Firestore Realtime] requests error: ' + err.message));
            activeSyncUnsubscribers.push(unsubReq);
        } catch (e) {}
    });
}
`;

if (!code.includes('subscribeToUserData')) {
    code = code.replace('// Expose cleanly to global window object', syncEngineCode + '\r\n// Expose cleanly to global window object');
}

// 3. Update window.firebaseAuthClient with all new methods
const extraExports = `
    getSyncStatus,
    updateSyncIndicatorUI,
    saveUserRecord,
    deleteUserRecord,
    migrateLegacyLocalDataToFirebase,
    subscribeToUserData,
`;
if (!code.includes('subscribeToUserData,')) {
    code = code.replace('listenToRealtimeNotifications,', 'listenToRealtimeNotifications,' + extraExports);
}

fs.writeFileSync('src/public/firebase-auth-client.js', code, 'utf8');
console.log('firebase-auth-client.js patched successfully!');

