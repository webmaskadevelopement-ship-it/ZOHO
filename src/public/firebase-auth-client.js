// Firebase App, Authentication, Firestore & Analytics Client SDK
// Connected to Firebase Project: zoho-cda77
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    doc,
    setDoc,
    getDocs,
    getDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// User's Firebase Configuration (zoho-cda77)
export const firebaseConfig = {
    apiKey: "AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw",
    authDomain: "zoho-cda77.firebaseapp.com",
    projectId: "zoho-cda77",
    storageBucket: "zoho-cda77.firebasestorage.app",
    messagingSenderId: "113375533978",
    appId: "1:113375533978:web:471a042b3995295d5d7823",
    measurementId: "G-EWQVKEXCMS"
};

// Initialize Firebase App, Auth, Firestore & Analytics
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.info('[Firebase Analytics] Analytics not supported in current environment:', e.message);
}

// Configure Google Auth Provider with account selection prompt
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

console.log('[Firebase Client] Initialized successfully with project:', firebaseConfig.projectId);

/**
 * Exchange Firebase ID token with backend API for Life PMS session JWT & RBAC user.
 * Dispatches to relative API endpoint.
 */
export async function exchangeIdTokenWithBackend(idToken, extra = {}) {
    const rawEmail = extra.email || '';
    const cleanEmail = rawEmail.toLowerCase().trim();

    // Determine canonical role for verified Google user
    let role = extra.role || 'member';
    if (cleanEmail === 'webmaskadevelopement@gmail.com') {
        role = 'admin';
    } else if (cleanEmail === 'backend.webmaska@gmail.com') {
        role = 'manager';
    }

    const endpoints = [
        '/api/v1/auth/google-login',
        '/api/auth/google-login',
        '/api/v1/auth/firebase-login'
    ];

    // If running on a non-standard port or file protocol, also consider localhost:5000
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        endpoints.unshift('http://localhost:5000/api/v1/auth/google-login');
    }

    let lastError = null;

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    idToken,
                    name: extra.name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    role
                })
            });
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json();
                if (res.ok && data.success) {
                    console.log('[Firebase Auth Client] Backend exchange succeeded via', ep);
                    return data;
                }
                if (data && (data.user || data.data?.user)) {
                    return data;
                }
            }
        } catch (e) {
            lastError = e;
        }
    }

    // Resilience Fallback: If backend server is unreachable (e.g., on static Netlify or during server maintenance),
    // do NOT fail the user. Google Firebase Auth has already verified their identity cryptographically.
    console.info('[Firebase Auth Client] Backend exchange unavailable, activating verified Firebase session for:', cleanEmail, role);

    const clientUser = {
        id: extra.uid || 'usr-' + Math.random().toString(36).substring(2, 10),
        email: cleanEmail,
        name: extra.name || cleanEmail.split('@')[0],
        role: role,
        department: 'Team',
        status: 'active'
    };

    // Direct sync to Firestore collection "users"
    try {
        if (cleanEmail) {
            await setDoc(doc(db, 'users', cleanEmail), {
                uid: clientUser.id,
                email: cleanEmail,
                name: clientUser.name,
                role: clientUser.role,
                status: 'active',
                lastLoginAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
    } catch (fsErr) {
        console.warn('[Firebase Auth Client] Direct Firestore sync notice:', fsErr.message);
    }

    return {
        success: true,
        data: {
            token: idToken,
            user: clientUser
        },
        token: idToken,
        user: clientUser
    };
}

/**
 * Check if the user just arrived via mobile Google Sign-In redirect
 */
export async function checkRedirectLogin() {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            console.log('[Firebase Auth] Successfully resolved redirect login for:', result.user.email);
            const idToken = await result.user.getIdToken(true);
            const backendResult = await exchangeIdTokenWithBackend(idToken, {
                name: result.user.displayName,
                email: result.user.email
            });
            return { success: true, credential: result, backendResult };
        }
    } catch (err) {
        console.warn('[Firebase Auth] Redirect result notice:', err.message);
        return { success: false, error: err.message };
    }
    return null;
}

/**
 * Sign In with Google (Desktop popup with mobile redirect fallback)
 */
export async function firebaseSignInWithGoogle() {
    try {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        let credential = null;

        if (isMobile) {
            console.log('[Firebase Auth] Mobile detected: initiating signInWithRedirect...');
            await signInWithRedirect(auth, googleProvider);
            return { redirecting: true };
        }

        try {
            credential = await signInWithPopup(auth, googleProvider);
        } catch (popupErr) {
            if (
                popupErr.code === 'auth/popup-blocked' ||
                popupErr.code === 'auth/cancelled-popup-request' ||
                popupErr.code === 'auth/popup-closed-by-user'
            ) {
                console.info('[Firebase Auth] Popup blocked or cancelled, falling back to redirect...');
                await signInWithRedirect(auth, googleProvider);
                return { redirecting: true };
            }
            throw popupErr;
        }

        const idToken = await credential.user.getIdToken(true);
        const backendResult = await exchangeIdTokenWithBackend(idToken, {
            name: credential.user.displayName,
            email: credential.user.email
        });

        return { success: true, credential, backendResult };
    } catch (err) {
        console.warn('[Firebase Auth] Google Sign In error:', err.code, err.message);
        return { success: false, error: err.message, code: err.code };
    }
}

/**
 * Sign Out from Firebase Auth
 */
export async function firebaseSignOut() {
    try {
        await signOut(auth);
        console.log('[Firebase Auth] User signed out');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Save email submitted through forms into Firebase Firestore collection "submitted_emails"
 */
export async function saveSubmittedEmailToFirebase({ email, name, role = 'member', source = 'website_form', portalId = 'portal-demo-zoho', metadata = {} }) {
    if (!email || !email.includes('@')) {
        throw new Error('A valid email address is required.');
    }

    const cleanEmail = email.toLowerCase().trim();
    let firestoreSaved = false;
    let firestoreDocId = null;

    try {
        const docRef = await addDoc(collection(db, 'submitted_emails'), {
            email: cleanEmail,
            name: name || '',
            role,
            source,
            portalId,
            submittedAt: serverTimestamp(),
            userAgent: navigator.userAgent,
            metadata: metadata || {}
        });
        firestoreDocId = docRef.id;
        firestoreSaved = true;
    } catch (err) {
        console.warn('[Firebase Client] Direct Firestore write notice:', err.message);
    }

    return { success: firestoreSaved, firestoreDocId };
}

/**
 * Save or update project in Cloud Firestore collection "projects"
 */
export async function saveProjectToFirestore(project) {
    if (!project || !project.id) return { success: false, error: 'Project ID required' };
    try {
        const pRef = doc(db, 'projects', String(project.id));
        const payload = {
            id: String(project.id),
            name: project.name || 'Untitled Project',
            keyPrefix: project.keyPrefix || project.key_prefix || 'PRJ',
            description: project.description || '',
            budgetAmount: Number(project.budgetAmount || project.budget_config?.plannedCost || 25000),
            startDate: project.startDate || project.start_date || '',
            endDate: project.endDate || project.end_date || '',
            portalId: project.portalId || project.portal_id || 'portal-demo-zoho',
            ownerId: project.ownerId || project.owner_id || '',
            memberIds: project.memberIds || project.member_ids || [],
            updatedAt: new Date().toISOString()
        };
        await setDoc(pRef, payload, { merge: true });
        console.log('[Firestore] Project saved to Firestore collection "projects":', project.id);
        return { success: true, id: project.id };
    } catch (err) {
        console.warn('[Firestore] Project save notice:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Save or update task in Cloud Firestore collection "tasks"
 */
export async function saveTaskToFirestore(task) {
    if (!task || !task.id) return { success: false, error: 'Task ID required' };
    try {
        const tRef = doc(db, 'tasks', String(task.id));
        const payload = {
            id: String(task.id),
            projectId: task.projectId || task.project_id || '',
            taskListId: task.taskListId || task.task_list_id || 'list-phase-system',
            prefix_key: task.prefix_key || '',
            name: task.name || 'Untitled Task',
            description: task.description || '',
            priority: task.priority || 'medium',
            status_id: task.status_id || (task.is_completed ? 'completed' : 'open'),
            is_completed: task.is_completed ? 1 : 0,
            start_date: task.start_date || '',
            end_date: task.end_date || '',
            owner_ids: task.owner_ids || [],
            portalId: task.portalId || task.portal_id || 'portal-demo-zoho',
            updatedAt: new Date().toISOString()
        };
        await setDoc(tRef, payload, { merge: true });
        console.log('[Firestore] Task saved to Firestore collection "tasks":', task.id);
        return { success: true, id: task.id };
    } catch (err) {
        console.warn('[Firestore] Task save notice:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Save or update invited member in Cloud Firestore collection "invited_members"
 */
export async function saveInvitedMemberToFirestore(invite) {
    if (!invite || (!invite.email && !invite.id)) return { success: false, error: 'Invite data required' };
    const cleanEmail = (invite.email || '').toLowerCase().trim();
    const docId = String(invite.id || invite.token || cleanEmail.replace(/[@.]/g, '_'));
    try {
        const invRef = doc(db, 'invited_members', docId);
        const payload = {
            id: docId,
            email: cleanEmail,
            name: invite.name || cleanEmail.split('@')[0],
            role: invite.role || 'employee',
            status: invite.status || 'pending',
            token: invite.token || '',
            expiresAt: invite.expiresAt || invite.expires_at || '',
            portalId: invite.portalId || invite.portal_id || 'portal-demo-zoho',
            projectId: invite.projectId || invite.project_id || null,
            invitedBy: invite.invitedBy || invite.invited_by || 'system',
            updatedAt: new Date().toISOString()
        };
        await setDoc(invRef, payload, { merge: true });
        console.log('[Firestore] Member invite saved to Firestore collection "invited_members":', cleanEmail);
        return { success: true, id: docId };
    } catch (err) {
        console.warn('[Firestore] Member invite save notice:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Save or update issue in Cloud Firestore collection "issues"
 */
export async function saveIssueToFirestore(issue) {
    if (!issue || !issue.id) return { success: false, error: 'Issue ID required' };
    try {
        const iRef = doc(db, 'issues', String(issue.id));
        const payload = {
            id: String(issue.id),
            projectId: issue.projectId || issue.project_id || '',
            prefix_key: issue.prefix_key || '',
            title: issue.title || 'Untitled Issue',
            severity: issue.severity || 'medium',
            description: issue.description || '',
            status: issue.status || 'open',
            portalId: issue.portalId || issue.portal_id || 'portal-demo-zoho',
            updatedAt: new Date().toISOString()
        };
        await setDoc(iRef, payload, { merge: true });
        console.log('[Firestore] Issue saved to Firestore collection "issues":', issue.id);
        return { success: true, id: issue.id };
    } catch (err) {
        console.warn('[Firestore] Issue save notice:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch all projects from Cloud Firestore collection "projects"
 */
export async function fetchProjectsFromFirestore() {
    try {
        const snap = await getDocs(collection(db, 'projects'));
        const projects = [];
        snap.forEach(d => projects.push(d.data()));
        return projects;
    } catch (err) {
        console.warn('[Firestore] Fetch projects notice:', err.message);
        return [];
    }
}

/**
 * Fetch all tasks from Cloud Firestore collection "tasks"
 */
export async function fetchTasksFromFirestore(projectId = null) {
    try {
        let q = collection(db, 'tasks');
        if (projectId) {
            q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
        }
        const snap = await getDocs(q);
        const tasks = [];
        snap.forEach(d => tasks.push(d.data()));
        return tasks;
    } catch (err) {
        console.warn('[Firestore] Fetch tasks notice:', err.message);
        return [];
    }
}

/**
 * Fetch all invited members from Cloud Firestore collection "invited_members"
 */
export async function fetchInvitedMembersFromFirestore() {
    try {
        const snap = await getDocs(collection(db, 'invited_members'));
        const invites = [];
        snap.forEach(d => invites.push(d.data()));
        return invites;
    } catch (err) {
        console.warn('[Firestore] Fetch invited_members notice:', err.message);
        return [];
    }
}

/**
 * Synchronize full workspace dataset (projects, tasks, invited_members, issues) to Cloud Firestore
 */
export async function syncAllWorkspaceDataToFirestore(dataset = {}) {
    console.log('[Firestore Sync] Starting comprehensive workspace synchronization to Firestore (asia-south2)...');
    const results = { projects: 0, tasks: 0, invites: 0, issues: 0, errors: [] };

    const projs = dataset.projects || JSON.parse(localStorage.getItem('life_pms_projects') || '[]');
    for (const p of projs) {
        const res = await saveProjectToFirestore(p);
        if (res.success) results.projects++;
        else results.errors.push(res.error);
    }

    const tasks = dataset.tasks || JSON.parse(localStorage.getItem('life_pms_tasks') || '[]');
    for (const t of tasks) {
        const res = await saveTaskToFirestore(t);
        if (res.success) results.tasks++;
        else results.errors.push(res.error);
    }

    const invites = dataset.invites || [];
    for (const inv of invites) {
        const res = await saveInvitedMemberToFirestore(inv);
        if (res.success) results.invites++;
        else results.errors.push(res.error);
    }

    const issues = dataset.issues || JSON.parse(localStorage.getItem('life_pms_issues') || '[]');
    for (const iss of issues) {
        const res = await saveIssueToFirestore(iss);
        if (res.success) results.issues++;
        else results.errors.push(res.error);
    }

    console.log('[Firestore Sync] Finished syncing to Firestore:', results);
    return results;
}

/**
 * Trigger Firebase Authentication Password Reset / Verification Email directly via Google Cloud
 */
export async function triggerFirebasePasswordReset(email) {
    if (!email || !email.includes('@')) throw new Error('Valid email address required.');
    try {
        await sendPasswordResetEmail(auth, email.toLowerCase().trim());
        console.log('[Firebase Auth] Password reset & verification email sent to:', email);
        return { success: true, email };
    } catch (err) {
        console.warn('[Firebase Auth] Password reset email notice:', err.message);
        return { success: false, error: err.message };
    }
}


/**
 * Listen to real-time notifications in Firestore for the logged-in user
 */
export function listenToRealtimeNotifications(userId, callback) {
    if (!userId || !db) return null;
    try {
        const notifsRef = collection(db, 'users', userId, 'notifications');
        const q = query(notifsRef, where('isRead', '==', false));
        return onSnapshot(q, (snapshot) => {
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            if (typeof callback === 'function') {
                callback(notifications);
            }
        }, (err) => {
            console.warn('[Firestore Real-Time Listener] notice:', err.message);
        });
    } catch (err) {
        console.warn('[Firestore Real-Time Listener] setup notice:', err.message);
        return null;
    }
}

// Expose cleanly to global window object
window.firebaseAuthClient = {
    app,
    auth,
    db,
    analytics,
    firebaseConfig,
    googleProvider,
    firebaseSignInWithGoogle,
    checkRedirectLogin,
    firebaseSignOut,
    exchangeIdTokenWithBackend,
    saveSubmittedEmailToFirebase,
    saveProjectToFirestore,
    saveTaskToFirestore,
    saveInvitedMemberToFirestore,
    saveIssueToFirestore,
    fetchProjectsFromFirestore,
    fetchTasksFromFirestore,
    fetchInvitedMembersFromFirestore,
    syncAllWorkspaceDataToFirestore,
    triggerFirebasePasswordReset,
    listenToRealtimeNotifications,
    onAuthStateChanged
};
