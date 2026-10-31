const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '..', 'netlify', 'functions', 'api.js');
let code = fs.readFileSync(apiPath, 'utf8');

// 1. Ensure https is required
if (!code.includes("const https = require('https');")) {
    code = code.replace("const path = require('path');", "const path = require('path');\nconst https = require('https');");
}

// 2. Replace the store management block
const oldStorePattern = /\/\/\s*Multi-Tier Central Persistent Store across All Devices and Serverless Containers[\s\S]*?async function saveStore\(s\) \{[\s\S]*?console\.warn\('\[Netlify Blobs Write Notice\]:', e\.message\);\s*\}\s*\}\s*\}/;

const newStoreCode = `// Multi-Tier Central Persistent Store across All Devices and Serverless Containers
        const STORE_FILE = path.join('/tmp', 'life_pms_serverless_data.json');
        let _blobStore = null;

        const CLOUD_ENDPOINT = 'bright-bison-96116.upstash.io';
        const CLOUD_TOKEN = 'gQAAAAAAAXd0AQIgcDEwYTA2MDVmMzJlMzE0MTQ2OTE4ZDJkNGYxYTk2Y2NmMg';
        const MASTER_STORE_KEY = 'master_store';

        function runUpstashCommand(command) {
            return new Promise((resolve) => {
                try {
                    const postData = JSON.stringify(command);
                    const req = https.request({
                        hostname: CLOUD_ENDPOINT,
                        path: '/',
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + CLOUD_TOKEN,
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        },
                        timeout: 3500
                    }, res => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const parsed = JSON.parse(data);
                                resolve(parsed.result);
                            } catch (e) {
                                resolve(null);
                            }
                        });
                    });
                    req.on('error', (err) => {
                        console.warn('[Central Cloud Store] Notice:', err.message);
                        resolve(null);
                    });
                    req.on('timeout', () => {
                        req.destroy();
                        resolve(null);
                    });
                    req.write(postData);
                    req.end();
                } catch (e) {
                    resolve(null);
                }
            });
        }

        function getNetlifyBlobStore() {
            if (_blobStore) return _blobStore;
            try {
                const { getStore } = require('@netlify/blobs');
                _blobStore = getStore({
                    name: 'life_pms_production_database',
                    consistency: 'strong'
                });
                return _blobStore;
            } catch (e) {
                return null;
            }
        }

        async function loadStore() {
            // 1. Central Distributed Cloud Persistent Store (Upstash Redis HTTPS REST API - connects ALL Netlify instances, mobile phones & laptops)
            try {
                const cloudRaw = await runUpstashCommand(['GET', MASTER_STORE_KEY]);
                if (cloudRaw) {
                    const parsed = typeof cloudRaw === 'string' ? JSON.parse(cloudRaw) : cloudRaw;
                    if (parsed && typeof parsed === 'object') {
                        const cloudStore = {
                            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
                            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
                            taskLists: Array.isArray(parsed.taskLists) ? parsed.taskLists : [],
                            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                            phases: Array.isArray(parsed.phases) ? parsed.phases : [],
                            requests: Array.isArray(parsed.requests) ? parsed.requests : []
                        };
                        global._serverlessProjects = cloudStore.projects;
                        global._serverlessTasks = cloudStore.tasks;
                        global._serverlessTaskLists = cloudStore.taskLists;
                        global._serverlessIssues = cloudStore.issues;
                        global._serverlessPhases = cloudStore.phases;
                        global._serverlessRequests = cloudStore.requests;
                        return cloudStore;
                    }
                }
            } catch (e) {
                console.warn('[Cloud Store Read Notice]:', e.message);
            }

            // 2. Netlify Blobs (if available)
            const bStore = getNetlifyBlobStore();
            if (bStore) {
                try {
                    const data = await bStore.get('master_store', { type: 'json' });
                    if (data && typeof data === 'object') {
                        return {
                            projects: Array.isArray(data.projects) ? data.projects : [],
                            tasks: Array.isArray(data.tasks) ? data.tasks : [],
                            taskLists: Array.isArray(data.taskLists) ? data.taskLists : [],
                            issues: Array.isArray(data.issues) ? data.issues : [],
                            phases: Array.isArray(data.phases) ? data.phases : [],
                            requests: Array.isArray(data.requests) ? data.requests : []
                        };
                    }
                } catch (e) {
                    console.warn('[Netlify Blobs Read Notice]:', e.message);
                }
            }

            // 3. Fallback to /tmp filesystem
            try {
                if (fs.existsSync(STORE_FILE)) {
                    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
                    if (parsed && typeof parsed === 'object') {
                        return {
                            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
                            tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
                            taskLists: Array.isArray(parsed.taskLists) ? parsed.taskLists : [],
                            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
                            phases: Array.isArray(parsed.phases) ? parsed.phases : [],
                            requests: Array.isArray(parsed.requests) ? parsed.requests : []
                        };
                    }
                }
            } catch (e) { }

            // 4. Fallback to in-memory store
            return {
                projects: global._serverlessProjects || [],
                tasks: global._serverlessTasks || [],
                taskLists: global._serverlessTaskLists || [],
                issues: global._serverlessIssues || [],
                phases: global._serverlessPhases || [],
                requests: global._serverlessRequests || []
            };
        }

        async function saveStore(s) {
            global._serverlessProjects = s.projects;
            global._serverlessTasks = s.tasks;
            global._serverlessTaskLists = s.taskLists;
            global._serverlessIssues = s.issues;
            global._serverlessPhases = s.phases;
            global._serverlessRequests = s.requests;

            // 1. Write to /tmp
            try {
                fs.writeFileSync(STORE_FILE, JSON.stringify(s), 'utf8');
            } catch (e) { }

            // 2. Central Distributed Cloud Persistent Store (Upstash Redis HTTPS REST API)
            try {
                await runUpstashCommand(['SET', MASTER_STORE_KEY, JSON.stringify(s)]);
            } catch (e) {
                console.warn('[Cloud Store Write Notice]:', e.message);
            }

            // 3. Write to Netlify Blobs (if available)
            const bStore = getNetlifyBlobStore();
            if (bStore) {
                try {
                    await bStore.setJSON('master_store', s);
                } catch (e) {
                    console.warn('[Netlify Blobs Write Notice]:', e.message);
                }
            }
        }`;

if (oldStorePattern.test(code)) {
    code = code.replace(oldStorePattern, newStoreCode);
    console.log('✓ Replaced store functions in netlify/functions/api.js');
} else {
    console.warn('⚠️ Could not match oldStorePattern, checking fallback');
}

// 3. Ensure issues route safely fallbacks projectId
code = code.replace(
    "projectId: body.projectId,",
    "projectId: body.projectId || (store.projects && store.projects[0] ? store.projects[0].id : 'proj-general'),"
);

fs.writeFileSync(apiPath, code, 'utf8');
console.log('✓ Successfully patched netlify/functions/api.js');
