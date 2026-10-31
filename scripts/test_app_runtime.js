const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing app.js initialization in simulated browser environment...');

const appJsCode = fs.readFileSync(path.join(__dirname, '../src/public/app.js'), 'utf8');

// Mock localStorage
const storage = {
    'life_pms_token': 'fake-test-token',
    'life_pms_user': JSON.stringify({
        id: 'efac5612-9ff8-4f2a-884d-46ff5e470584',
        name: 'Ravi Bhadoria',
        username: 'ravi.bhadoria',
        email: 'ravi.bhadoria@zoho.com',
        role: 'employee'
    })
};

// Fake DOM element generator
function createMockElement(tag, id = '', className = '') {
    return {
        tagName: tag.toUpperCase(),
        id,
        className,
        classList: {
            add: () => {},
            remove: () => {},
            toggle: () => {},
            contains: () => false
        },
        style: {},
        children: [],
        addEventListener: (event, handler) => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        getAttribute: (attr) => (attr === 'data-task-view' ? 'sheet' : ''),
        querySelector: () => createMockElement('div'),
        querySelectorAll: () => [],
        appendChild: () => {},
        focus: () => {},
        click: () => {},
        contains: () => false,
        textContent: '',
        innerHTML: '',
        value: ''
    };
}

const domListeners = {};

const sandbox = {
    console: {
        log: (...args) => console.log('[VM Log]', ...args),
        warn: (...args) => console.log('[VM Warn]', ...args),
        error: (...args) => console.error('[VM Error]', ...args)
    },
    localStorage: {
        getItem: (k) => storage[k] || null,
        setItem: (k, v) => { storage[k] = v; },
        removeItem: (k) => { delete storage[k]; }
    },
    sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    },
    window: {
        location: { href: 'http://localhost:5000/', hash: '', search: '', origin: 'http://localhost:5000' },
        addEventListener: () => {},
        firebaseAuthClient: null
    },
    document: {
        addEventListener: (event, cb) => {
            domListeners[event] = domListeners[event] || [];
            domListeners[event].push(cb);
        },
        getElementById: (id) => createMockElement('div', id),
        querySelectorAll: () => [createMockElement('div')],
        querySelector: (sel) => createMockElement('div'),
        createElement: (tag) => createMockElement(tag)
    },
    fetch: async (url, opts) => ({
        status: 200,
        ok: true,
        json: async () => ({ success: true, data: [] })
    }),
    navigator: {
        clipboard: {
            writeText: async () => {}
        }
    },
    alert: (msg) => console.log('[VM Alert]', msg),
    setTimeout: (fn) => fn(),
    setInterval: () => 1,
    clearInterval: () => {}
};

sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
sandbox.window.sessionStorage = sandbox.sessionStorage;

try {
    vm.createContext(sandbox);
    vm.runInContext(appJsCode, sandbox);
    console.log('✓ app.js parsed and executed without throwing any top-level exceptions');

    // Trigger DOMContentLoaded
    if (domListeners['DOMContentLoaded']) {
        console.log(`Triggering ${domListeners['DOMContentLoaded'].length} DOMContentLoaded listener(s)...`);
        for (const fn of domListeners['DOMContentLoaded']) {
            fn();
        }
        console.log('✓ DOMContentLoaded executed cleanly with zero unhandled exceptions!');
    }
} catch (err) {
    console.error('❌ Exception in app.js:', err);
    process.exit(1);
}

