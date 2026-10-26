const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { firebaseConfig, db: firestoreAdmin, hasAdminCredentials } = require('../config/firebase');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class FirebaseSyncService {
    /**
     * Record an email submitted through any web form
     * Persists to local SQLite and syncs to Google Cloud Firestore
     */
    static async recordEmailSubmission({ email, name, role = 'employee', source = 'web_form', portalId = 'portal-demo-zoho', metadata = {} }) {
        if (!email || !EMAIL_REGEX.test(email)) {
            throw new Error('A valid email address is required.');
        }

        const id = 'sub-' + uuidv4().slice(0, 8);
        const createdAt = new Date().toISOString();
        const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

        // 1. Persist to local database
        db.execute(`
            INSERT INTO submitted_emails (id, email, name, role, source, portal_id, metadata, firebase_synced, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, email.toLowerCase().trim(), name || '', role, source, portalId, metaStr, 0, createdAt]);

        // Also if invited_members doesn't have it, ensure it's recorded
        try {
            const existingInvite = db.queryOne('SELECT id FROM invited_members WHERE email = ?', [email.toLowerCase().trim()]);
            if (!existingInvite) {
                db.execute(`
                    INSERT INTO invited_members (id, portal_id, email, name, role, status, invited_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'pending', 'system', ?, ?)
                `, ['inv-' + uuidv4().slice(0, 8), portalId, email.toLowerCase().trim(), name || email.split('@')[0], role, createdAt, createdAt]);
            }
        } catch (e) {
            console.warn('[FirebaseSync] Invited members notice:', e.message);
        }

        // 2. Sync to Firebase Firestore
        let syncedToFirestore = false;
        let firestoreError = null;
        let firestoreDocId = null;

        // Try Admin SDK if service account is configured
        if (firestoreAdmin && hasAdminCredentials) {
            try {
                const docRef = await firestoreAdmin.collection('submitted_emails').add({
                    id,
                    email: email.toLowerCase().trim(),
                    name: name || '',
                    role,
                    source,
                    portalId,
                    metadata,
                    createdAt
                });
                firestoreDocId = docRef.id;
                syncedToFirestore = true;
                db.execute('UPDATE submitted_emails SET firebase_synced = 1 WHERE id = ?', [id]);
                console.log('[Firebase Admin] Stored submitted email in Firestore collection "submitted_emails":', docRef.id);
            } catch (err) {
                firestoreError = err.message;
                console.warn('[Firebase Admin] Firestore write failed:', err.message);
            }
        }

        // Fallback / Direct Firestore REST API with Firebase API Key
        if (!syncedToFirestore && firebaseConfig.apiKey && firebaseConfig.projectId) {
            try {
                const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/submitted_emails?key=${firebaseConfig.apiKey}`;
                const payload = {
                    fields: {
                        submissionId: { stringValue: id },
                        email: { stringValue: email.toLowerCase().trim() },
                        name: { stringValue: name || '' },
                        role: { stringValue: role },
                        source: { stringValue: source },
                        portalId: { stringValue: portalId },
                        createdAt: { stringValue: createdAt },
                        metadata: { stringValue: metaStr }
                    }
                };

                const res = await fetch(restUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    firestoreDocId = data.name;
                    syncedToFirestore = true;
                    db.execute('UPDATE submitted_emails SET firebase_synced = 1 WHERE id = ?', [id]);
                    console.log('[Firebase REST] Successfully saved submitted email to Firestore:', data.name);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    firestoreError = errData.error?.message || `HTTP ${res.status}`;
                    console.warn('[Firebase REST] Cloud Firestore responded:', res.status, firestoreError);
                }
            } catch (err) {
                firestoreError = err.message;
                console.warn('[Firebase REST] Call failed:', err.message);
            }
        }

        return {
            success: true,
            id,
            email: email.toLowerCase().trim(),
            name: name || '',
            role,
            source,
            syncedToFirestore,
            firestoreDocId,
            firestoreNotice: syncedToFirestore
                ? 'Saved directly to Firebase Firestore collection "submitted_emails". Viewable in Firebase Console.'
                : 'Recorded in system database. (Notice: ' + (firestoreError || 'Firebase rules pending') + ')'
        };
    }

    /**
     * Get list of all submitted emails
     */
    static getSubmittedEmails() {
        return db.queryAll('SELECT * FROM submitted_emails ORDER BY created_at DESC LIMIT 100');
    }

    /**
     * Firebase project status and diagnostics
     */
    static getStatus() {
        const count = db.queryOne('SELECT COUNT(*) as total, SUM(firebase_synced) as synced FROM submitted_emails') || { total: 0, synced: 0 };
        return {
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain,
            storageBucket: firebaseConfig.storageBucket,
            apiKeyConfigured: !!firebaseConfig.apiKey,
            hasAdminCredentials,
            totalSubmissions: count.total || 0,
            syncedSubmissions: count.synced || 0,
            collections: ['submitted_emails', 'invited_members', 'form_submissions', 'live_chat_messages']
        };
    }
}

module.exports = FirebaseSyncService;
