/**
 * Firebase Cloud Messaging (FCM) Push Notification Service
 * Dispatches real-time device push notifications to team members.
 */

const admin = require('firebase-admin');
const config = require('../config');

class FcmNotificationService {
    static getMessaging() {
        try {
            if (admin && Array.isArray(admin.apps) && admin.apps.length > 0) {
                return admin.messaging();
            }
            if (config.firebase.clientEmail && config.firebase.privateKey) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: config.firebase.projectId,
                        clientEmail: config.firebase.clientEmail,
                        privateKey: config.firebase.privateKey
                    }),
                    databaseURL: config.firebase.databaseUrl
                });
                return admin.messaging();
            }
        } catch (err) {
            console.warn('[FCM Setup] Firebase Admin not initialized with live credentials:', err.message);
        }
        return null;
    }

    /**
     * Send push notification to a device registration token
     */
    static async sendPushToDevice(deviceToken, { title, body, data = {} }) {
        const messaging = this.getMessaging();
        if (!messaging) {
            console.log(`[FCM Mock Push] Notification to device: "${title}" - ${body}`);
            return { success: true, mock: true };
        }

        try {
            const message = {
                notification: { title, body },
                data,
                token: deviceToken
            };
            const response = await messaging.send(message);
            console.log('[FCM Push] Successfully sent message:', response);
            return { success: true, messageId: response };
        } catch (err) {
            console.error('[FCM Push Error] Failed to send push:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Broadcast to a topic (e.g. project updates)
     */
    static async sendPushToTopic(topic, { title, body, data = {} }) {
        const messaging = this.getMessaging();
        if (!messaging) {
            console.log(`[FCM Mock Topic Push] Broadcast to topic "${topic}": "${title}" - ${body}`);
            return { success: true, mock: true };
        }

        try {
            const message = {
                notification: { title, body },
                data,
                topic
            };
            const response = await messaging.send(message);
            return { success: true, messageId: response };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

module.exports = FcmNotificationService;
