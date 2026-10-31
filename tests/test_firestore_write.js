const https = require('https');

// Token returned from signUp
const idToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjkwNGIwZjkxYmU2ZWIwODY3ZGFiYmFhYjU4N2RmYzJlMzNmMDBhMjQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vem9oby1jZGE3NyIsImF1ZCI6InpvaG8tY2RhNzciLCJhdXRoX3RpbWUiOjE3OTM0NDIzNjcsInVzZXJfaWQiOiJuSkF2WVFKQkc4TlVJTGJaS1pWTmJ3UHVocGcxIiwic3ViIjoibkpBdllRSkJHOE5VSUxiWktaVk5id1B1aHBnMSIsImlhdCI6MTc5MzQ0MjM2NywiZXhwIjoxNzkzNDQ1OTY3LCJlbWFpbCI6InJhdmkuYmhhZG9yaWFAem9oby5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsicmF2aS5iaGFkb3JpYUB6b2hvLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.cxRIbgmJfV9DSFsyY6_0aNFBmcjt1FfyJDS5iyK2a1HBRvBaj6YOj-VlN0DpE_gMzYo6-ps_uTvnjQqpOJMSLpy_SV6OpQlei-OstEbaw3KN_kPVwXFyeCPbwYCjeo76Mz_WlSA3QLYu3sL1fH-oc4hp9Qe8ldOGheV-ppUVuveeT-4Daz-0NQhpNyZsz6TQ-NmVrq7tCITv4z9iRJHMVzv8Y2MWA5OlOPDjHpOHYfWTo1DWEvXh4SXomnVVSfuG_hKPjMJ_E276GWx9_Wn_oItU7EIHIS4LHzdeYQyyrABrn7iJ8Rc3V1jycRX0MtA5bqYczdueyUvE9jimbRfRUg";

const postData = JSON.stringify({
    fields: {
        name: { stringValue: 'Test Cross Device Project' },
        ownerEmail: { stringValue: 'ravi.bhadoria@zoho.com' },
        isPublic: { booleanValue: true }
    }
});

const req = https.request('https://firestore.googleapis.com/v1/projects/zoho-cda77/databases/(default)/documents/projects?documentId=test-cross-dev-proj-1', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        'Content-Length': Buffer.byteLength(postData)
    }
}, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('Firestore write status:', res.statusCode, body.substring(0, 300)));
});

req.on('error', err => console.error('Error:', err));
req.write(postData);
req.end();

