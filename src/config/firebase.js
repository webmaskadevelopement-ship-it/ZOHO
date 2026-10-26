const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "zoho-cda77.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "zoho-cda77",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "zoho-cda77.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "113375533978",
    appId: process.env.FIREBASE_APP_ID || "1:113375533978:web:471a042b3995295d5d7823",
    measurementId: "G-EWQVKEXCMS"
};

let app = null;
if (!getApps().length) {
    const adminConfig = {
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket
    };

    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        adminConfig.credential = cert({
            projectId: firebaseConfig.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        });
    }

    try {
        app = initializeApp(adminConfig);
    } catch (e) {
        console.warn('[Firebase] App initialization notice:', e.message);
    }
} else {
    app = getApps()[0];
}

const hasAdminCredentials = !!(
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
);

let db = null;
let auth = null;
let storage = null;

try {
    if (app && hasAdminCredentials) {
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
    }
} catch (e) {
    console.warn('[Firebase] Service initialization notice:', e.message);
}

module.exports = {
    firebaseConfig,
    app,
    db,
    auth,
    storage,
    hasAdminCredentials
};
