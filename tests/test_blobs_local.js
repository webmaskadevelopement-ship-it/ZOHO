const { getStore } = require('@netlify/blobs');

try {
    const store = getStore('test_store');
    console.log('Store initialized:', !!store);
} catch (e) {
    console.log('Local fallback triggered:', e.message);
}
