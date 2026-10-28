/**
 * SMTP Real Email Service
 * Handles transactional emails using Nodemailer with HTML templates,
 * delivery verification, provider status logging, and diagnostic testing.
 */

const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
    /**
     * Determine transport provider and create Nodemailer transporter
     * Returns { transporter, isRealSmtp, provider, host, user, from }
     */
    static async getTransporterInfo() {
        const gmailUser = process.env.GMAIL_USER || (process.env.SMTP_HOST?.includes('gmail.com') ? process.env.SMTP_USER : null);
        const gmailPass = process.env.GMAIL_APP_PASSWORD || (process.env.SMTP_HOST?.includes('gmail.com') ? process.env.SMTP_PASS : null);

        // 1. Direct Gmail Configuration (via GMAIL_USER & GMAIL_APP_PASSWORD or SMTP settings pointing to Gmail)
        if (gmailUser && gmailPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailUser,
                    pass: gmailPass
                }
            });
            return {
                transporter,
                isRealSmtp: true,
                provider: 'gmail',
                host: 'smtp.gmail.com',
                user: gmailUser,
                from: process.env.SMTP_FROM || `Life PMS <${gmailUser}>`
            };
        }

        // 2. Custom SMTP Configuration (e.g. Brevo, SendGrid, Mailgun, Amazon SES, Zoho, etc.)
        const smtpUser = process.env.SMTP_USER || config.smtp?.user;
        const smtpPass = process.env.SMTP_PASS || config.smtp?.pass;
        const smtpHost = process.env.SMTP_HOST || config.smtp?.host;
        const smtpPort = parseInt(process.env.SMTP_PORT || config.smtp?.port, 10) || 587;
        const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

        if (smtpUser && smtpPass && smtpHost && !smtpHost.includes('mailtrap.io')) {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure,
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            return {
                transporter,
                isRealSmtp: true,
                provider: 'custom_smtp',
                host: smtpHost,
                user: smtpUser,
                from: process.env.SMTP_FROM || config.smtp?.from || `Life PMS <${smtpUser}>`
            };
        }

        // 3. Fallback: Ethereal test sandbox for local development testing
        const isEtherealAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_ETHEREAL === 'true';
        if (!isEtherealAllowed) {
            const errorMsg = 'No real SMTP email provider configured. Set GMAIL_USER & GMAIL_APP_PASSWORD or SMTP_USER & SMTP_PASS in .env. Ethereal sandbox is disabled in production.';
            console.error(`[EmailService Error] ${errorMsg}`);
            return {
                transporter: null,
                isRealSmtp: false,
                isSandbox: false,
                provider: 'none',
                error: errorMsg
            };
        }

        try {
            if (!this._cachedTestAccount) {
                this._cachedTestAccount = await nodemailer.createTestAccount();
            }
            const transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: this._cachedTestAccount.user,
                    pass: this._cachedTestAccount.pass
                }
            });
            return {
                transporter,
                isRealSmtp: false,
                isSandbox: true,
                provider: 'ethereal_sandbox',
                host: 'smtp.ethereal.email',
                user: this._cachedTestAccount.user,
                from: process.env.SMTP_FROM || 'Life PMS <noreply@lifepms.com>'
            };
        } catch (err) {
            console.warn('[EmailService] Failed to create Ethereal sandbox:', err.message);
            return {
                transporter: null,
                isRealSmtp: false,
                isSandbox: false,
                provider: 'none',
                error: err.message
            };
        }
    }

    /**
     * Get active Nodemailer transporter
     */
    static async getTransporter() {
        const info = await this.getTransporterInfo();
        return info.transporter;
    }

    /**
     * Live SMTP Diagnostic: Check whether the configured email service is online & credentials valid
     */
    static async verifyConnection() {
        try {
            const info = await this.getTransporterInfo();
            if (!info.transporter) {
                return {
                    configured: false,
                    verified: false,
                    provider: 'none',
                    error: 'No email service or SMTP credentials configured in .env'
                };
            }

            if (!info.isRealSmtp) {
                return {
                    configured: false,
                    isSandbox: true,
                    isTestAccount: true,
                    verified: true,
                    provider: 'ethereal_sandbox',
                    host: info.host,
                    user: info.user,
                    warning: 'Running in developer sandbox mode (Ethereal). Real email delivery requires GMAIL_USER/GMAIL_APP_PASSWORD or SMTP_USER/SMTP_PASS in .env.'
                };
            }

            // Verify with real SMTP server
            await info.transporter.verify();
            console.log(`[EmailService] SMTP connection verified successfully with ${info.host} as ${info.user}`);
            return {
                configured: true,
                isSandbox: false,
                isTestAccount: false,
                verified: true,
                provider: info.provider,
                host: info.host,
                user: info.user,
                from: info.from
            };
        } catch (err) {
            console.error('[EmailService] SMTP verification failed:', err.message);
            return {
                configured: true,
                verified: false,
                error: err.message,
                code: err.code || null
            };
        }
    }

    /**
     * Send email with delivery tracking & error diagnostics
     * @param {Object} options
     * @param {string} options.to
     * @param {string} options.subject
     * @param {string} options.text
     * @param {string} options.html
     */
    static async sendMail({ to, subject, text, html }) {
        const transportInfo = await this.getTransporterInfo();
        const { transporter, isRealSmtp, isSandbox, provider, from } = transportInfo;

        if (!transporter) {
            const errorMsg = 'No SMTP service configured. Please add SMTP_USER & SMTP_PASS in .env.';
            console.warn(`[EmailService Warning] Cannot deliver to ${to}: ${errorMsg}`);
            return {
                success: false,
                deliveredToInbox: false,
                provider: 'none',
                error: errorMsg
            };
        }

        try {
            const senderAddress = from || config.smtp?.from || 'Life PMS <noreply@lifepms.com>';
            const info = await transporter.sendMail({
                from: senderAddress,
                to,
                subject,
                text,
                html
            });

            if (isRealSmtp) {
                const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
                console.log(`[SMTP Live Delivery] Recipient: ${to} | Accepted: ${accepted} | MessageId: ${info.messageId} | Response: ${info.response || 'OK'}`);
                return {
                    success: accepted,
                    deliveredToInbox: accepted,
                    messageId: info.messageId,
                    accepted: info.accepted || [to],
                    rejected: info.rejected || [],
                    response: info.response || null,
                    provider
                };
            }

            // Test Sandbox mode (Ethereal)
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`[SMTP Sandbox] Recipient: ${to} | Sandbox Inbox Preview: ${previewUrl}`);
            return {
                success: true,
                deliveredToInbox: false,
                sandboxOnly: true,
                messageId: info.messageId,
                previewUrl: previewUrl || null,
                provider: 'ethereal_sandbox',
                notice: 'Message captured by Ethereal test inbox. Real inbox delivery requires real SMTP credentials in .env.'
            };
        } catch (err) {
            console.error(`[SMTP Error] Delivery failed to ${to}:`, err.message);
            return {
                success: false,
                deliveredToInbox: false,
                error: err.message,
                code: err.code || null,
                provider
            };
        }
    }

    /**
     * Send Invitation Email
     */
    static async sendInvitationEmail({
        recipientEmail,
        recipientName,
        role = 'employee',
        portalName = 'Life PMS Workspace',
        projectName = 'Life PMS Projects',
        inviteLink,
        token,
        expiresAt,
        inviterName = 'Project Admin',
        isSelfShare = false
    }) {
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
        const subject = isSelfShare
            ? `Workspace Access Link: ${projectName}`
            : `You've been invited to join ${projectName} on Life PMS`;
        const headline = isSelfShare
            ? `Your Workspace Access Link for ${projectName}`
            : `Hello ${recipientName || 'there'},`;
        const introText = isSelfShare
            ? `Here is your direct workspace access link and summary for <strong>${projectName}</strong> in <strong>${portalName}</strong>.`
            : `<strong>${inviterName}</strong> has invited you to collaborate on <strong>${projectName}</strong> in <strong>${portalName}</strong>.`;
        const buttonText = isSelfShare
            ? `Open Project Workspace`
            : `Accept Invitation & Access Workspace`;

        const expiryDateFormatted = expiresAt
            ? new Date(expiresAt).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
            : '7 days from now';

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
                        <h2 style="margin-top: 0; font-size: 20px; color: #F8FAFC;">${headline}</h2>
                        <p style="color: #CBD5E1;">${introText}</p>
                        
                        <div class="invite-box">
                            <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Access Details</div>
                            <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Account Email:</strong> ${recipientEmail}</div>
                            <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Assigned Role:</strong> <span class="badge">${roleLabel}</span></div>
                            <div style="font-size: 14px; color: #F8FAFC;"><strong>Permissions:</strong> ${role === 'admin' ? 'Full Administrator Access' : (role === 'manager' ? 'Project Management & Approvals' : (role === 'client' ? 'Client Stakeholder' : 'Team Member Tasks & Timesheets'))}</div>
                        </div>

                        <div style="text-align: center; margin: 24px 0;">
                            <a href="${inviteLink}" class="btn-action" target="_blank">${buttonText}</a>
                        </div>

                        <div class="expiry-note">
                            ⏳ <strong>Security Notice:</strong> This invitation link is personalized for <strong>${recipientEmail}</strong> and valid until <strong>${expiryDateFormatted}</strong>.
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

        return this.sendMail({
            to: recipientEmail,
            subject,
            text: `${isSelfShare ? 'Your access link' : `You have been invited by ${inviterName}`} for ${projectName} (${roleLabel}): ${inviteLink}\nValid until: ${expiryDateFormatted}`,
            html
        });
    }

    /**
     * Send Task Assigned notification
     */
    static async sendTaskAssignedEmail({ recipientEmail, recipientName, taskTitle, taskKey, projectName, dueDate }) {
        const subject = `[${projectName}] Assigned: #${taskKey} - ${taskTitle}`;
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E2E8F0; border-radius: 8px;">
                <h2 style="color: #0F172A; margin-top: 0;">Task Assigned to You</h2>
                <p>Hello <strong>${recipientName}</strong>,</p>
                <p>You have been assigned to work on the following task in project <strong>${projectName}</strong>:</p>
                <div style="background-color: #F8FAFC; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                    <div style="font-weight: 700; color: #1E293B;">#${taskKey}: ${taskTitle}</div>
                    <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Due Date: ${dueDate || 'Not set'}</div>
                </div>
                <p style="color: #64748B; font-size: 13px;">Life Project Management System &bull; Production Notification</p>
            </div>
        `;
        return this.sendMail({ to: recipientEmail, subject, text: `Task #${taskKey} assigned to you: ${taskTitle}`, html });
    }

    /**
     * Send SLA Breach Alert notification
     */
    static async sendSlaBreachAlert({ recipientEmail, issueKey, issueTitle, severity, hoursOverdue }) {
        const subject = `⚠️ [SLA ALERT] ${severity.toUpperCase()} Issue #${issueKey} Overdue`;
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #FECACA; border-radius: 8px;">
                <h2 style="color: #DC2626; margin-top: 0;">⚠️ Service Level Agreement (SLA) Breach</h2>
                <p>An issue has breached its resolution target deadline:</p>
                <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                    <div style="font-weight: 700; color: #991B1B;">#${issueKey}: ${issueTitle}</div>
                    <div style="font-size: 13px; color: #B91C1C; margin-top: 4px;">Severity: ${severity.toUpperCase()} | Overdue by: ~${hoursOverdue || 1} hours</div>
                </div>
                <p>Immediate triage required.</p>
            </div>
        `;
        return this.sendMail({ to: recipientEmail, subject, text: `SLA Breach on #${issueKey} (${severity}): ${issueTitle}`, html });
    }
}

module.exports = EmailService;
