# MASTER EXECUTION DIRECTIVE FOR ANTIGRAVITY (SINGLE-RUN REPAIR)
**Repository:** `https://github.com/webmaskadevelopement-ship-it/ZOHO` (branch: `main`)
**Firebase Project:** `zoho-cda77`

## OBJECTIVE
Execute a complete, coordinated repair of Authentication, Role Mapping, Firebase Firestore Persistence, Dummy Data Cleanup, and Hosting Routing in **one systematic run**, verifying all existing and new tests before finishing.

---

## CRITICAL NON-NEGOTIABLE GUARDRAILS
1. **Preserve Configuration:** Do NOT overwrite, delete, or break any actual Firebase setup (`firebaseConfig`, `.firebaserc`, `zoho-cda77` project settings, valid API keys, or OAuth parameters).
2. **Preserve Core UI & Functionality:** Do NOT remove any core application features, dashboard views, project/task/issue modals, filters, or business logic in `src/public/app.js` or `src/modules/**`.
3. **Preserve Legitimate Live Data:** During database cleanup, purge ONLY known dummy/sample/mock entries. Retain all genuine user-created projects, tasks, and issues. If no genuine data exists after purging dummy data, initialize the system with clean empty states and seed ONLY the primary Admin (`webmaskadevelopement@gmail.com`) and Manager (`backend.webmaska@gmail.com`) accounts.
4. **Google-Only Authentication:** Remove all manual Name/Email/Role login forms, password forms, and demo persona chips (`SYSTEM_PERSONAS`). Only Google Sign-In via Firebase is permitted.
5. **Exact Role & Access Policy:**
   - `webmaskadevelopement@gmail.com` $\rightarrow$ **Admin** (`role: 'admin'`)
   - `backend.webmaska@gmail.com` $\rightarrow$ **Manager** (`role: 'manager'`)
   - **Any other valid Google account** authenticated via Firebase Google Sign-In $\rightarrow$ **Member** (`role: 'member'`), unless explicitly promoted to a higher role by an Admin in Firestore.
   - **Unauthenticated requests** (missing or invalid Firebase ID token) or fake/manual emails not backed by a real cryptographic Firebase Google ID token MUST be rejected (`401 Unauthorized`).

---

## STEP-BY-STEP EXECUTION SCRIPT FOR ANTIGRAVITY

### STEP 1: Backup & Baseline Verification
Run the following commands in the workspace terminal before modifying files:
```bash
# 1. Create a safety backup branch and database backup
git checkout -b fix/master-firebase-auth-persistence
mkdir -p backups
if [ -f data/life_pms.db ]; then
  cp data/life_pms.db "backups/life_pms.db.bak.$(date +%s)"
fi

# 2. Run baseline tests to record starting status
npm test || true
```

---

### STEP 2: Centralize Role Resolution & Firebase Token Verification (`src/middleware/auth.js` & `functions/src/modules/auth/authValidation.js`)
Update the backend authentication middleware and validation logic so that:
1. **Server-Side Token Verification:**
   - Every `/api/*` request (except `/api/health`) must include `Authorization: Bearer <firebaseIdToken>`.
   - Verify the token using `firebase-admin` (`admin.auth().verifyIdToken(idToken)`). Never trust `req.body.email`, `req.body.role`, or custom `x-user-*` headers without a verified Firebase token.
2. **Deterministic Role Assignment:**
   Create and use a single canonical role resolver across both `src/modules/auth/auth.controller.js`, `src/middleware/auth.js`, and `functions/src/modules/auth/authValidation.js`:
   ```javascript
   const ADMIN_EMAILS = new Set([
     'webmaskadevelopement@gmail.com',
     ...(process.env.INITIAL_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
   ]);

   const MANAGER_EMAILS = new Set([
     'backend.webmaska@gmail.com',
     ...(process.env.INITIAL_MANAGER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
   ]);

   function resolveAuthorizedRole(email, existingDbRole = null) {
     const normalized = String(email || '').trim().toLowerCase();
     if (!normalized) return null;
     if (ADMIN_EMAILS.has(normalized)) return 'admin';
     if (MANAGER_EMAILS.has(normalized)) return 'manager';
     if (existingDbRole && ['admin', 'manager', 'member'].includes(existingDbRole.toLowerCase())) {
       return existingDbRole.toLowerCase();
     }
     // Any valid Google-authenticated user defaults to 'member'
     return 'member';
   }
   ```
3. **Eliminate the "Not Invited" Block for Valid Google Users:**
   - In `functions/src/modules/auth/authValidation.js` (around lines 154–255) and `src/modules/auth/auth.controller.js` (around lines 64–73):
   - Remove the restriction that throws `"Not invited. Please contact admin or use invited email"` when a verified Google user signs in.
   - Instead, upon verifying the Google ID Token:
     - Determine role via `resolveAuthorizedRole(decodedToken.email, existingUser?.role)`.
     - Upsert the user into **Firebase Firestore (`users` collection, keyed by normalized email or UID)** and local SQLite cache with `{ uid, email, name, picture, role, status: 'active', lastLoginAt }`.
     - Return `{ success: true, user }` with the resolved role (`admin`, `manager`, or `member`).

---

### STEP 3: Enforce Google-Only Sign-In & Fix Mobile/Localhost Errors (`src/public/login.html` & `src/public/firebase-auth-client.js`)
1. **Clean `src/public/login.html`:**
   - Remove the manual Name/Email/Role login form, any email/password inputs, and the `SYSTEM_PERSONAS` array / demo persona chips.
   - Keep **only** the "Sign in with Google" button while preserving the existing page styling and layout.
   - **Remove the `http://localhost:5000` Fallback:** In `requestAuthApi` (around lines 376–436), remove the fallback to `http://localhost:5000` when `window.location.hostname` is not `localhost` or `127.0.0.1`. Always call relative `/api/...` on deployed domains. Never fall back to `SYSTEM_PERSONAS`.
2. **Fix Desktop Popup & Mobile Redirect in `src/public/firebase-auth-client.js`:**
   - Preserve the existing `firebaseConfig` (`projectId: "zoho-cda77"`).
   - Configure `GoogleAuthProvider` with `prompt: 'select_account'`.
   - On page load, call `getRedirectResult(auth)` first to handle mobile browser redirects cleanly.
   - When the user clicks "Sign in with Google", try `signInWithPopup(auth, provider)`. If it throws `auth/popup-blocked`, `auth/popup-closed-by-user`, or `auth/cancelled-popup-request` on mobile devices, automatically fall back to `signInWithRedirect(auth, provider)`.
   - After obtaining the Firebase `user`, fetch `const idToken = await user.getIdToken(true)` and send `Authorization: Bearer ${idToken}` to `/api/auth/google-login`.
3. **Attach Bearer Token in `src/public/app.js`:**
   - Ensure every API `fetch` request in `src/public/app.js` includes the `Authorization: Bearer <idToken>` header from the active Firebase session.
   - Remove any `http://localhost:5000` hardcoded fallback URLs in `src/public/app.js`.

---

### STEP 4: Make Firebase Firestore (`zoho-cda77`) the Permanent System of Record (`src/modules/integrations/` & Controllers)
Because SQLite on serverless hosting (Vercel / Netlify / Cloud Functions) is ephemeral and loses data on cold starts, update the persistence layer so **every action and change is permanently stored in Firebase Firestore (`zoho-cda77`)**:
1. **Verify Firebase Admin SDK Initialization (`src/modules/integrations/`):**
   - Ensure `firebase-admin` initializes with `projectId: 'zoho-cda77'` (using Application Default Credentials in Cloud Functions or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` environment variables on Vercel/Netlify).
2. **Full Firestore Read/Write Sync Across All Collections:**
   - Ensure all create, update, status change, comment, assignment, and delete operations across:
     - `users`
     - `projects`
     - `tasks`
     - `issues`
     - `invited_members`
     - `activity_logs` / `audit_logs`
     write **immediately (`await`)** to their corresponding Firestore collection in `zoho-cda77`.
   - On startup or cold start of the Express API (`src/` / `api/index.js` / `functions/`) or on `GET` requests, hydrate from Firestore (`zoho-cda77`) so data is **never lost** across refreshes, redeployments, or devices.
3. **Update `firestore.rules`:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isAuthenticated() {
         return request.auth != null && request.auth.token.email != null;
       }
       function isAdmin() {
         return isAuthenticated() && (
           request.auth.token.email == 'webmaskadevelopement@gmail.com' ||
           get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role == 'admin'
         );
       }
       function isManagerOrAdmin() {
         return isAdmin() || (
           isAuthenticated() && (
             request.auth.token.email == 'backend.webmaska@gmail.com' ||
             get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role == 'manager'
           )
         );
       }

       match /users/{userId} {
         allow read: if isAuthenticated();
         allow write: if isAdmin() || (isAuthenticated() && request.auth.token.email == userId);
       }
       match /invited_members/{inviteId} {
         allow read: if isAuthenticated();
         allow write: if isManagerOrAdmin();
       }
       match /projects/{projectId} {
         allow read: if isAuthenticated();
         allow create, update: if isAuthenticated();
         allow delete: if isManagerOrAdmin();
       }
       match /tasks/{taskId} {
         allow read, create, update: if isAuthenticated();
         allow delete: if isManagerOrAdmin();
       }
       match /issues/{issueId} {
         allow read, create, update: if isAuthenticated();
         allow delete: if isManagerOrAdmin();
       }
       match /{document=**} {
         allow read, write: if isAdmin();
       }
     }
   }
   ```

---

### STEP 5: Selective Database Cleanup (Purge Dummy Data, Retain Live Data, Seed Only Admin & Manager)
1. **Update `src/db/seedInvites.js` and `src/db/seed.js`:**
   - Remove all 5 dummy invites and all sample/mock users, projects, tasks, and issues from `src/db/seedInvites.js` and `src/db/seed.js`.
   - Replace automatic seeding with an idempotent bootstrap function that ensures **only** the two real accounts exist if not already present:
     - `webmaskadevelopement@gmail.com` (`role: 'admin'`, `name: 'Admin'`)
     - `backend.webmaska@gmail.com` (`role: 'manager'`, `name: 'Manager'`)
   - Do **not** seed any fake projects, tasks, or issues.
2. **Create and Run a One-Time Selective Cleanup Script (`scripts/cleanup-dummy-data.js`):**
   - Inspect both SQLite (`data/life_pms.db`) and Firestore (`zoho-cda77`).
   - Identify and delete **only** the known dummy/sample records (e.g., emails from `SYSTEM_PERSONAS`, `seedInvites.js`, `@example.com`, `@test.com`, `@lifepms.com`, and sample projects/tasks created by `src/db/seed.js`).
   - **Retain all valid, user-created projects, tasks, and issues.**
   - Upsert `webmaskadevelopement@gmail.com` (`role: 'admin'`) and `backend.webmaska@gmail.com` (`role: 'manager'`) in both SQLite and Firestore `users`.
3. **Remove Frontend Fallback Mock Arrays (`src/public/app.js`):**
   - In `src/public/app.js`, remove any hardcoded mock projects, tasks, or issues arrays that render when the database returns `[]`.
   - Render clean empty state messages instead (e.g., `"No projects yet. Click + New Project to start."`) while keeping all UI components and functions intact.

---

### STEP 6: Unify Hosting & API Routing (`netlify.toml`, `vercel.json`, `firebase.json`)
Ensure the frontend never hits a dead `/api/*` route on static hosting:
1. In `firebase.json`: ensure `/api/**` rewrites to the Cloud Function (`functions/`) or Express backend, and static files serve from `dist/` or `src/public/`.
2. In `vercel.json`: ensure `/api/(.*)` routes to `/api/index.js`.
3. In `netlify.toml`: ensure `/api/*` redirects (`status = 200`) to the active serverless backend URL so Netlify deployments (`b3013.netlify.app` / `sunny-dolphin-0b3013.netlify.app`) reach the real API instead of failing and triggering credential errors.

---

### STEP 7: Automated Verification & Test Suite
Before concluding the run, execute and verify all of the following:
1. Run the selective cleanup script:
   ```bash
   node scripts/cleanup-dummy-data.js
   ```
2. Update any test expectations in `tests/` that previously tested the old 5 dummy invites or blocked non-invited Google emails, and add tests verifying:
   - `webmaskadevelopement@gmail.com` logs in via Google and receives `role: 'admin'`.
   - `backend.webmaska@gmail.com` logs in via Google and receives `role: 'manager'`.
   - Any other valid Google account (`anyuser@gmail.com`) logs in via Google and receives `role: 'member'`.
   - Unauthenticated requests or manual non-Google logins are rejected (`401`).
   - Creating/updating a project, task, or issue writes directly to Firebase Firestore (`zoho-cda77`) and persists across server restarts.
   - Zero dummy users, projects, or tasks exist in the database or UI.
3. Run the full test suite and ensure **100% pass rate**:
   ```bash
   npm test
   ```
4. Output a final summary confirming each file modified, the cleanup counts (dummy records removed vs. live records retained), and the passing test results.