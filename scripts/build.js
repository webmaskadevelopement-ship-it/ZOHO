const fs = require('fs');
const path = require('path');

try {
    require('dotenv').config();
} catch (e) {}

const srcPublic = path.join(__dirname, '..', 'src', 'public');
const distDir = path.join(__dirname, '..', 'dist');
const netlifyFunctionsDir = path.join(__dirname, '..', 'netlify', 'functions');

console.log('[Build] Preparing production distribution bundle...');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

fs.cpSync(srcPublic, distDir, { recursive: true });

// Ensure _redirects file is present in dist for SPA support on Netlify/Cloudflare
const redirectsPath = path.join(distDir, '_redirects');
const backendApiUrl = process.env.BACKEND_API_URL || process.env.API_BASE_URL || '';
let apiRedirectRule = '/api/*       /.netlify/functions/api/:splat  200!\n';
if (backendApiUrl) {
    const cleanUrl = backendApiUrl.replace(/\/+$/, '');
    apiRedirectRule = `/api/*       ${cleanUrl}/api/:splat  200!\n`;
}
const redirectsContent = `${apiRedirectRule}/login       /login.html   200\n/login/*     /login.html   200\n/login.html  /login.html   200\n/*           /index.html   200\n`;
fs.writeFileSync(redirectsPath, redirectsContent, 'utf8');

// Package email credentials for serverless functions if present in build environment or local .env
const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || '';
const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || (gmailUser ? `Life PMS <${gmailUser}>` : '');

if (gmailUser && gmailPass) {
    if (!fs.existsSync(netlifyFunctionsDir)) {
        fs.mkdirSync(netlifyFunctionsDir, { recursive: true });
    }
    const configPath = path.join(netlifyFunctionsDir, 'email_config.json');
    fs.writeFileSync(configPath, JSON.stringify({
        GMAIL_USER: gmailUser.trim(),
        GMAIL_APP_PASSWORD: gmailPass.replace(/\s+/g, ''),
        SMTP_FROM: smtpFrom
    }, null, 2), 'utf8');
    console.log('[Build] ✓ Packaged serverless email configuration (GMAIL_USER: ' + gmailUser + ')');
}

console.log('[Build] ✓ Production bundle generated in ./dist successfully.');
