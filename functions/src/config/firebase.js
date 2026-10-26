const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) {
    initializeApp({
        projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'zoho-cda77'
    });
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

module.exports = {
    db,
    auth,
    storage
};
