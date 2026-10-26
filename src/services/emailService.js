/**
 * SMTP Real Email Service
 * Handles transactional emails using Nodemailer with HTML templates and fallback logging.
 */

const nodemailer = require('nodemailer');
const config = require('../config');

class EmailService {
    static async getTransporter() {
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
            return nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD
                }
            });
        }
        if (config.smtp.user && config.smtp.pass) {
            return nodemailer.createTransport({
                host: config.smtp.host,
                port: config.smtp.port,
                secure: config.smtp.secure,
                auth: {
                    user: config.smtp.user,
                    pass: config.smtp.pass
                }
            });
        }
        // If no credentials configured yet, provision a real live Ethereal test account
        try {
            if (!this._cachedTestAccount) {
                this._cachedTestAccount = await nodemailer.createTestAccount();
            }
            return nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: this._cachedTestAccount.user,
                    pass: this._cachedTestAccount.pass
                }
            });
        } catch (err) {
            console.warn('[EmailService] Failed to create Ethereal test account:', err.message);
            return null;
        }
    }

    /**
     * Send email
     * @param {Object} options
     * @param {string} options.to
     * @param {string} options.subject
     * @param {string} options.text
     * @param {string} options.html
     */
    static async sendMail({ to, subject, text, html }) {
        const transporter = await this.getTransporter();

        if (transporter) {
            try {
                const info = await transporter.sendMail({
                    from: config.smtp.from || 'Life PMS <noreply@lifepms.com>',
                    to,
                    subject,
                    text,
                    html
                });
                const previewUrl = nodemailer.getTestMessageUrl(info);
                console.log(`[SMTP Email] Sent to ${to}: messageId ${info.messageId}${previewUrl ? ` | Preview: ${previewUrl}` : ''}`);
                return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
            } catch (err) {
                console.error(`[SMTP Email Error] Failed to send to ${to}:`, err.message);
                return { success: false, error: err.message };
            }
        } else {
            console.log(`[SMTP Fallback] Email to: ${to} | Subject: "${subject}"`);
            return { success: true, mock: true };
        }
    }

    /**
     * Send Invitation Email
     */
    static async sendInvitationEmail({ recipientEmail, recipientName, role = 'employee', portalName = 'Life PMS Workspace', projectName = 'WE-11 AI Training', inviteLink, inviterName = 'Project Admin' }) {
        const subject = `You've been invited to join ${projectName} on Life PMS`;
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
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
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="logo">⚡ Life PMS</div>
                        <p style="margin: 6px 0 0; color: #E0F2FE; font-size: 14px;">Next-Gen Enterprise Project Management</p>
                    </div>
                    <div class="body">
                        <h2 style="margin-top: 0; font-size: 20px; color: #F8FAFC;">Hello ${recipientName || 'there'},</h2>
                        <p style="color: #CBD5E1;"><strong>${inviterName}</strong> has invited you to collaborate on <strong>${projectName}</strong> in <strong>${portalName}</strong>.</p>
                        
                        <div class="invite-box">
                            <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Your Invitation Details</div>
                            <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Email:</strong> ${recipientEmail}</div>
                            <div style="font-size: 14px; color: #F8FAFC; margin-bottom: 4px;"><strong>Assigned Role:</strong> <span class="badge">${roleLabel}</span></div>
                            <div style="font-size: 14px; color: #F8FAFC;"><strong>Permissions:</strong> ${role === 'admin' ? 'Full Administrator Access' : (role === 'manager' ? 'Project Management & Approvals' : (role === 'client' ? 'Client Stakeholder (Internal fields hidden)' : 'Team Member Tasks & Timesheets'))}</div>
                        </div>

                        <div style="text-align: center; margin: 24px 0;">
                            <a href="${inviteLink}" class="btn-action" target="_blank">Accept Invitation & Access Workspace</a>
                        </div>

                        <p style="font-size: 13px; color: #94A3B8; margin-bottom: 4px;"><strong>Access Instructions:</strong></p>
                        <ol style="font-size: 13px; color: #CBD5E1; padding-left: 20px; margin-top: 4px;">
                            <li>Click the accept button above or visit <a href="${inviteLink}" style="color: #38BDF8;">${inviteLink}</a>.</li>
                            <li>Sign in using Google or enter your registered email <code>${recipientEmail}</code> and name <code>${recipientName}</code>.</li>
                            <li>Your role permissions will be activated automatically.</li>
                        </ol>
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
            text: `You have been invited by ${inviterName} to join ${projectName} as ${roleLabel}. Access link: ${inviteLink}`,
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
