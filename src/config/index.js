const path = require('path');
require('dotenv').config();

const config = {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'life-pms-zoho-alternative-secret-token-2026',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/life_pms.db'),
    uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../data/uploads'),

    // SMTP Email Service Configuration
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'Life PMS <noreply@lifepms.com>'
    },

    // Firebase Admin & Cloud Messaging Configuration
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'life-pms-zoho',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
        databaseUrl: process.env.FIREBASE_DATABASE_URL || ''
    },

    // GitHub Integration Configuration
    github: {
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'lifepms-github-webhook-secret-2026'
    }
};

module.exports = config;
