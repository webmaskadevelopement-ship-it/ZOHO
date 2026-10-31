const https = require('https');

const apiKey = 'AIzaSyA7zjc_IRR59VEsm-2KC7aWjXaheGoBhUw';
const urls = [
    `https://zoho-cda77-default-rtdb.firebaseio.com/.json?auth=${apiKey}`,
    `https://zoho-cda77-default-rtdb.firebaseio.com/.json`,
    `https://zoho-cda77-default-rtdb.asia-southeast1.firebasedatabase.app/.json`,
    `https://zoho-cda77.firebaseio.com/.json`
];

urls.forEach(u => {
    https.get(u, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => console.log(u, res.statusCode, b.substring(0, 100)));
    }).on('error', e => console.error(u, e.message));
});

