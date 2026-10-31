/**
 * Centralized Firebase Firestore Service
 * Dual-Sync persistence layer connecting Life PMS (ZOHO) backend to Zoho Firestore project (zoho-cda77)
 * Implements collections: users, in_app_requests, notifications, projects, tasks, timesheets
 */

const { v4: uuidv4 } = require('uuid');
const { app, db: configuredDb, hasAdminCredentials, firebaseConfig } = require('../config/firebase');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Obtain centralized firestoreDb handle
let firestoreDb = configuredDb;
if (!firestoreDb && app) {
    try {
        firestoreDb = getFirestore(app);
    } catch (e) {
        console.warn('[Firebase Firestore] Notice initializing getFirestore:', e.message);
    }
}

class FirebaseFirestoreService {
    static getDb() {
        return firestoreDb;
    }

    /**
     * Dual-write / sync user profile to Firestore
     * @param {object} user - User record from SQLite or Auth
     */
    static async syncUser(user) {
        if (!user || (!user.id && !user.email)) return null;

        const uid = user.id || user.uid;
        const email = (user.email || '').toLowerCase().trim();
        const username = user.username || email.split('@')[0];
        const displayName = user.name || user.displayName || username;
        const role = user.role || 'employee';
        const department = user.department || 'Engineering';
        const now = new Date().toISOString();

        const userDoc = {
            uid,
            email,
            username,
            displayName,
            role,
            department,
            avatarUrl: user.avatar_url || user.avatarUrl || '',
            bio: user.bio || '',
            phone: user.phone || '',
            authProvider: user.password_hash === 'FIREBASE_AUTH_MANAGED' ? 'google' : 'password',
            connections: Array.isArray(user.connections) ? user.connections : [],
            createdAt: user.created_at || now,
            updatedAt: now
        };

        if (firestoreDb && hasAdminCredentials) {
            try {
                // Write by canonical UID
                if (uid) {
                    await firestoreDb.collection('users').doc(uid).set(userDoc, { merge: true });
                }
                // Also index by email for legacy lookups
                if (email && email !== uid) {
                    await firestoreDb.collection('users').doc(email).set(userDoc, { merge: true });
                }
                return { success: true, docId: uid };
            } catch (err) {
                console.warn('[Firestore User Sync] Admin notice:', err.message);
            }
        }

        // REST fallback if apiKey and projectId are present
        if (firebaseConfig.apiKey && firebaseConfig.projectId && email) {
            try {
                const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/users/${encodeURIComponent(email)}?key=${firebaseConfig.apiKey}`;
                await fetch(restUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fields: {
                            uid: { stringValue: uid || '' },
                            email: { stringValue: email },
                            username: { stringValue: username },
                            displayName: { stringValue: displayName },
                            role: { stringValue: role },
                            department: { stringValue: department },
                            updatedAt: { stringValue: now }
                        }
                    })
                }).catch(() => null);
            } catch (e) {
                // non-blocking
            }
        }

        return { success: true, localOnly: true };
    }

    /**
     * Create In-App Request document & Real-time Notification in Firestore
     */
    static async createInAppRequest(requestRecord, senderUser, receiverUser) {
        const id = requestRecord.id;
        const now = requestRecord.created_at || new Date().toISOString();
        const payload = typeof requestRecord.payload_json === 'string'
            ? JSON.parse(requestRecord.payload_json || '{}')
            : (requestRecord.payload_json || {});

        const requestDoc = {
            id,
            senderId: requestRecord.sender_id,
            senderName: senderUser?.name || 'Workspace Member',
            senderEmail: senderUser?.email || '',
            receiverId: requestRecord.receiver_id,
            receiverEmail: receiverUser?.email || '',
            requestType: requestRecord.request_type,
            targetEntityId: requestRecord.target_entity_id || null,
            payload,
            status: requestRecord.status || 'PENDING',
            createdAt: now,
            respondedAt: null
        };

        const notifDoc = {
            id: 'notif-' + id,
            requestId: id,
            title: `New ${requestRecord.request_type.replace(/_/g, ' ')}`,
            message: `${senderUser?.name || 'A user'} sent you a ${requestRecord.request_type.toLowerCase().replace(/_/g, ' ')} request.`,
            type: requestRecord.request_type,
            isRead: false,
            createdAt: now
        };

        if (firestoreDb && hasAdminCredentials) {
            try {
                const batch = firestoreDb.batch();
                // 1. Root request doc
                const reqRef = firestoreDb.collection('in_app_requests').doc(id);
                batch.set(reqRef, requestDoc);

                // 2. User-scoped notification
                const notifRef = firestoreDb
                    .collection('users')
                    .doc(requestRecord.receiver_id)
                    .collection('notifications')
                    .doc(id);
                batch.set(notifRef, notifDoc);

                await batch.commit();
                console.log(`[Firestore Request Sync] Committed request ${id} & notification to receiver ${requestRecord.receiver_id}`);
                return { success: true };
            } catch (err) {
                console.warn('[Firestore Request Sync] Admin notice:', err.message);
            }
        }

        return { success: true, localOnly: true };
    }

    /**
     * Respond to an In-App Request in Firestore (Accept / Reject)
     */
    static async respondToInAppRequest(requestId, action, receiverId, requestRecord, senderUser, receiverUser) {
        const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        const now = new Date().toISOString();

        if (firestoreDb && hasAdminCredentials) {
            try {
                const reqRef = firestoreDb.collection('in_app_requests').doc(requestId);
                const receiverNotifRef = firestoreDb
                    .collection('users')
                    .doc(receiverId)
                    .collection('notifications')
                    .doc(requestId);

                await firestoreDb.runTransaction(async (t) => {
                    t.update(reqRef, {
                        status,
                        respondedAt: now
                    });
                    t.set(receiverNotifRef, { isRead: true, respondedAt: now }, { merge: true });

                    // Mutate target documents on ACCEPT
                    if (action === 'ACCEPT') {
                        const senderId = requestRecord.sender_id;
                        const reqType = requestRecord.request_type;

                        if (reqType === 'USER_CONNECTION') {
                            const userRef1 = firestoreDb.collection('users').doc(receiverId);
                            const userRef2 = firestoreDb.collection('users').doc(senderId);
                            const FieldValue = admin.firestore.FieldValue;
                            t.set(userRef1, { connections: FieldValue.arrayUnion(senderId) }, { merge: true });
                            t.set(userRef2, { connections: FieldValue.arrayUnion(receiverId) }, { merge: true });
                        } else if (reqType === 'PROJECT_INVITE' && requestRecord.target_entity_id) {
                            const projRef = firestoreDb.collection('projects').doc(requestRecord.target_entity_id);
                            const FieldValue = admin.firestore.FieldValue;
                            t.set(projRef, { memberIds: FieldValue.arrayUnion(receiverId), updatedAt: now }, { merge: true });
                        } else if (reqType === 'TASK_HANDOFF' && requestRecord.target_entity_id) {
                            const taskRef = firestoreDb.collection('tasks').doc(requestRecord.target_entity_id);
                            t.set(taskRef, { assigneeId: receiverId, updatedAt: now }, { merge: true });
                        }
                    }

                    // Write confirmation notification to sender
                    const senderNotifRef = firestoreDb
                        .collection('users')
                        .doc(requestRecord.sender_id)
                        .collection('notifications')
                        .doc(`confirm-${requestId}`);
                    t.set(senderNotifRef, {
                        requestId,
                        title: `Request ${status}`,
                        message: `${receiverUser?.name || 'User'} ${status.toLowerCase()} your ${requestRecord.request_type.toLowerCase().replace(/_/g, ' ')} request.`,
                        type: requestRecord.request_type,
                        isRead: false,
                        createdAt: now
                    });
                });

                console.log(`[Firestore Respond Sync] Transaction completed for request ${requestId} (${status})`);
                return { success: true };
            } catch (err) {
                console.warn('[Firestore Respond Sync] Admin notice:', err.message);
            }
        }

        return { success: true, localOnly: true };
    }

    /**
     * Cancel / Delete an In-App Request
     */
    static async cancelInAppRequest(requestId, senderId, receiverId) {
        if (firestoreDb && hasAdminCredentials) {
            try {
                const batch = firestoreDb.batch();
                const reqRef = firestoreDb.collection('in_app_requests').doc(requestId);
                batch.update(reqRef, { status: 'CANCELLED', updatedAt: new Date().toISOString() });

                const notifRef = firestoreDb
                    .collection('users')
                    .doc(receiverId)
                    .collection('notifications')
                    .doc(requestId);
                batch.delete(notifRef);

                await batch.commit();
                return { success: true };
            } catch (err) {
                console.warn('[Firestore Cancel Sync] notice:', err.message);
            }
        }
        return { success: true, localOnly: true };
    }

    /**
     * Sync Project to Firestore projects/{projectId}
     */
    static async syncProject(project) {
        if (!project || !project.id) return null;
        if (firestoreDb && hasAdminCredentials) {
            try {
                let memberIds = [];
                try {
                    memberIds = typeof project.member_ids === 'string' ? JSON.parse(project.member_ids || '[]') : (project.member_ids || []);
                } catch (e) {
                    memberIds = [];
                }

                await firestoreDb.collection('projects').doc(project.id).set({
                    id: project.id,
                    name: project.name,
                    portalId: project.portal_id || 'portal-demo-zoho',
                    managerId: project.owner_id || null,
                    memberIds,
                    budget: project.budget_amount || 0,
                    status: project.status || 'active',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (err) {
                console.warn('[Firestore Project Sync] notice:', err.message);
            }
        }
    }

    /**
     * Sync Task to Firestore tasks/{taskId}
     */
    static async syncTask(task) {
        if (!task || !task.id) return null;
        if (firestoreDb && hasAdminCredentials) {
            try {
                await firestoreDb.collection('tasks').doc(task.id).set({
                    id: task.id,
                    projectId: task.project_id,
                    parentId: task.parent_task_id || null,
                    title: task.name || task.title,
                    assigneeId: task.assignee_id || null,
                    status: task.status_id || 'open',
                    isExternal: task.is_internal ? false : true,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (err) {
                console.warn('[Firestore Task Sync] notice:', err.message);
            }
        }
    }

    /**
     * Sync Timesheet to Firestore timesheets/{logId}
     */
    static async syncTimesheet(log) {
        if (!log || !log.id) return null;
        if (firestoreDb && hasAdminCredentials) {
            try {
                await firestoreDb.collection('timesheets').doc(log.id).set({
                    id: log.id,
                    userId: log.user_id,
                    projectId: log.project_id,
                    taskId: log.task_id || null,
                    hours: log.hours || 0,
                    status: log.status || 'pending',
                    approvedBy: log.approved_by || null,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (err) {
                console.warn('[Firestore Timesheet Sync] notice:', err.message);
            }
        }
    }
}

module.exports = {
    admin,
    firestoreDb,
    FirebaseFirestoreService
};

