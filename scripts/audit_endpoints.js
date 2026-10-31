const fs = require('fs');

const appJs = fs.readFileSync('src/public/app.js', 'utf8');
const lines = appJs.split('\n');
const endpoints = new Set();
lines.forEach(l => {
  const match = l.match(/apiFetch\([`'"]([^`'"]+)/);
  if (match) endpoints.add(match[1].split('?')[0]);
});

console.log('Total unique apiFetch endpoints in app.js:', endpoints.size);
const sorted = Array.from(endpoints).sort();
sorted.forEach(e => console.log('  ', e));

