const https = require('https');

const apiKey = 'AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw';
const postData = JSON.stringify({
    email: 'backend.webmaska@gmail.com',
    password: 'FirebaseManagedAuth2026!',
    returnSecureToken: true
});

const req = https.request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
}, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('signInWithPassword response:', res.statusCode, body));
});

req.on('error', err => console.error('Error:', err));
req.write(postData);
req.end();
