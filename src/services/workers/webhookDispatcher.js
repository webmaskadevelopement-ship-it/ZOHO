const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class WebhookDispatcher {
    /**
     * Dispatches an event payload to registered active webhooks for a portal
     */
    static async dispatch(portalId, eventName, payload) {
        const webhooks = db.queryAll(
            'SELECT * FROM webhooks WHERE portal_id = ? AND is_active = 1',
            [portalId]
        );

        const matching = webhooks.filter(w => {
            try {
                const events = typeof w.events === 'string' ? JSON.parse(w.events || '[]') : w.events;
                return events.includes(eventName) || events.includes('*');
            } catch (e) {
                return false;
            }
        });

        const results = [];

        for (const wh of matching) {
            const bodyStr = JSON.stringify({
                event: eventName,
                timestamp: new Date().toISOString(),
                portalId,
                data: payload
            });

            // Compute HMAC-SHA256 signature
            const signature = wh.secret
                ? crypto.createHmac('sha256', wh.secret).update(bodyStr).digest('hex')
                : null;

            const deliveryId = uuidv4();
            const now = new Date().toISOString();

            try {
                // If native fetch is available, perform request or record simulation
                let resStatus = 200;
                let resBody = 'Delivered';

                if (typeof fetch === 'function' && wh.target_url.startsWith('http')) {
                    try {
                        const headers = {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Zoho-Alternative-Webhook/1.0'
                        };
                        if (signature) headers['X-Webhook-Signature'] = signature;

                        const response = await fetch(wh.target_url, {
                            method: 'POST',
                            headers,
                            body: bodyStr,
                            signal: AbortSignal.timeout(4000)
                        });
                        resStatus = response.status;
                        resBody = await response.text();
                    } catch (netErr) {
                        resStatus = 504;
                        resBody = netErr.message;
                    }
                }

                const isSuccess = resStatus >= 200 && resStatus < 300 ? 1 : 0;
                db.execute(
                    `INSERT INTO webhook_deliveries (id, webhook_id, event, payload, response_status, response_body, success, attempted_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [deliveryId, wh.id, eventName, bodyStr, resStatus, resBody.substring(0, 500), isSuccess, now]
                );

                results.push({ webhookId: wh.id, targetUrl: wh.target_url, status: resStatus, success: !!isSuccess });
            } catch (err) {
                console.error(`[Webhook Dispatch Error] ID ${wh.id}:`, err.message);
            }
        }

        return { dispatchedCount: results.length, details: results };
    }
}

module.exports = WebhookDispatcher;
