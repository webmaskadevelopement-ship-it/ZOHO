const https = require('https');

const apiKey = 'AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw';

const USERS = [
    { email: 'ravi.bhadoria@zoho.com', password: 'Zoho@Ravi#2026', name: 'Ravi Bhadoria' },
    { email: 'ananya.gupta@zoho.com', password: 'Zoho@Anan#2026', name: 'Ananya Gupta' },
    { email: 'ineet@zoho.com', password: 'Zoho@Inee#2026', name: 'Ineet' },
    { email: 'nikhil@zoho.com', password: 'Zoho@Nikh#2026', name: 'Nikhil' },
    { email: 'ritika@zoho.com', password: 'Zoho@Riti#2026', name: 'Ritika' },
    { email: 'shweta@zoho.com', password: 'Zoho@Shwe#2026', name: 'Shweta' },
    { email: 'ekta@zoho.com', password: 'Zoho@Ekta#2026', name: 'Ekta' },
    { email: 'abhishek@zoho.com', password: 'Zoho@Abhi#2026', name: 'Abhishek' },
    { email: 'prince@zoho.com', password: 'Zoho@Prin#2026', name: 'Prince' },
    { email: 'ali@zoho.com', password: 'Zoho@Ali1#2026', name: 'Ali' },
    { email: 'webmaskadevelopement@gmail.com', password: 'Zoho@Admin#2026', name: 'Nikhil Kaushik' },
    { email: 'backend.webmaska@gmail.com', password: 'Zoho@Manager#2026', name: 'Tushar' }
];

function request(url, body) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(body);
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
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

async function seedAll() {
    console.log('Seeding all 12 authorized users into Firebase Authentication (zoho-cda77)...');
    for (const u of USERS) {
        // 1. Try signUp
        const resSignUp = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
            email: u.email,
            password: u.password,
            displayName: u.name,
            returnSecureToken: true
        });

        if (resSignUp.status === 200) {
            console.log(`✓ [Created] ${u.email} -> UID: ${resSignUp.data.localId}`);
        } else if (resSignUp.data?.error?.message === 'EMAIL_EXISTS') {
            // Already created, verify signIn
            const resSignIn = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
                email: u.email,
                password: u.password,
                returnSecureToken: true
            });
            if (resSignIn.status === 200) {
                console.log(`✓ [Verified] ${u.email} -> UID: ${resSignIn.data.localId}`);
            } else {
                console.log(`! [Update needed] ${u.email}: ${resSignIn.data?.error?.message}`);
            }
        } else {
            console.log(`❌ Failed ${u.email}:`, resSignUp.data?.error?.message);
        }
    }
    console.log('Finished seeding users into Firebase Authentication.');
}

seedAll();
