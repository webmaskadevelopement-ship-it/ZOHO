const https = require('https');

const apiKey = 'AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw';

function request(url, body, headers = {}) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(body);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', err => resolve({ status: 500, error: err.message }));
        req.write(postData);
        req.end();
    });
}

async function testAuthAndFirestore() {
    // 1. Sign in with password
    const login = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
        email: 'ravi.bhadoria@zoho.com',
        password: 'Zoho@Ravi#2026',
        returnSecureToken: true
    });
    console.log('Login status:', login.status);
    const idToken = login.data.idToken;
    console.log('Local ID (UID):', login.data.localId);

    // 2. Read projects
    const getRes = await new Promise((resolve) => {
        https.get('https://firestore.googleapis.com/v1/projects/zoho-cda77/databases/(default)/documents/projects', {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        }, res => {
            let b = '';
            res.on('data', c => b += c);
            res.on('end', () => resolve({ status: res.statusCode, raw: b }));
        });
    });
    console.log('Get projects status with idToken:', getRes.status, getRes.raw);
}

testAuthAndFirestore();

