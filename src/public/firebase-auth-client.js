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
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    sendEmailVerification,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// User's Firebase Configuration
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

const googleProvider = new GoogleAuthProvider();

console.log('[Firebase Client] Initialized successfully with project:', firebaseConfig.projectId);

/**
 * Save email submitted through forms directly into Firebase Firestore collection "submitted_emails"
 * Dual-writes to client Firestore and backend sync service for 100% data persistence
 */
export async function saveSubmittedEmailToFirebase({ email, name, role = 'employee', source = 'website_form', portalId = 'portal-demo-zoho', metadata = {} }) {
    if (!email || !email.includes('@')) {
        throw new Error('A valid email address is required.');
    }

    const cleanEmail = email.toLowerCase().trim();
    let firestoreSaved = false;
    let firestoreDocId = null;
    let clientError = null;

    // 1. Direct Client-side Firestore write
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
        console.log('[Firebase Client] Directly stored email in Firestore collection "submitted_emails":', firestoreDocId);
    } catch (err) {
        clientError = err.message;
        console.warn('[Firebase Client] Direct Firestore write notice:', err.message);
    }

    // 2. Also dual-write via backend API to ensure server-side persistence & relay
    try {
        const res = await fetch('/api/v1/integrations/firebase/submit-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: cleanEmail,
                name,
                role,
                source,
                portalId,
                metadata: {
                    ...metadata,
                    firestoreDocId,
                    clientError
                }
            })
        });
        const result = await res.json();
        return {
            success: true,
            firestoreDocId: firestoreDocId || result.data?.firestoreDocId,
            syncedToFirestore: firestoreSaved || result.data?.syncedToFirestore,
            backendResult: result
        };
    } catch (err) {
        console.warn('[Firebase Client] Backend relay notice:', err.message);
        return {
            success: firestoreSaved,
            firestoreDocId,
            syncedToFirestore: firestoreSaved,
            notice: firestoreSaved ? 'Saved to Firestore' : err.message
        };
    }
}

/**
 * Exchange Firebase ID token with backend API for Life PMS session JWT & RBAC user
 */
export async function exchangeIdTokenWithBackend(idToken, extra = {}) {
    const res = await fetch('/api/v1/auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idToken,
            role: extra.role || 'employee',
            name: extra.name || ''
        })
    });
    return res.json();
}

/**
 * Sign In with Email & Password via Firebase Auth
 */
export async function firebaseSignIn(email, password) {
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = credential.user;

        // Firebase Auth email verification check
        if (!user.emailVerified) {
            console.warn('[Firebase Auth] Login blocked: Email not verified for', user.email);
            await signOut(auth);
            return {
                success: false,
                needsVerification: true,
                email: user.email,
                error: 'Check your email and verify, then log in'
            };
        }

        const idToken = await user.getIdToken();
        const backendResult = await exchangeIdTokenWithBackend(idToken);
        return { success: true, credential, backendResult };
    } catch (err) {
        console.warn('[Firebase Auth] Sign in error:', err.code, err.message);
        return { success: false, error: err.message, code: err.code };
    }
}

/**
 * Sign Up with Email, Password, Name & RBAC Role via Firebase Auth
 * Saves the registered email to Firestore collection "submitted_emails"
 */
export async function firebaseSignUp(email, password, name, role) {
    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const user = credential.user;

        // Save new user email to Firestore
        await saveSubmittedEmailToFirebase({
            email: user.email,
            name,
            role,
            source: 'firebase_auth_signup',
            metadata: { uid: user.uid }
        }).catch(e => console.warn('[Firebase] Sync on signup notice:', e));

        // Send verification email via Firebase Auth
        await sendEmailVerification(user);
        console.log('[Firebase Auth] Verification email sent to:', user.email);

        // Do not auto-login after sign up; sign out immediately
        await signOut(auth);

        return {
            success: true,
            needsVerification: true,
            email: user.email,
            message: 'Check your email and verify, then log in'
        };
    } catch (err) {
        console.warn('[Firebase Auth] Sign up error:', err.code, err.message);
        return { success: false, error: err.message, code: err.code };
    }
}

/**
 * Resend verification email via Firebase Auth
 */
export async function resendVerificationEmail(email, password) {
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const user = credential.user;
        if (!user.emailVerified) {
            await sendEmailVerification(user);
            console.log('[Firebase Auth] Verification email resent to:', user.email);
        }
        await signOut(auth);
        return { success: true, email: user.email };
    } catch (err) {
        console.warn('[Firebase Auth] Resend verification error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Sign In with Google Popup via Firebase Auth
 */
export async function firebaseSignInWithGoogle(role = 'employee') {
    try {
        const credential = await signInWithPopup(auth, googleProvider);
        const idToken = await credential.user.getIdToken();

        // Also record Google authenticated user in Firestore
        await saveSubmittedEmailToFirebase({
            email: credential.user.email,
            name: credential.user.displayName,
            role,
            source: 'google_signin_popup',
            metadata: { uid: credential.user.uid }
        }).catch(e => console.warn('[Firebase] Sync on google sign-in notice:', e));

        const backendResult = await exchangeIdTokenWithBackend(idToken, {
            name: credential.user.displayName,
            role
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

// Expose cleanly to global window object
window.firebaseAuthClient = {
    app,
    auth,
    db,
    analytics,
    firebaseConfig,
    saveSubmittedEmailToFirebase,
    firebaseSignIn,
    firebaseSignUp,
    resendVerificationEmail,
    firebaseSignInWithGoogle,
    firebaseSignOut,
    exchangeIdTokenWithBackend,
    onAuthStateChanged
};
