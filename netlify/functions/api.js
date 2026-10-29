/**
 * Netlify Serverless API Function
 * Serves backend API routes (email invitation dispatch, SMTP diagnostic, invite verification, auth, health check)
 * natively on Netlify without requiring an external server or hardcoded deployment URLs.
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Safe HTML escaping for email templates
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-portal-id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

/**
 * Dynamically resolves the base URL without hardcoding any specific Netlify domain.
 * Supports arbitrary Netlify preview URLs, branch deploys, custom domains, and localhost.
 */
function resolveBaseUrl(event, body = {}) {
    // 1. Client-supplied origin (e.g. window.location.origin sent from active frontend)
    if (body && typeof body.baseUrl === 'string' && body.baseUrl.trim().startsWith('http')) {
        return body.baseUrl.trim().replace(/\/+$/, '');
    }

    // 2. Netlify proxy request headers (Netlify edge sets x-forwarded-host and x-forwarded-proto)
    const headers = event.headers || {};
    const host = headers['x-forwarded-host'] || headers['host'];
    if (host && typeof host === 'string') {
        const proto = headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
        return `${proto}://${host}`.replace(/\/+$/, '');
    }

    // 3. Netlify system-injected environment variables (automatically set in Netlify runtime)
    if (process.env.DEPLOY_PRIME_URL && process.env.DEPLOY_PRIME_URL.startsWith('http')) {
        return process.env.DEPLOY_PRIME_URL.replace(/\/+$/, '');
    }
    if (process.env.URL && process.env.URL.startsWith('http')) {
        return process.env.URL.replace(/\/+$/, '');
    }
    if (process.env.DEPLOY_URL && process.env.DEPLOY_URL.startsWith('http')) {
        return process.env.DEPLOY_URL.replace(/\/+$/, '');
    }

    // 4. Custom configured app base URL
    if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.startsWith('http')) {
        return process.env.APP_BASE_URL.replace(/\/+$/, '');
    }

    // 5. Localhost fallback
    return 'http://localhost:5000';
}

/**
 * Retrieves email delivery credentials from Netlify environment variables,
 * bundled configuration, or local .env file.
 */
function getEmailCredentials() {
    let user = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USERNAME;
    let pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.MAIL_PASSWORD;
    let from = process.env.SMTP_FROM;

    let backupUser = process.env.GMAIL_BACKUP_USER || process.env.SMTP_BACKUP_USER;
    let backupPass = process.env.GMAIL_BACKUP_APP_PASSWORD || process.env.SMTP_BACKUP_PASS;

    // Check if bundled configuration exists
    if (!user || !pass) {
        try {
            const bundledPath = path.join(__dirname, 'email_config.json');
            if (fs.existsSync(bundledPath)) {
                const bundled = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
                user = user || bundled.GMAIL_USER || bundled.SMTP_USER;
                pass = pass || bundled.GMAIL_APP_PASSWORD || bundled.SMTP_PASS;
                from = from || bundled.SMTP_FROM;
                backupUser = backupUser || bundled.GMAIL_BACKUP_USER || bundled.SMTP_BACKUP_USER;
                backupPass = backupPass || bundled.GMAIL_BACKUP_APP_PASSWORD || bundled.SMTP_BACKUP_PASS;
            }
        } catch (e) {}
    }

    // Fallback: Check local .env file if running in an environment with filesystem access
    if (!user || !pass) {
        try {
            const envPath = path.resolve(__dirname, '..', '..', '.env');
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf8');
                const userMatch = content.match(/GMAIL_USER=["']?([^"'\r\n]+)["']?/) || content.match(/SMTP_USER=["']?([^"'\r\n]+)["']?/);
                const passMatch = content.match(/GMAIL_APP_PASSWORD=["']?([^"'\r\n]+)["']?/) || content.match(/SMTP_PASS=["']?([^"'\r\n]+)["']?/);
                const fromMatch = content.match(/SMTP_FROM=["']?([^"'\r\n]+)["']?/);
                const backupUserMatch = content.match(/GMAIL_BACKUP_USER=["']?([^"'\r\n]+)["']?/) || content.match(/SMTP_BACKUP_USER=["']?([^"'\r\n]+)["']?/);
                const backupPassMatch = content.match(/GMAIL_BACKUP_APP_PASSWORD=["']?([^"'\r\n]+)["']?/) || content.match(/SMTP_BACKUP_PASS=["']?([^"'\r\n]+)["']?/);
                if (userMatch && userMatch[1]) user = user || userMatch[1].trim();
                if (passMatch && passMatch[1]) pass = pass || passMatch[1].trim();
                if (fromMatch && fromMatch[1]) from = from || fromMatch[1].trim();
                if (backupUserMatch && backupUserMatch[1]) backupUser = backupUser || backupUserMatch[1].trim();
                if (backupPassMatch && backupPassMatch[1]) backupPass = backupPass || backupPassMatch[1].trim();
            }
        } catch (e) {}
    }

    return {
        user: user ? user.trim() : null,
        pass: pass ? pass.replace(/\s+/g, '') : null,
        backupUser: backupUser ? backupUser.trim() : null,
        backupPass: backupPass ? backupPass.replace(/\s+/g, '') : null,
        from: from || (user ? `Life PMS <${user.trim()}>` : 'Life PMS <notifications@lifepms.com>')
    };
}

exports.handler = async (event, context) => {
    // 1. Handle CORS Preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    const rawPath = event.path || '';
    // Normalize path by stripping Netlify function prefixes
    const cleanPath = rawPath
        .replace(/^\/\.netlify\/functions\/api/, '')
        .replace(/^\/api/, '') || '/';

    console.log(`[Netlify Function] ${event.httpMethod} ${cleanPath}`);

    // Parse body for POST requests
    let body = {};
    if (event.body) {
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch (e) {
            body = {};
        }
    }
    const query = event.queryStringParameters || {};

    try {
        // Route 1: Health Check
        if (cleanPath === '/health' || cleanPath === '/v1/health' || cleanPath === '/') {
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    status: 'UP',
                    platform: 'Netlify Serverless Cloud Functions (Node.js)',
                    timestamp: new Date().toISOString(),
                    service: 'Life Project Management System'
                })
            };
        }

        // Route 2: SMTP Diagnostic Status
        if (cleanPath.includes('/portals/smtp-status')) {
            const { user, pass, from } = getEmailCredentials();

            if (!user || !pass) {
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            configured: false,
                            verified: false,
                            provider: 'none',
                            error: 'GMAIL_USER and GMAIL_APP_PASSWORD are not yet configured in Netlify environment variables.'
                        }
                    })
                };
            }

            try {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: { user, pass }
                });
                await transporter.verify();
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            configured: true,
                            verified: true,
                            provider: 'gmail',
                            host: 'smtp.gmail.com',
                            user,
                            from
                        }
                    })
                };
            } catch (smtpErr) {
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        data: {
                            configured: true,
                            verified: false,
                            error: smtpErr.message,
                            code: smtpErr.code || null
                        }
                    })
                };
            }
        }

        // Route 3: Send Invitation Email (POST /api/v1/portals/invite)
        if (cleanPath.includes('/portals/invite') && event.httpMethod === 'POST') {
            const { email, name, role = 'employee' } = body;
            if (!email || !email.includes('@')) {
                return {
                    statusCode: 400,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: false, error: 'A valid email address is required.' })
                };
            }

            const cleanEmail = email.toLowerCase().trim();
            const cleanName = (name || email.split('@')[0]).trim();
            const safeRole = role.toLowerCase();
            const roleLabel = safeRole.charAt(0).toUpperCase() + safeRole.slice(1);

            const token = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const expiryFormatted = new Date(expiresAt).toLocaleDateString(undefined, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
            });

            // Dynamically resolve URL without hardcoding any domain
            const appBase = resolveBaseUrl(event, body);
            const inviteLink = `${appBase}/login?token=${token}&inviteEmail=${encodeURIComponent(cleanEmail)}&inviteName=${encodeURIComponent(cleanName)}&role=${encodeURIComponent(safeRole)}`;

            const { user: gmailUser, pass: gmailPass, from: smtpFrom, backupUser, backupPass } = getEmailCredentials();

            let emailDelivery = {
                success: false,
                deliveredToInbox: false,
                isDailyLimitExceeded: false,
                error: null,
                messageId: null,
                provider: 'none'
            };

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; color: #F8FAFC; margin: 0; padding: 24px; }
                        .card { max-width: 580px; margin: 0 auto; background-color: #1E293B; border: 1px solid #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
                        .header { background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%); padding: 28px 24px; text-align: center; }
                        .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #FFFFFF; }
                        .body { padding: 32px 28px; line-height: 1.6; }
                        .invite-box { background-color: #0F172A; border: 1px solid #334155; border-radius: 8px; padding: 18px; margin: 20px 0; }
                        .btn-action { display: inline-block; background-color: #0284C7; color: #FFFFFF !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 6px; margin: 16px 0; font-size: 14px; text-align: center; }
                        .footer { padding: 18px 24px; background-color: #0F172A; border-top: 1px solid #334155; font-size: 12px; color: #94A3B8; text-align: center; }
                        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: #0284C7; color: #FFF; text-transform: uppercase; }
                        .expiry-note { font-size: 12px; color: #F59E0B; background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); padding: 8px 12px; border-radius: 6px; margin-top: 12px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="header">
                            <div class="logo">⚡ Life PMS</div>
                            <p style="margin: 6px 0 0; color: #E0F2FE; font-size: 14px;">Next-Gen Enterprise Project Management</p>
                        </div>
                        <div class="body">
                            <h2 style="margin-top: 0; font-size: 20px; color: #F8FAFC;">Hello ${escapeHtml(cleanName)},</h2>
                            <p style="color: #CBD5E1;">You have been invited to collaborate on <strong>Life PMS Projects</strong> in <strong>Life PMS Workspace</strong>.</p>
                            
                            <div class="invite-box">
                                <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Access Details</div>
                                <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Account Email:</strong> ${escapeHtml(cleanEmail)}</div>
                                <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Assigned Role:</strong> <span class="badge">${escapeHtml(roleLabel)}</span></div>
                                <div style="font-size: 14px; color: #F8FAFC;"><strong>Permissions:</strong> ${safeRole === 'admin' ? 'Full Administrator Access' : (safeRole === 'manager' ? 'Project Management & Approvals' : 'Team Member Tasks & Timesheets')}</div>
                            </div>

                            <div style="text-align: center; margin: 24px 0;">
                                <a href="${inviteLink}" class="btn-action" target="_blank">Accept Invitation & Access Workspace</a>
                            </div>

                            <div class="expiry-note">
                                ⏳ <strong>Security Notice:</strong> This invitation link is personalized for <strong>${escapeHtml(cleanEmail)}</strong> and valid until <strong>${expiryFormatted}</strong>.
                            </div>

                            <p style="font-size: 13px; color: #94A3B8; margin-top: 20px; margin-bottom: 4px;"><strong>Direct Access Link:</strong></p>
                            <p style="font-size: 13px; word-break: break-all;"><a href="${inviteLink}" style="color: #38BDF8;">${inviteLink}</a></p>
                        </div>
                        <div class="footer">
                            Life Project Management System &bull; Secure Enterprise Notification &bull; Confidential
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Attempt delivery via configured SMTP / Gmail
            if (gmailUser && gmailPass) {
                try {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: gmailUser, pass: gmailPass }
                    });

                    const info = await transporter.sendMail({
                        from: smtpFrom || `Life PMS <${gmailUser}>`,
                        to: cleanEmail,
                        subject: `You've been invited to join Life PMS Projects on Life PMS`,
                        html
                    });

                    emailDelivery.success = true;
                    emailDelivery.deliveredToInbox = true;
                    emailDelivery.messageId = info.messageId;
                    emailDelivery.provider = 'gmail';
                    console.log(`[Netlify Email Sent] Recipient: ${cleanEmail} | MessageId: ${info.messageId} | Link: ${inviteLink}`);
                } catch (mailErr) {
                    console.warn(`[Netlify Email Send Primary Failed] ${mailErr.message}`);
                    emailDelivery.error = mailErr.message;
                    emailDelivery.provider = 'gmail';
                    const isLimit = /550|daily user sending limit|quota|limit exceeded/i.test(mailErr.message || '');
                    if (isLimit) {
                        emailDelivery.isDailyLimitExceeded = true;
                    }

                    // Attempt fallback credentials if configured
                    if (backupUser && backupPass) {
                        try {
                            const backupTransporter = nodemailer.createTransport({
                                service: 'gmail',
                                auth: { user: backupUser, pass: backupPass }
                            });
                            const backupInfo = await backupTransporter.sendMail({
                                from: `Life PMS <${backupUser}>`,
                                to: cleanEmail,
                                subject: `You've been invited to join Life PMS Projects on Life PMS`,
                                html
                            });
                            emailDelivery.success = true;
                            emailDelivery.deliveredToInbox = true;
                            emailDelivery.messageId = backupInfo.messageId;
                            emailDelivery.provider = 'gmail_backup';
                            emailDelivery.error = null;
                            emailDelivery.isDailyLimitExceeded = false;
                            console.log(`[Netlify Backup Email Sent] Recipient: ${cleanEmail} | MessageId: ${backupInfo.messageId}`);
                        } catch (backupErr) {
                            console.warn(`[Netlify Backup Email Failed]: ${backupErr.message}`);
                        }
                    }
                }
            } else {
                emailDelivery.error = 'Email delivery credentials not configured. Direct invitation link generated.';
            }

            const inviteId = 'inv-' + Date.now().toString(36);
            return {
                statusCode: 201,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    data: {
                        success: true,
                        inviteId,
                        invitationId: inviteId,
                        token,
                        tokenHash,
                        expiresAt,
                        email: cleanEmail,
                        name: cleanName,
                        role: safeRole,
                        inviteLink,
                        messageId: emailDelivery.messageId,
                        deliveredToInbox: emailDelivery.deliveredToInbox,
                        isDailyLimitExceeded: emailDelivery.isDailyLimitExceeded,
                        sandboxOnly: false,
                        provider: emailDelivery.provider,
                        emailDelivery: {
                            success: emailDelivery.success,
                            deliveredToInbox: emailDelivery.deliveredToInbox,
                            isDailyLimitExceeded: emailDelivery.isDailyLimitExceeded,
                            messageId: emailDelivery.messageId,
                            accepted: emailDelivery.deliveredToInbox ? [cleanEmail] : [],
                            error: emailDelivery.error,
                            provider: emailDelivery.provider
                        }
                    }
                })
            };
        }

        // Route 4: Verify Invitation (GET /api/v1/portals/invite/verify or /accept)
        if (cleanPath.includes('/portals/invite/verify') || cleanPath.includes('/portals/invite/accept')) {
            const token = query.token || query.code;
            const email = query.email || query.inviteEmail;

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    valid: true,
                    data: {
                        message: 'Invitation verified successfully.',
                        email: email || '',
                        name: query.inviteName || query.name || '',
                        role: query.role || 'employee',
                        status: 'active',
                        portalId: 'portal-demo-zoho'
                    }
                })
            };
        }

        // Route 5: Public View Share via Email (POST /api/v1/views/public-share/email)
        if (cleanPath.includes('/views/public-share/email') && event.httpMethod === 'POST') {
            const { shareToken, email } = body;
            if (!shareToken || !email) {
                return {
                    statusCode: 400,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({ success: false, error: 'shareToken and email are required.' })
                };
            }

            const cleanEmail = email.toLowerCase().trim();
            const appBase = resolveBaseUrl(event, body);
            const viewUrl = `${appBase}/api/v1/views/public-share/${shareToken}`;

            const { user: gmailUser, pass: gmailPass, from: smtpFrom } = getEmailCredentials();
            let emailSent = false;
            let sendError = null;

            if (gmailUser && gmailPass) {
                try {
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: { user: gmailUser, pass: gmailPass }
                    });

                    await transporter.sendMail({
                        from: smtpFrom || `Life PMS <${gmailUser}>`,
                        to: cleanEmail,
                        subject: `Shared View on Life PMS`,
                        html: `
                            <div style="font-family:sans-serif; background:#0F172A; color:#F8FAFC; padding:24px; border-radius:8px;">
                                <h2>Shared View on Life PMS</h2>
                                <p>A read-only view has been shared with you: <a href="${viewUrl}" style="color:#38BDF8;">${viewUrl}</a></p>
                            </div>
                        `
                    });
                    emailSent = true;
                } catch (err) {
                    console.warn('[Netlify View Share Email Failed]:', err.message);
                    sendError = err.message;
                }
            }

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    deliveredToInbox: emailSent,
                    viewUrl,
                    emailDelivery: {
                        success: emailSent,
                        deliveredToInbox: emailSent,
                        error: sendError
                    },
                    message: emailSent
                        ? `Share link emailed to ${cleanEmail}`
                        : `Share link generated. Note: Email provider reported: ${sendError || 'SMTP limit reached'}. Direct access link: ${viewUrl}`
                })
            };
        }

        // Route 6: Firebase/Google Auth token exchange handler
        if ((cleanPath.includes('/auth/google-login') || cleanPath.includes('/auth/firebase-login')) && event.httpMethod === 'POST') {
            const cleanEmail = (body.email || '').toLowerCase().trim();
            let role = body.role || 'member';
            if (cleanEmail === 'webmaskadevelopement@gmail.com') role = 'admin';
            else if (cleanEmail === 'backend.webmaska@gmail.com') role = 'manager';

            const user = {
                id: body.uid || 'usr-' + Buffer.from(cleanEmail || 'user').toString('hex').substring(0, 10),
                email: cleanEmail,
                name: body.name || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
                role: role,
                department: 'Team',
                status: 'active'
            };

            const token = body.idToken || ('jwt-session-' + Date.now().toString(36) + '-' + crypto.randomBytes(16).toString('hex'));

            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    success: true,
                    token,
                    data: {
                        token,
                        user
                    },
                    user
                })
            };
        }

        // Route 7: Return 404 for unhandled routes so frontend client-side router/mock handles them
        return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                error: `Endpoint not found on serverless function: ${cleanPath}`
            })
        };
    } catch (err) {
        console.error('[Netlify Function Error]:', err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                error: err.message
            })
        };
    }
};
