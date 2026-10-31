const fs = require('fs');
const path = require('path');

const clientFile = path.join(__dirname, '..', 'src', 'public', 'firebase-auth-client.js');
let code = fs.readFileSync(clientFile, 'utf8');

// 1. Add signInWithEmailAndPassword to imports
if (!code.includes('signInWithEmailAndPassword')) {
    code = code.replace(
        'sendPasswordResetEmail\n} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";',
        'sendPasswordResetEmail,\n    signInWithEmailAndPassword,\n    createUserWithEmailAndPassword\n} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";'
    );
}

// 2. Add firebaseSignInWithCredentials function
if (!code.includes('export async function firebaseSignInWithCredentials')) {
    const credFunc = `
/**
 * Sign in using email/password with Firebase Auth
 */
export async function firebaseSignInWithCredentials(email, password) {
    if (!email || !password) return { success: false, error: 'Email and password required' };
    try {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const idToken = await userCred.user.getIdToken();
        return {
            success: true,
            user: userCred.user,
            idToken,
            uid: userCred.user.uid,
            email: userCred.user.email
        };
    } catch (err) {
        console.warn('[Firebase Auth] Sign in with credentials notice:', err.message);
        return { success: false, error: err.message };
    }
}
`;
    code = code.replace(
        'export async function firebaseSignOut() {',
        credFunc + '\nexport async function firebaseSignOut() {'
    );
}

// 3. Expose to window.firebaseAuthClient
if (!code.includes('firebaseSignInWithCredentials,')) {
    code = code.replace(
        'firebaseSignInWithGoogle,',
        'firebaseSignInWithGoogle,\n    firebaseSignInWithCredentials,\n    signInWithEmailAndPassword,'
    );
}

fs.writeFileSync(clientFile, code, 'utf8');
console.log('✓ Successfully patched src/public/firebase-auth-client.js');
