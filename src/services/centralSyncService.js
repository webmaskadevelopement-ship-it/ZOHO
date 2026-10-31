/**
 * Central Cloud Synchronization Service
 * Provides durable, real-time cross-device synchronization connecting:
 * - Netlify Serverless Functions (AWS Lambda)
 * - Localhost Express Backend (SQLite)
 * - Mobile Phones, MacBook, Windows PC, and browser clients
 * 
 * Powered by globally distributed HTTPS REST Cloud Store (Upstash Redis)
 */

const https = require('https');

const CLOUD_ENDPOINT = 'bright-bison-96116.upstash.io';
const CLOUD_TOKEN = 'gQAAAAAAAXd0AQIgcDEwYTA2MDVmMzJlMzE0MTQ2OTE4ZDJkNGYxYTk2Y2NmMg';
const MASTER_KEY = 'master_store';

function runCloudCommand(command) {
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
                timeout: 4000
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
                console.warn('[CentralSync] Notice executing cloud command:', err.message);
                resolve(null);
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });

            req.write(postData);
            req.end();
        } catch (err) {
            console.warn('[CentralSync] Request creation notice:', err.message);
            resolve(null);
        }
    });
}

class CentralSyncService {
    static async getStore() {
        try {
            const raw = await runCloudCommand(['GET', MASTER_KEY]);
            if (raw) {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
        } catch (e) {
            console.warn('[CentralSync] getStore parse notice:', e.message);
        }
        return {
            projects: [],
            tasks: [],
            taskLists: [],
            issues: [],
            phases: [],
            requests: []
        };
    }

    static async saveStore(store) {
        if (!store || typeof store !== 'object') return false;
        try {
            const safeStore = {
                projects: Array.isArray(store.projects) ? store.projects : [],
                tasks: Array.isArray(store.tasks) ? store.tasks : [],
                taskLists: Array.isArray(store.taskLists) ? store.taskLists : [],
                issues: Array.isArray(store.issues) ? store.issues : [],
                phases: Array.isArray(store.phases) ? store.phases : [],
                requests: Array.isArray(store.requests) ? store.requests : []
            };
            const res = await runCloudCommand(['SET', MASTER_KEY, JSON.stringify(safeStore)]);
            return res === 'OK';
        } catch (e) {
            console.warn('[CentralSync] saveStore notice:', e.message);
            return false;
        }
    }

    static async syncProject(project) {
        if (!project || !project.id) return;
        try {
            const store = await this.getStore();
            const existingIdx = store.projects.findIndex(p => p.id === project.id);
            if (existingIdx >= 0) {
                store.projects[existingIdx] = { ...store.projects[existingIdx], ...project };
            } else {
                store.projects.unshift(project);
            }
            await this.saveStore(store);
        } catch (e) {}
    }

    static async syncTask(task) {
        if (!task || !task.id) return;
        try {
            const store = await this.getStore();
            const existingIdx = store.tasks.findIndex(t => t.id === task.id);
            if (existingIdx >= 0) {
                store.tasks[existingIdx] = { ...store.tasks[existingIdx], ...task };
            } else {
                store.tasks.unshift(task);
            }
            await this.saveStore(store);
        } catch (e) {}
    }

    static async syncIssue(issue) {
        if (!issue || !issue.id) return;
        try {
            const store = await this.getStore();
            const existingIdx = store.issues.findIndex(i => i.id === issue.id);
            if (existingIdx >= 0) {
                store.issues[existingIdx] = { ...store.issues[existingIdx], ...issue };
            } else {
                store.issues.unshift(issue);
            }
            await this.saveStore(store);
        } catch (e) {}
    }

    static async syncRequest(reqItem) {
        if (!reqItem || !reqItem.id) return;
        try {
            const store = await this.getStore();
            const existingIdx = store.requests.findIndex(r => r.id === reqItem.id);
            if (existingIdx >= 0) {
                store.requests[existingIdx] = { ...store.requests[existingIdx], ...reqItem };
            } else {
                store.requests.unshift(reqItem);
            }
            await this.saveStore(store);
        } catch (e) {}
    }
}

module.exports = CentralSyncService;

