const fs = require('fs');
let code = fs.readFileSync('netlify/functions/api.js', 'utf8');
code = code.replace("cleanPath.startsWith('/api/v1/projects') || cleanPath.startsWith('/api/projects')", "cleanPath.includes('/projects')");
fs.writeFileSync('netlify/functions/api.js', code, 'utf8');
console.log('Replaced route 6.3 condition successfully');

