const fs = require('fs');
const path = require('path');

const srcPublic = path.join(__dirname, '..', 'src', 'public');
const distDir = path.join(__dirname, '..', 'dist');

console.log('[Build] Preparing production distribution bundle...');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

fs.cpSync(srcPublic, distDir, { recursive: true });

// Ensure _redirects file is present in dist for SPA support on Netlify/Cloudflare
const redirectsPath = path.join(distDir, '_redirects');
if (!fs.existsSync(redirectsPath)) {
    fs.writeFileSync(redirectsPath, '/* /index.html 200\n', 'utf8');
}

console.log('[Build] ✓ Production bundle generated in ./dist successfully.');
