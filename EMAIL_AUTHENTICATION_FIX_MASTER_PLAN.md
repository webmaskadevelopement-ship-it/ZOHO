# EMAIL_AUTHENTICATION_FIX_MASTER_PLAN.md

**Project:** LIFE PMS (Project Management System)  
**Workspace:** `c:\Users\DELL\Documents\ZOHO`  
**Source Analysis:** [`AUTHENTICATION_ANALYSIS.md`](file:///c:/Users/DELL/Documents/ZOHO/AUTHENTICATION_ANALYSIS.md) (generated October 28, 2026)  
**Document Type:** Implementation-Ready Master Remediation Plan  
**Code Modification Status:** **None.** This document is a plan only.  
**Generated:** October 28, 2026  

---

## Table of Contents

1. [Scope, Sources, and Constraints](#1-scope-sources-and-constraints)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Complete Solution by Workstream](#4-complete-solution-by-workstream)
5. [Exact Code Changes (File-by-File)](#5-exact-code-changes-file-by-file)
6. [Backend Integration Contract](#6-backend-integration-contract)
7. [Security Hardening](#7-security-hardening)
8. [Implementation Order (Prioritized)](#8-implementation-order-prioritized)
9. [Testing Checklist](#9-testing-checklist)
10. [Deployment Guide](#10-deployment-guide)
11. [Missing Information That Must Be Verified](#11-missing-information-that-must-be-verified)
12. [Appendix: Reference Commands & Snippets](#12-appendix-reference-commands--snippets)

---

## 1. Scope, Sources, and Constraints

### 1.1 Scope

This master plan addresses every confirmed and secondary issue documented in `AUTHENTICATION_ANALYSIS.md` that affects:

- Invitation email delivery (local and production)
- SMTP / email-provider configuration
- Firebase Authentication email flows (verification, passwordless OOB)
- Backend Express/Node.js email dispatch
- Environment variable handling
- Netlify production API proxying
- Frontend error handling that masks backend failures
- Invitation token generation, storage, and acceptance
- Firestore security rules for invitation and email data

Authentication (Google Sign-In, email/password, JWT session, RBAC) is documented as fully operational in the source analysis. This plan preserves that working functionality and does not weaken it.

### 1.2 Sources

All recommendations are derived exclusively from:

- `AUTHENTICATION_ANALYSIS.md` (the only provided source of truth)
- File paths, function names, route paths, table names, and snippets quoted in that document

### 1.3 Constraints

- **Do not modify application code until this plan is reviewed and approved.**
- **Do not invent file names, functions, database paths, or root causes.** Where the source document does not expose a file or function, this plan explicitly marks it as *VERIFY*.
- **Preserve existing UI, design, and working functionality.**
- **Do not expose secrets** in source control, frontend bundles, or logs.
- **Do not weaken authentication.** All new endpoints must remain behind existing `authenticate` and `hasRole` middleware unless explicitly public (e.g., invitation acceptance by token).

### 1.4 Confirmed vs. Unverified Issues

| ID | Issue | Status per Source Document |
| :--- | :--- | :--- |
| RC-1 | Empty SMTP credentials → Ethereal sandbox | **CONFIRMED** |
| RC-2 | Netlify `/api/*` proxy 404 → static fallback simulates success | **CONFIRMED** |
| RC-3 | Firebase passwordless `EMAIL_SIGNIN` OOB disabled | **CONFIRMED** |
| RC-4 | Firestore unauthenticated REST calls blocked | **CONFIRMED** (already handled by SDK in `firebase-auth-client.js`) |
| RC-5 | Recipient spam / DMARC rejection | **UNVERIFIED** (external) |

---

## 2. Root Cause Analysis

### 2.1 RC-1 — Empty SMTP Credentials Force Ethereal Sandbox (CONFIRMED)

**Evidence chain:**

1. `AUTHENTICATION_ANALYSIS.md` §2.1 shows [`.env`](file:///c:/Users/DELL/Documents/ZOHO/.env) contains:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=
   SMTP_PASS=
   GMAIL_USER=
   GMAIL_APP_PASSWORD=
   ```
   Both the Gmail branch and the custom-SMTP branch in `createTransporter()` evaluate to false.

2. [`src/services/emailService.js`](file:///c:/Users/DELL/Documents/ZOHO/src/services/emailService.js) lines 31–64 fall through to:
   ```javascript
   const testAccount = await nodemailer.createTestAccount();
   return nodemailer.createTransport({
     host: 'smtp.ethereal.email',
     port: 587,
     auth: { user: testAccount.user, pass: testAccount.pass }
   });
   ```

3. Runtime verification against `GET /api/v1/portals/smtp-status` returns:
   ```json
   {
     "configured": true,
     "provider": "ethereal_sandbox",
     "host": "smtp.ethereal.email",
     "port": 587,
     "user": "alexandrine.reichel41@ethereal.email",
     "isTestAccount": true,
     "message": "Emails sent in this mode generate ethereal preview URLs and are NOT delivered to real inboxes."
   }
   ```

**Why invitations never arrive:** Nodemailer delivers the message to `smtp.ethereal.email`, which stores it and exposes a private preview URL. Ethereal is a development sandbox and **never relays to real SMTP recipients** (Gmail, Outlook, Yahoo, corporate mail). The recipient inbox is never contacted.

**Secondary defect:** `smtp-status` reports `"configured": true` even though the active provider is a test sandbox. This misleads operators into believing email is working.

---

### 2.2 RC-2 — Netlify API Proxy 404 + Static Fallback (CONFIRMED)

**Evidence chain:**

1. [`public/_redirects`](file:///c:/Users/DELL/Documents/ZOHO/public/_redirects) contains:
   ```
   /api/*  https://zoho-cda77.web.app/api/:splat  200
   ```

2. `https://zoho-cda77.web.app` is **Firebase Static Hosting**, not Cloud Run or Cloud Functions. No Express backend is attached. All `/api/*` requests return HTTP 404.

3. [`src/public/app.js`](file:///c:/Users/DELL/Documents/ZOHO/src/public/app.js) catches 404 and calls `handleStaticApi(endpoint, options)`, which returns:
   ```javascript
   return { success: true, message: 'Invitation sent (simulated offline mode)' };
   ```

**Why invitations "succeed" in production but nothing is sent:** The Netlify-hosted frontend sends `POST /api/v1/portals/invitations`, receives 404 from Firebase Hosting, falls back to a hardcoded simulated success, and displays a green notification. No backend is contacted; no Nodemailer instance is created; no email is queued.

**Impact scope:** Any deployed user on `https://dainty-bubblegum-a8f269.netlify.app` who sends an invitation sees a false positive. The same fallback also masks other backend failures.

---

### 2.3 RC-3 — Firebase Passwordless Sign-In Disabled (CONFIRMED)

**Evidence:** Google Identity Toolkit `accounts:sendOobCode` with `requestType: "EMAIL_SIGNIN"` returns:

```json
{
  "error": {
    "code": 400,
    "message": "OPERATION_NOT_ALLOWED",
    "errors": [{ "message": "OPERATION_NOT_ALLOWED", "domain": "global", "reason": "operationNotAllowed" }]
  }
}
```

**Important distinction:** This toggle affects **Firebase passwordless sign-in links only**. The source document states standard email verification is handled by `sendEmailVerification(auth.currentUser)` on the Firebase client SDK, which is independent of the passwordless toggle. Invitation emails in this project are generated and sent by the **backend** `emailService.js` using tokens stored in `invited_members`, **not** by Firebase OOB. Therefore RC-3 is **not** the cause of invitation-email failure; it is a separate authentication capability that should be enabled only if passwordless sign-in is a product requirement.

---

### 2.4 RC-4 — Firestore Unauthenticated REST Calls Blocked (CONFIRMED, Already Handled)

`firestore.rules` enforces `request.auth != null`. Direct REST calls without a Bearer token receive `403 PERMISSION_DENIED`. The source document confirms `firebase-auth-client.js` already uses the authenticated Firebase Client SDK, so this is not an active bug. It is included here because the rules must be **tightened further** (see §7) and because any future server-side Firestore access must use Firebase Admin credentials, not unauthenticated REST.

---

### 2.5 RC-5 — Recipient Spam / DMARC Rejection (UNVERIFIED, External)

Even after RC-1 is fixed, free Gmail SMTP sending automated invitations can be flagged by recipient filters if the sending domain lacks SPF/DKIM/DMARC alignment. This is **not confirmed** in the source document and must be tested empirically after RC-1 is fixed. The long-term fix is a dedicated transactional email provider (see §4.2).

---

### 2.6 RC-6 — Token-at-Rest Exposure in Firestore (Derived Security Finding)

The source document states `/invited_members/{inviteId}` has:
```
allow read, write: if request.auth != null;
```
and stores a `token` field. This means **any authenticated user** (including a `member` or `guest`) can read all invitation documents and their bearer tokens, then accept invitations on behalf of others or escalate roles. This is a security defect derived directly from the documented rule and field list. It is addressed in §7.2.

---

## 3. Target Architecture

### 3.1 High-Level Flow (Post-Fix)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Browser (Netlify-hosted UI)                          │
│  login.html / app.js / firebase-auth-client.js                              │
└───────────────┬──────────────────────────────────────────┬─────────────────┘
                │ HTTPS (same-origin /api/* via proxy)      │ Firebase Client SDK
                ▼                                           ▼
┌───────────────────────────────────────────┐   ┌─────────────────────────────┐
│  Express Backend (cloud-hosted)            │   │  Google Cloud Firestore      │
│  - authenticate (JWT)                      │   │  Project: zoho-cda77         │
│  - hasRole(['admin','manager'])            │   │  Region: asia-south2         │
│  - portals.controller / portals.service    │   │  Rules: authenticated + role │
│  - emailService.js                         │   └─────────────────────────────┘
│  - SQLite (data/life_pms.db)               │
└───────────────┬───────────────────────────┘
                │ SMTP (TLS 587 / 465)
                ▼
┌───────────────────────────────────────────┐
│  Email Provider                            │
│  Dev:  Ethereal (preview only)             │
│  Prod: Gmail App Password (quick start)    │
│        or SendGrid / Resend / Mailgun / SES│
│  DNS: SPF + DKIM + DMARC aligned           │
└───────────────┬───────────────────────────┘
                ▼
        Recipient Inbox (Gmail / Outlook / etc.)
```

### 3.2 Key Architectural Decisions

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| Invitation email sender | **Backend `emailService.js`** | Token is generated and stored server-side; backend already owns `invited_members`. Firebase OOB cannot use custom tokens. |
| Email verification sender | **Firebase Client SDK `sendEmailVerification`** | Already implemented per source; no backend change needed. |
| Passwordless sign-in | Optional; enable Firebase toggle only if product requires it | RC-3 is separate from invitation delivery. |
| Production email provider | Gmail App Password for immediate fix; transactional provider for scale | Gmail free tier caps ~500 recipients/day and has deliverability limits. |
| Invitation token storage | Hash at rest (SHA-256), send raw token only in email URL | Prevents DB/Firestore leak from granting invitation acceptance. |
| Frontend fallback | Remove simulated success for all mutation/email/auth endpoints | Fail loudly; preserve read-only cached fallbacks only. |
| API proxying | Netlify `_redirects` → live backend host | Firebase Hosting is static and cannot serve Express routes. |

---

## 4. Complete Solution by Workstream

### 4.1 Workstream A — Restore Real Email Delivery Locally (Fixes RC-1)

**Goal:** Make `POST /api/v1/portals/invitations` deliver real email from the local backend.

**Steps:**

1. **Generate a Google App Password** (only if using Gmail SMTP):
   - Enable 2-Step Verification on the sending Google account.
   - Create an App Password named `LIFE-PMS`.
   - Copy the 16-character value (spaces are ignored by Google; store without spaces).

2. **Populate `.env`** (see exact block in §5.1):
   ```ini
   GMAIL_USER=your_sending_account@gmail.com
   GMAIL_APP_PASSWORD=your16charapppassword
   ```

3. **Harden `emailService.js`** (see §5.3):
   - Cache the transporter.
   - Return explicit provider metadata.
   - **Throw in production** if no real provider is configured.
   - Permit Ethereal only when `NODE_ENV !== 'production'` **and** `ALLOW_ETHEREAL=true`.
   - Change `smtp-status` semantics so `configured` is `true` only for real providers.

4. **Restart the backend** and re-check `GET /api/v1/portals/smtp-status`. Expected:
   ```json
   { "configured": true, "provider": "gmail", "isTestAccount": false }
   ```

5. **Send a test invitation** from the local UI to a real inbox you control. Confirm arrival and inspect headers for SPF/DKIM/DMARC (see §9).

**Acceptance:** Real inbox receives the invitation; `emailService` logs `provider=gmail` and a non-null `messageId`.

---

### 4.2 Workstream B — Production-Grade Email Provider (Recommended, Fixes RC-5)

**Goal:** Reliable delivery at scale and correct authentication alignment.

**Why Gmail App Password is not sufficient long-term:**
- Free Gmail caps ~500 recipients/day (Workspace ~2,000).
- Sending domain (`gmail.com`) cannot carry your own SPF/DKIM/DMARC for `yourdomain.com`.
- Automated invitation volume can trigger account restrictions.

**Recommended providers (pick one):**

| Provider | Free Tier | SMTP Host | Auth User | Notes |
| :--- | :--- | :--- | :--- | :--- |
| SendGrid | 100/day | `smtp.sendgrid.net` | `apikey` | Mature; API key as password |
| Resend | 100/day | `smtp.resend.com` | `resend` | Modern; simple SMTP |
| Mailgun | Trial | `smtp.mailgun.org` | postmaster@domain | Good EU/US routing |
| AWS SES | Pay-per-use | `email-smtp.<region>.amazonaws.com` | IAM SMTP user | Requires sandbox exit |

**Steps:**

1. Create a provider account and verify your sending domain.
2. Add DNS records: **SPF**, **DKIM**, **DMARC** (start with `p=none`, then tighten to `p=quarantine`).
3. Populate `.env` using the custom-SMTP branch (already supported by `emailService.js`):
   ```ini
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASS=<provider_api_key>
   SMTP_FROM="LIFE PMS <no-reply@yourdomain.com>"
   ```
4. Leave `GMAIL_USER` / `GMAIL_APP_PASSWORD` blank so the Gmail branch is skipped.
5. Update `emailService.js` `from` field to use `SMTP_FROM` when present (see §5.3).

**Acceptance:** `smtp-status` reports `provider: "custom_smtp"`, `isTestAccount: false`, and a test message passes SPF/DKIM/DMARC checks at [mail-tester.com](https://www.mail-tester.com).

---

### 4.3 Workstream C — Fix Production API Proxying (Fixes RC-2)

**Goal:** Netlify `/api/*` reaches a live Express backend.

**Steps:**

1. **Deploy the Express backend** to a container host (Render, Railway, Fly.io, Google Cloud Run, or equivalent). The source document does not specify an existing host, so this is a *VERIFY/DECIDE* item.
2. **Set backend environment variables** on the host (see §10.1). Never commit `.env`.
3. **Update `public/_redirects`** (see §5.6):
   ```
   /api/*  https://<your-backend-host>/api/:splat  200
   /*      /index.html  200
   ```
   Preserve any existing SPA fallback rule; the source only documents the `/api/*` line.
4. **Confirm backend CORS** (see §5.8, *VERIFY* in `src/server.js`):
   - Because Netlify proxies same-origin, CORS may not be required for `/api/*`.
   - If the frontend ever calls the backend directly, allow only the Netlify origin(s).
5. **Rebuild and redeploy Netlify** so `_redirects` is copied into the publish directory (the source references `scripts/build.js`; *VERIFY* that it copies `public/_redirects`).
6. **Smoke test** from the deployed site:
   ```
   GET https://dainty-bubblegum-a8f269.netlify.app/api/v1/portals/smtp-status
   ```
   Must return JSON from the backend, not a 404 page.

**Acceptance:** Deployed invitation submission returns a backend-generated response with a real `messageId`, and the recipient receives email.

---

### 4.4 Workstream D — Remove False Success Fallback (Fixes RC-2 Frontend Half)

**Goal:** The UI must never claim an invitation was sent when the backend was unreachable.

**Steps:**

1. In [`src/public/app.js`](file:///c:/Users/DELL/Documents/ZOHO/src/public/app.js), change `apiFetch` so a 404 is **not** automatically treated as success.
2. Restrict `handleStaticApi` to **read-only** cached data (`projects`, `tasks`, `issues`).
3. For `/portals/invitations`, `/auth/*`, and any other mutation/email endpoint, return an explicit offline error and surface it in the UI.
4. Keep the existing `localStorage` mirrors (`life_pms_projects`, `life_pms_tasks`, `life_pms_issues`) untouched so offline read rendering still works.

See §5.5 for the exact replacement snippets.

**Acceptance:** With the backend intentionally stopped, submitting an invitation shows a red error ("Backend unreachable — no email was sent"), not a green success.

---

### 4.5 Workstream E — Firebase Authentication Email Flows (Addresses RC-3)

**Goal:** Enable passwordless sign-in only if required; keep standard email verification working.

**Steps:**

1. **Standard email verification (already implemented):**
   - `sendEmailVerification(auth.currentUser)` in `firebase-auth-client.js` continues to work without the passwordless toggle.
   - No backend change needed.
   - Ensure the Firebase Console → Authentication → Templates → Email address verification template is configured with a valid sender name and reply-to.

2. **Passwordless sign-in (only if product requires it):**
   - Firebase Console → project `zoho-cda77` → **Build → Authentication → Sign-in method → Email/Password**.
   - Enable **Email link (passwordless sign-in)** → Save.
   - Re-test `accounts:sendOobCode` with `requestType: "EMAIL_SIGNIN"`.

3. **Invitation emails remain backend-driven.** Do **not** replace the `invited_members` token flow with Firebase OOB, because:
   - The token must bind to the `invited_members` row and `portal_members` insertion.
   - Firebase OOB links cannot carry the backend role/portal context.

**Acceptance:** Verification emails arrive via Firebase; passwordless link generation succeeds **only if** the toggle was intentionally enabled.

---

### 4.6 Workstream F — Invitation Token Hardening (Derived Security Fix)

**Goal:** A leaked database or Firestore document must not allow invitation acceptance.

**Steps:**

1. In [`src/modules/portals/portals.service.js`](file:///c:/Users/DELL/Documents/ZOHO/src/modules/portals/portals.service.js), replace the current plaintext token generation:
   ```javascript
   const inviteToken = crypto.randomBytes(32).toString('hex');
   const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
   ```
   with a **raw + hash** pair (see §5.4).

2. **Schema migration** (SQLite `invited_members`):
   - Add `token_hash TEXT NOT NULL`.
   - Backfill existing rows: `UPDATE invited_members SET token_hash = token WHERE token_hash IS NULL;` (only acceptable as a one-time migration; new rows must never store the raw token).
   - Drop or stop writing the `token` column after migration.
   - *VERIFY* the exact migration mechanism used by `src/database/index.js`; the source does not document a migration runner.

3. **Email link construction** must use `process.env.APP_BASE_URL`:
   ```javascript
   const inviteUrl = `${process.env.APP_BASE_URL}/portal.html?token=${rawToken}`;
   ```
   `APP_BASE_URL` is **not documented** in the source `.env`. It must be added (see §11).

4. **Acceptance handler** must hash the incoming token and compare against `token_hash`:
   ```javascript
   const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
   // SELECT ... WHERE token_hash = ? AND status = 'pending' AND expires_at > datetime('now')
   ```
   Return a generic error for invalid/expired tokens (do not distinguish).

5. **Firestore sync** must write `token_hash` (or omit the token entirely). Never write the raw token to `/invited_members/{inviteId}`.

**Acceptance:** Reading `invited_members` in SQLite or Firestore reveals no usable bearer token; acceptance still works with the raw token from the email.

---

### 4.7 Workstream G — Firestore Rules Tightening (Derived Security Fix)

**Goal:** Invitation documents and submitted emails are not readable by every authenticated user.

**Steps:**

1. Replace the current `allow read, write: if request.auth != null;` on `/invited_members/{inviteId}` with admin/manager-only access (see §5.7).
2. Keep `/submitted_emails` create-only for public forms, but validate field names and string lengths.
3. Keep `/users`, `/projects`, `/tasks`, `/issues` authenticated, but consider per-document ownership in a later phase (*VERIFY* product requirements).
4. Deploy rules via Firebase CLI (`firebase deploy --only firestore:rules`) or the Firebase Console.

**Acceptance:** A `member`-role authenticated user receives `PERMISSION_DENIED` when reading `/invited_members/*`. An `admin`/`manager` can read them.

---

## 5. Exact Code Changes (File-by-File)

> **Reminder:** Do not apply these changes until the plan is approved. Paths and function names below are taken from the source document. Where the source does not expose surrounding code, the snippet is marked **ADAPT** and must be merged into the existing file without replacing unrelated logic.

### 5.1 `.env` (workspace root)

**Path:** [`c:\Users\DELL\Documents\ZOHO\.env`](file:///c:/Users/DELL/Documents/ZOHO/.env)  
**Change:** Populate real credentials and add missing operational variables.

```ini
# ── Runtime ─────────────────────────────────────────────
NODE_ENV=development
PORT=5000

# ── Public base URL used to build invitation links ──────
# Must be the deployed frontend origin in production.
APP_BASE_URL=http://localhost:5000

# ── Allowed browser origin for CORS (if direct calls) ───
CORS_ORIGIN=http://localhost:5000,https://dainty-bubblegum-a8f269.netlify.app

# ── Option A: Gmail SMTP (quick start) ──────────────────
GMAIL_USER=your_sending_account@gmail.com
GMAIL_APP_PASSWORD=your16charapppassword

# ── Option B: Transactional SMTP (preferred in prod) ────
# Leave GMAIL_* blank when using this block.
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="LIFE PMS <no-reply@yourdomain.com>"

# ── Ethereal guard ──────────────────────────────────────
# Set true ONLY in local development. Ignored when NODE_ENV=production.
ALLOW_ETHEREAL=false

# ── Existing auth secrets (do not print in logs) ────────
JWT_SECRET=<existing_value_unchanged>
FIREBASE_API_KEY=<existing_value_unchanged>
```

**Notes:**
- `APP_BASE_URL`, `CORS_ORIGIN`, `SMTP_FROM`, and `ALLOW_ETHEREAL` are **not documented** in the source `.env`. They are required by this plan; confirm they are not already used elsewhere before adding.
- Never commit `.env`. Add `.env` to `.gitignore` if not already present (*VERIFY*).

### 5.2 `.env.example` (create if absent — *VERIFY*)

**Path:** `c:\Users\DELL\Documents\ZOHO\.env.example`  
**Change:** Commit a redacted template with the same keys and empty values.

```ini
NODE_ENV=development
PORT=5000
APP_BASE_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:5000,https://dainty-bubblegum-a8f269.netlify.app

GMAIL_USER=
GMAIL_APP_PASSWORD=

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

ALLOW_ETHEREAL=false

JWT_SECRET=
FIREBASE_API_KEY=
```

### 5.3 `src/services/emailService.js`

**Path:** [`src/services/emailService.js`](file:///c:/Users/DELL/Documents/ZOHO/src/services/emailService.js)  
**Functions affected:** `createTransporter`, plus the exported status/send helpers used by `/api/v1/portals/smtp-status` and the invitation flow.  
**Change:** Replace the transporter factory with a cached, production-safe version. Keep the existing exported function names; only change internals.

```javascript
// ── ADAPT: keep existing imports; adjust logger path if different ──
const nodemailer = require('nodemailer');
const logger = require('../utils/logger'); // VERIFY actual logger module path

let cachedTransporter = null;
let cachedMeta = null;

function hasGmailConfig() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function hasCustomSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function isEtherealAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_ETHEREAL === 'true';
}

async function createTransporter() {
  if (cachedTransporter && cachedMeta) {
    return { transporter: cachedTransporter, meta: cachedMeta };
  }

  if (hasGmailConfig()) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    cachedMeta = {
      provider: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      isTestAccount: false,
    };
    return { transporter: cachedTransporter, meta: cachedMeta };
  }

  if (hasCustomSmtpConfig()) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    cachedMeta = {
      provider: 'custom_smtp',
      host: process.env.SMTP_HOST,
      port,
      isTestAccount: false,
    };
    return { transporter: cachedTransporter, meta: cachedMeta };
  }

  if (!isEtherealAllowed()) {
    throw new Error(
      'No email provider configured. Set GMAIL_USER/GMAIL_APP_PASSWORD or ' +
      'SMTP_HOST/SMTP_USER/SMTP_PASS. Ethereal is disabled outside local development.'
    );
  }

  logger.warn('[EMAIL] No real SMTP credentials found. Creating Ethereal sandbox (DEV ONLY).');
  const testAccount = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  cachedMeta = {
    provider: 'ethereal_sandbox',
    host: 'smtp.ethereal.email',
    port: 587,
    user: testAccount.user,
    isTestAccount: true,
  };
  return { transporter: cachedTransporter, meta: cachedMeta };
}

async function getTransporterStatus() {
  try {
    const { meta } = await createTransporter();
    return {
      configured: !meta.isTestAccount,
      ...meta,
      message: meta.isTestAccount
        ? 'Emails are NOT delivered to real inboxes (Ethereal sandbox).'
        : 'Real email delivery is active.',
    };
  } catch (err) {
    return { configured: false, provider: 'none', error: err.message };
  }
}

// ADAPT: merge into the existing sendInvitationEmail implementation.
async function sendInvitationEmail({ to, inviteUrl, role, invitedByName }) {
  const { transporter, meta } = await createTransporter();

  if (meta.isTestAccount) {
    logger.warn(`[EMAIL] Ethereal active. Invitation to ${to} will NOT be delivered.`);
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.GMAIL_USER,
    to,
    subject: 'You have been invited to LIFE PMS',
    html: `
      <p>Hello,</p>
      <p><strong>${escapeHtml(invitedByName)}</strong> invited you to LIFE PMS as <strong>${escapeHtml(role)}</strong>.</p>
      <p><a href="${escapeHtml(inviteUrl)}">Accept invitation</a></p>
      <p>This link expires in 7 days. If you did not expect this email, ignore it.</p>
    `,
  });

  logger.info(
    `[EMAIL] Invitation dispatched. provider=${meta.provider} messageId=${info.messageId} ` +
    `accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)}`
  );

  return info;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  // Preserve existing exports; add the new ones.
  createTransporter,
  getTransporterStatus,
  sendInvitationEmail,
};
```

**Important:** The source document does not list every export of `emailService.js`. Merge the new functions with the existing export object rather than replacing it wholesale.

### 5.4 `src/modules/portals/portals.service.js`

**Path:** [`src/modules/portals/portals.service.js`](file:///c:/Users/DELL/Documents/ZOHO/src/modules/portals/portals.service.js)  
**Functions affected:** invitation creation and invitation acceptance.  
**Change:** Hash tokens at rest and build the invite URL from `APP_BASE_URL`.

```javascript
const crypto = require('crypto');

function generateInvitationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

function hashInvitationToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function createInvitation({ email, role, invitedBy, portalId }) {
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // SQLite insert — adjust to the existing query style.
  // The old `token` column must no longer receive the raw token.
  db.prepare(`
    INSERT INTO invited_members (email, role, token_hash, status, invited_by, expires_at, created_at)
    VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'))
  `).run(email.toLowerCase().trim(), role, tokenHash, invitedBy, expiresAt);

  const inviteUrl = `${process.env.APP_BASE_URL}/portal.html?token=${rawToken}`;

  await sendInvitationEmail({
    to: email,
    inviteUrl,
    role,
    invitedByName: invitedBy,
  });

  // Firestore dual-sync: write token_hash only, never rawToken.
  await syncInviteToFirestore({ email, role, tokenHash, status: 'pending', expiresAt });

  return { success: true };
}

async function acceptInvitation({ token, userId, portalId }) {
  if (!token || typeof token !== 'string' || token.length !== 64) {
    return { success: false, error: 'Invalid or expired invitation.' };
  }

  const tokenHash = hashInvitationToken(token);
  const row = db.prepare(`
    SELECT * FROM invited_members
    WHERE token_hash = ? AND status = 'pending' AND expires_at > datetime('now')
  `).get(tokenHash);

  if (!row) {
    return { success: false, error: 'Invalid or expired invitation.' };
  }

  // Use a transaction so status update + member insert are atomic.
  const tx = db.transaction(() => {
    db.prepare(`UPDATE invited_members SET status = 'accepted' WHERE id = ?`).run(row.id);
    db.prepare(`
      INSERT OR IGNORE INTO portal_members (portal_id, user_id, role, joined_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(portalId, userId, row.role);
  });
  tx();

  return { success: true };
}
```

**Migration note:** The source documents an existing `token` column in `invited_members`. Add `token_hash` via the project's migration mechanism (*VERIFY* in `src/database/index.js`), backfill, then stop writing `token`. Do not drop the old column until all code paths are updated and tested.

### 5.5 `src/public/app.js`

**Path:** [`src/public/app.js`](file:///c:/Users/DELL/Documents/ZOHO/src/public/app.js)  
**Functions affected:** `apiFetch`, `handleStaticApi`.  
**Change:** Never simulate success for mutation/email/auth endpoints.

```javascript
// ADAPT: keep the existing URL/config construction above this block.
async function apiFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  let response;

  try {
    response = await fetch(buildUrl(endpoint), buildConfig(options));
  } catch (networkError) {
    return handleStaticApi(endpoint, options, 'network_error', networkError);
  }

  if (response.status === 404) {
    return handleStaticApi(endpoint, options, 404);
  }

  if (!response.ok) {
    let body = null;
    try { body = await response.json(); } catch (_) { /* ignore */ }
    return {
      success: false,
      error: (body && body.error) || `Request failed (HTTP ${response.status})`,
      status: response.status,
    };
  }

  return response.json();
}

function handleStaticApi(endpoint, options, status, cause) {
  const method = (options.method || 'GET').toUpperCase();
  const isEmailOrAuth = /\/portals\/invitations|\/auth\//.test(endpoint);

  if (isEmailOrAuth) {
    // Critical: never fake success for email or auth operations.
    return {
      success: false,
      offline: true,
      status: status || 'unavailable',
      error: `Backend unreachable (${status || 'network error'}). No email was sent and no account changes were made.`,
    };
  }

  // Read-only cached fallbacks only.
  if (method === 'GET' && endpoint.includes('/projects')) {
    return { success: true, data: JSON.parse(localStorage.getItem('life_pms_projects') || '[]'), offline: true };
  }
  if (method === 'GET' && endpoint.includes('/tasks')) {
    return { success: true, data: JSON.parse(localStorage.getItem('life_pms_tasks') || '[]'), offline: true };
  }
  if (method === 'GET' && endpoint.includes('/issues')) {
    return { success: true, data: JSON.parse(localStorage.getItem('life_pms_issues') || '[]'), offline: true };
  }

  return {
    success: false,
    offline: true,
    status: status || 'unavailable',
    error: 'Backend unreachable. This action requires a live connection.',
  };
}
```

**UI change:** In the invitation form handler, check `result.success === false` and display a red error toast. Do not display "Invitation sent successfully!" unless `result.success === true` **and** `result.offline !== true`.

### 5.6 `public/_redirects`

**Path:** [`public/_redirects`](file:///c:/Users/DELL/Documents/ZOHO/public/_redirects)  
**Change:** Point `/api/*` at the live backend.

```
/api/*  https://<your-backend-host>/api/:splat  200
/*      /index.html  200
```

**Notes:**
- Replace `<your-backend-host>` with the actual deployment host (Render/Railway/Cloud Run URL).
- The `/*  /index.html  200` SPA fallback is *preserved only if it already exists*; the source document only quotes the `/api/*` line. *VERIFY* the current file before editing.
- Status `200` on a proxy rewrite is correct for Netlify; do not change it to `301`/`302`.

### 5.7 `firestore.rules`

**Path:** [`firestore.rules`](file:///c:/Users/DELL/Documents/ZOHO/firestore.rules)  
**Change:** Restrict `invited_members` and `submitted_emails`; keep authenticated access for core collections.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isAdminOrManager() {
      return isSignedIn() && userDoc().role in ['admin', 'manager'];
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isAdminOrManager());
      allow write: if isSignedIn() && request.auth.uid == uid;
    }

    match /invited_members/{inviteId} {
      // Invitation acceptance is handled by the backend via token hash.
      // No client-side read of invitation tokens is permitted.
      allow read: if isAdminOrManager();
      allow create, update, delete: if isAdminOrManager();
    }

    match /submitted_emails/{id} {
      allow read: if isAdminOrManager();
      allow create: if request.resource.data.keys().hasOnly(['email', 'source', 'submitted_at', 'notes'])
        && request.resource.data.email is string
        && request.resource.data.email.size() <= 320;
    }

    match /projects/{projectId} {
      allow read, write: if isSignedIn();
    }

    match /tasks/{taskId} {
      allow read, write: if isSignedIn();
    }

    match /issues/{issueId} {
      allow read, write: if isSignedIn();
    }
  }
}
```

**Critical dependency:** `userDoc()` assumes a Firestore document exists at `/users/{request.auth.uid}` with a `role` field. The source confirms `/users/{uid}` documents exist and include `role`. If a user document is missing, `userDoc()` errors and the rule denies access. Ensure user creation writes the Firestore user document before role-gated operations.

**Behavioral change:** Invitees can no longer read `/invited_members/*` from the browser. This is intentional because acceptance is a backend endpoint (`POST /api/v1/portals/invitations/accept`). Test the acceptance flow thoroughly.

### 5.8 `src/server.js` — CORS and health check (*VERIFY then adapt*)

**Path:** [`src/server.js`](file:///c:/Users/DELL/Documents/ZOHO/src/server.js)  
**Change:** Confirm/add CORS allowlist and a health endpoint. The source document does not show the current contents of `server.js`, so this is **ADAPT**.

```javascript
// ADAPT: merge with existing middleware. Do not duplicate if already present.
const cors = require('cors');

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow same-origin/no-origin requests (Netlify proxy, server-to-server).
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Health check for Netlify/proxy verification.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
```

If the frontend only reaches the backend through the Netlify proxy, CORS can remain restrictive or disabled; the proxy makes requests same-origin. Keep the allowlist narrow regardless.

### 5.9 `src/modules/portals/portals.routes.js` — rate limiting (*VERIFY file exists*)

**Path:** `src/modules/portals/portals.routes.js` (*VERIFY* exact filename; the source references the controller/service but not the routes file name)  
**Change:** Rate-limit invitation creation and acceptance.

```javascript
// ADAPT to the existing router file.
const rateLimit = require('express-rate-limit');

const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // per IP per window; tune per product
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many invitation requests. Try again later.' },
});

router.post('/invitations', authenticate, hasRole(['admin', 'manager']), invitationLimiter, portalsController.createInvitation);
router.post('/invitations/accept', invitationLimiter, portalsController.acceptInvitation);
```

`express-rate-limit` is a new dependency; confirm it is not already installed before adding.

### 5.10 `src/public/firebase-auth-client.js` — no change required for invitations

**Path:** [`src/public/firebase-auth-client.js`](file:///c:/Users/DELL/Documents/ZOHO/src/public/firebase-auth-client.js)  
**Change:** None required for email delivery. Existing `sendEmailVerification(auth.currentUser)` remains. If passwordless sign-in is enabled, add the corresponding `sendSignInLinkToEmail` call **only** if the product requires it. Do not route invitation emails through Firebase OOB.

---

## 6. Backend Integration Contract

### 6.1 Invitation Creation — `POST /api/v1/portals/invitations`

**Auth:** `Authorization: Bearer <JWT>` required. Role: `admin` or `manager` (enforced by `hasRole`).  
**Request body:**
```json
{ "email": "recipient@example.com", "role": "member", "portalId": 1 }
```
**Backend sequence (must be transactional where possible):**

1. `authenticate` middleware validates JWT and confirms the user exists in SQLite.
2. `hasRole(['admin','manager'])` checks `req.user.role`.
3. `portals.service.createInvitation`:
   a. Normalize email (`toLowerCase().trim()`).
   b. Generate `rawToken` + `tokenHash` (SHA-256).
   c. Insert into SQLite `invited_members` with `token_hash`, `status='pending'`, `expires_at`.
   d. Build `inviteUrl = ${APP_BASE_URL}/portal.html?token=${rawToken}`.
   e. Call `emailService.sendInvitationEmail({ to, inviteUrl, role, invitedByName })`.
   f. If email send throws, mark the invitation `failed` (or roll back the insert) and return HTTP 502.
   g. On success, dual-sync a Firestore `/invited_members/{id}` document containing `token_hash` (never `rawToken`).
4. Respond `201 { success: true, message: 'Invitation sent.' }`.

**Response codes:**

| Code | Meaning |
| :--- | :--- |
| 201 | Invitation created and email dispatched |
| 400 | Invalid email or role |
| 401 | Missing/invalid JWT |
| 403 | Caller not admin/manager |
| 429 | Rate limit exceeded |
| 502 | Email provider rejected the message |

**Never return the raw token in the API response.** It must only appear in the email link.

### 6.2 Invitation Acceptance — `POST /api/v1/portals/invitations/accept`

**Auth:** Public endpoint (the token is the credential). Rate-limited.  
**Request body:** `{ "token": "<64-char hex>" }`  
**Backend sequence:**

1. Validate token format (64 hex chars).
2. Hash with SHA-256.
3. Query SQLite `invited_members` for matching `token_hash`, `status='pending'`, `expires_at > now`.
4. If not found → `400 { success: false, error: 'Invalid or expired invitation.' }` (generic; no distinction).
5. Transaction: set `status='accepted'`, insert into `portal_members`.
6. Update Firestore `/invited_members/{id}` status to `accepted` (Admin SDK or authenticated backend context).
7. Respond `200 { success: true }`.

**Note:** If the recipient is not yet authenticated, the frontend must first complete Firebase sign-in/registration, then call accept with the token. The backend must resolve `userId` from the authenticated session, not from the request body.

### 6.3 Email Provider Integration

- `emailService.js` is the single integration point. All callers use `sendInvitationEmail`.
- Provider selection order: Gmail → custom SMTP → Ethereal (dev only).
- Every send logs `provider`, `messageId`, `accepted`, `rejected` for auditability. Do not log credentials or full message bodies.
- `GET /api/v1/portals/smtp-status` must report `configured: false` when Ethereal is active. Update the controller that calls the status service accordingly (*VERIFY* the controller; the source references the endpoint response shape, not the controller file).

### 6.4 Database Consistency

- SQLite is the source of truth for invitation status and token hash.
- Firestore is a mirror for client-side reads; it must never contain the raw token.
- If Firestore sync fails, log the error but do not fail the invitation if the email was already sent. A retry job or reconciliation script is out of scope for this plan (*VERIFY* if one exists).

---

## 7. Security Hardening

### 7.1 Secrets Management

- Never commit `.env`. Confirm `.gitignore` includes `.env`, `.env.*`, and `data/*.db` (*VERIFY*).
- Set production secrets in the backend host's environment dashboard (Render/Railway/Cloud Run), **not** in Netlify's frontend build environment.
- Netlify environment variables are exposed to the browser bundle if referenced in client code. Do not put SMTP credentials or `JWT_SECRET` in Netlify env vars.
- Rotate the Gmail App Password or provider API key immediately if it is ever pasted into chat, logs, or source control.

### 7.2 Token Security

- Generate 32 random bytes (256 bits) via `crypto.randomBytes`.
- Store only SHA-256 hashes at rest in SQLite and Firestore.
- Compare hashes with a constant-time comparison if the DB driver does not already do so; for high-entropy tokens, direct equality on the hash is acceptable.
- Enforce 7-day expiry; reject expired tokens.
- Single-use: `status` transitions `pending → accepted`; accepted tokens cannot be reused.
- Never log raw tokens.
- Never return raw tokens in API responses.
- Never write raw tokens to Firestore.

### 7.3 Authorization

- Keep `authenticate` + `hasRole(['admin','manager'])` on invitation creation.
- Keep all existing RBAC mappings in [`src/config/roles.js`](file:///c:/Users/DELL/Documents/ZOHO/src/config/roles.js) unchanged.
- Do not allow `member` or `guest` to call invitation creation, even with a valid JWT.
- Acceptance endpoint is intentionally public but token-gated and rate-limited.

### 7.4 Firestore Rules

- `invited_members`: admin/manager read/write only.
- `submitted_emails`: public create with field validation; admin/manager read.
- `users`: self-read/write; admin/manager read others.
- Core project/task/issue rules remain authenticated; per-document ownership is a future hardening step (*VERIFY* product requirements).

### 7.5 Transport and Headers

- Enforce HTTPS on the backend host; Netlify is HTTPS by default.
- Add `helmet` if not already present (*VERIFY* in `src/server.js`).
- Set `app.set('trust proxy', 1)` behind Netlify/Render so rate limiting and IP logging see the real client IP.

### 7.6 Email Content

- Escape all user-controlled values in HTML (`escapeHtml`).
- Do not include sensitive data (passwords, JWT, full user records) in emails.
- Use a `from` address aligned with the authenticated sending domain (SPF/DKIM/DMARC).
- Provide a plain-text alternative for deliverability.

### 7.7 Error Handling

- Return generic errors for invalid/expired tokens (no user enumeration).
- Do not expose stack traces or provider errors to the client; log them server-side.
- Ensure `apiFetch` surfaces backend errors instead of masking them.

---

## 8. Implementation Order (Prioritized)

| Phase | Workstream | Action | Exit Criteria |
| :--- | :--- | :--- | :--- |
| **0** | Prerequisites | Verify all items in §11; confirm backend host choice; back up `data/life_pms.db` and export current Firestore rules | No unknowns block Phase 1 |
| **1** | A (RC-1) | Add real SMTP credentials to `.env`; harden `emailService.js`; restart backend; verify `smtp-status` reports a real provider | Local invitation arrives in a real inbox |
| **2** | D (RC-2 frontend) | Remove simulated success from `handleStaticApi`; surface offline errors in UI | Invitation fails visibly when backend is down |
| **3** | C (RC-2 proxy) | Deploy backend; update `public/_redirects`; rebuild Netlify; verify `/api/health` through the Netlify domain | Deployed invitation submission reaches the backend |
| **4** | F (token hardening) | Add `token_hash` migration; update `portals.service.js`; update Firestore sync; test acceptance | DB/Firestore contain no raw tokens; acceptance works |
| **5** | G (rules) | Deploy tightened `firestore.rules`; test admin/manager vs member access | Member cannot read `/invited_members/*` |
| **6** | E (Firebase) | Enable passwordless toggle only if required; verify standard email verification template | Verification email arrives; passwordless works if enabled |
| **7** | B (provider) | Move to transactional provider; add SPF/DKIM/DMARC; switch `.env`; retest | mail-tester score ≥ 9/10; inbox delivery confirmed |
| **8** | Security | Add rate limiting, helmet, CORS allowlist, log audit | Pen-test checklist passes |
| **9** | Testing | Execute §9 end-to-end | All checklist items pass |
| **10** | Deployment | Apply §10 production env vars and redeploy | Production invitation delivered and accepted |

**Do not skip Phase 1 before Phase 3.** Fixing the proxy without real SMTP credentials will simply move the failure from "404 simulation" to "Ethereal preview URL."

---

## 9. Testing Checklist

### 9.1 Local Email Delivery

- [ ] `.env` contains non-empty `GMAIL_USER` and `GMAIL_APP_PASSWORD` **or** valid `SMTP_*` values.
- [ ] `NODE_ENV=development`, `ALLOW_ETHEREAL=false`.
- [ ] `GET http://localhost:5000/api/v1/portals/smtp-status` returns `configured: true` and `isTestAccount: false`.
- [ ] Send invitation to a real Gmail address; email arrives in Inbox (not Spam).
- [ ] Inspect message headers: `Authentication-Results` shows `spf=pass`, `dkim=pass`, `dmarc=pass` (Gmail) or provider-equivalent.
- [ ] Backend logs show `provider=gmail` (or `custom_smtp`) and a non-empty `messageId`.
- [ ] Invitation link opens `portal.html?token=<64-hex>`.

### 9.2 Local Failure Modes

- [ ] With `.env` credentials blank and `NODE_ENV=development`, `ALLOW_ETHEREAL=false`: invitation request returns an explicit error; no Ethereal preview is generated.
- [ ] With `ALLOW_ETHEREAL=true` in development: Ethereal preview URL is logged, and the UI clearly indicates test mode.
- [ ] With `NODE_ENV=production` and blank credentials: backend refuses to create a transporter (throws); endpoint returns HTTP 502/500 with a generic error.

### 9.3 Invitation Acceptance

- [ ] Valid token → `200 { success: true }`; `invited_members.status='accepted'`; row inserted in `portal_members`.
- [ ] Reusing the same token → `400 Invalid or expired invitation.`
- [ ] Expired token (manually set `expires_at` in the past) → `400`.
- [ ] Malformed token (not 64 hex) → `400`.
- [ ] Token from a different portal/user cannot be used to join another portal (*VERIFY* if portal binding is enforced; if not, add `portal_id` to the token lookup).
- [ ] Firestore `/invited_members/{id}` contains `token_hash`, never `rawToken`.

### 9.4 Frontend Fallback

- [ ] With backend stopped, submitting an invitation shows a red error and does **not** show "Invitation sent successfully!"
- [ ] With backend stopped, `GET /projects` still renders cached data from `localStorage` with an offline indicator.
- [ ] With backend stopped, `GET /auth/me` does not silently succeed; the user is logged out or shown an error.

### 9.5 Production Proxy

- [ ] `GET https://dainty-bubblegum-a8f269.netlify.app/api/health` returns `{ status: 'ok' }`.
- [ ] `GET https://dainty-bubblegum-a8f269.netlify.app/api/v1/portals/smtp-status` returns JSON from the backend (not a 404 page).
- [ ] Deployed invitation submission reaches the backend (check backend logs for the request).
- [ ] Recipient receives the email.
- [ ] No CORS errors in the browser console.

### 9.6 Firebase Authentication

- [ ] Google Sign-In still works end-to-end (`signInWithPopup` → `/api/v1/auth/google-login` → JWT).
- [ ] Email/password login still works.
- [ ] `sendEmailVerification` delivers a verification email to a new Firebase user.
- [ ] If passwordless is enabled: `accounts:sendOobCode` with `EMAIL_SIGNIN` returns 200.
- [ ] If passwordless is not required: the toggle remains off and no code calls `sendSignInLinkToEmail`.

### 9.7 Firestore Rules

- [ ] Admin user can read `/invited_members/*`.
- [ ] Manager user can read `/invited_members/*`.
- [ ] Member user receives `PERMISSION_DENIED` reading `/invited_members/*`.
- [ ] Unauthenticated read of `/invited_members/*` is denied.
- [ ] Public `submitted_emails` create succeeds with valid fields; rejected with extra fields or oversized email.
- [ ] `/users/{uid}` self-read succeeds; cross-user read denied unless admin/manager.

### 9.8 Security

- [ ] No secrets appear in `git log`, frontend bundles, or console output.
- [ ] Invitation endpoint returns `429` after the configured rate limit.
- [ ] Invalid JWT returns `401`; member JWT returns `403` on invitation creation.
- [ ] Error responses do not leak stack traces or provider messages.
- [ ] `helmet` headers present (if enabled).
- [ ] HTTPS enforced on backend host.

---

## 10. Deployment Guide

### 10.1 Backend Host Environment Variables

Set these on the backend hosting platform (Render/Railway/Cloud Run/etc.), **not** in Netlify:

```ini
NODE_ENV=production
PORT=<platform-provided or 5000>
APP_BASE_URL=https://dainty-bubblegum-a8f269.netlify.app
CORS_ORIGIN=https://dainty-bubblegum-a8f269.netlify.app

# Choose one provider block:
GMAIL_USER=
GMAIL_APP_PASSWORD=
# OR
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="LIFE PMS <no-reply@yourdomain.com>"

ALLOW_ETHEREAL=false
JWT_SECRET=<existing production secret>
FIREBASE_API_KEY=<existing value>
```

**Important:** `APP_BASE_URL` must be the **frontend** origin because it is used to build the invitation link. If the backend serves `portal.html` itself in local development, use `http://localhost:5000`.

### 10.2 Netlify Configuration

- **Build command / publish directory:** *VERIFY* the existing Netlify settings. The source references `scripts/build.js`; confirm it copies `public/_redirects` into the publish directory.
- **Environment variables:** Do not add SMTP or JWT secrets to Netlify. Only `PUBLIC_*`/`VITE_*` values that are safe to expose may be set here.
- **Redirects:** After updating `public/_redirects`, trigger a fresh deploy and verify the deployed `_redirects` file is present in the publish output.

### 10.3 Firebase Console Changes

1. **Project:** `zoho-cda77`.
2. **Authentication → Sign-in method → Email/Password:**
   - Standard email/password: keep enabled.
   - Email link (passwordless): enable **only if** product requires it.
3. **Authentication → Templates:**
   - Configure "Email address verification" sender name and reply-to.
   - If passwordless is enabled, configure the "Email link sign-in" template.
4. **Firestore → Rules:** Paste the updated `firestore.rules` and publish.
5. **Firestore → Indexes:** No new composite indexes are expected for the rules above. *VERIFY* if `userDoc()` role lookups require an index (single-document `get()` does not).
6. **Authorized domains:** Confirm `dainty-bubblegum-a8f269.netlify.app` and the backend host are listed under Authentication → Settings → Authorized domains if OAuth redirects are used.

### 10.4 DNS Records (Transactional Provider)

| Record | Purpose | Example |
| :--- | :--- | :--- |
| `TXT @` | SPF | `v=spf1 include:sendgrid.net ~all` |
| `CNAME` / `TXT` | DKIM | Provider-issued selector |
| `TXT _dmarc` | DMARC | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` |

Start DMARC at `p=none`, monitor reports for 1–2 weeks, then move to `p=quarantine`.

### 10.5 Deployment Sequence

1. Back up `data/life_pms.db` and export current Firestore rules.
2. Apply Phase 1 (local SMTP) and verify locally.
3. Apply Phase 4 (token hash) and run the SQLite migration locally; verify acceptance.
4. Deploy backend with production env vars; verify `/api/health`.
5. Update `public/_redirects`; rebuild and deploy Netlify.
6. Publish Firestore rules.
7. Execute §9.5 and §9.7 against production.
8. Monitor backend logs for `[EMAIL]` entries and 4xx/5xx rates for 24 hours.
9. Roll back by reverting `_redirects`, env vars, and rules if delivery fails; the SQLite migration is forward-compatible (raw `token` column retained until Phase 4 is confirmed stable).

---

## 11. Missing Information That Must Be Verified

The source document does not establish the following. **Do not implement dependent changes until each is confirmed.**

1. **`APP_BASE_URL` existence:** No environment variable in the documented `.env` is used to build the invitation link. Verify how `portals.service.js` currently constructs the link. If it hardcodes a URL, replace it with `APP_BASE_URL`.
2. **`src/server.js` contents:** CORS configuration, `helmet`, `trust proxy`, and health endpoint are not documented. Verify before adding §5.8.
3. **`portals.routes.js` file name and current middleware chain:** The source references the controller/service but not the router file name. Verify before adding rate limiting.
4. **`express-rate-limit` and `helmet` dependencies:** Check `package.json` before adding.
5. **SQLite migration mechanism:** `src/database/index.js` is referenced but its migration approach is not documented. Determine whether migrations are additive SQL, a version table, or manual. The `token_hash` migration depends on this.
6. **`scripts/build.js` behavior:** Confirm it copies `public/_redirects` to the Netlify publish directory.
7. **Netlify build command and publish directory:** Not documented.
8. **Backend hosting target:** No production backend host is documented. Choose one before Phase 3.
9. **Firestore write path for invitations:** The source says the client dual-syncs invite docs (`Browser->>FS: Dual-Sync invite doc`). Confirm whether the browser or the backend writes `/invited_members`. If the browser writes it, the raw token may already be in the client; the backend must own this write after Phase 4.
10. **Firestore user document creation timing:** `firestore.rules` `userDoc()` requires `/users/{uid}` to exist with a `role`. Confirm the order of user creation vs. role-gated operations.
11. **Portal binding on invitation acceptance:** The source's acceptance query does not show a `portal_id` filter. Verify whether an invitation is scoped to a portal; if not, add it to prevent cross-portal acceptance.
12. **Existing `.env.example` and `.gitignore`:** Verify presence and contents.
13. **`emailService.js` full export surface and logger path:** The source quotes only `createTransporter`. Verify the logger import path and existing exports before merging §5.3.
14. **Current `smtp-status` controller:** The source quotes the JSON response but not the controller file. Update the controller to use `getTransporterStatus()` and ensure `configured` is `false` for Ethereal.
15. **Whether `sendEmailVerification` is actually invoked on signup:** The source states it is; verify in `firebase-auth-client.js` before declaring RC-3 fully resolved.
16. **Recipient spam behavior:** RC-5 is unverified. Test after Phase 1 before investing in a transactional provider.

---

## 12. Appendix: Reference Commands & Snippets

### 12.1 Local Verification Commands

```powershell
# From c:\Users\DELL\Documents\ZOHO

# Restart backend
node src/server.js

# Check SMTP status
curl.exe http://localhost:5000/api/v1/portals/smtp-status

# Health check
curl.exe http://localhost:5000/api/health
```

```powershell
# Inspect SQLite invitation rows (read-only)
# Use the project's existing better-sqlite3 tooling or DB browser.
# Do NOT print token hashes in shared logs.
```

### 12.2 Generate a Test Invitation Token (Node REPL)

```javascript
const crypto = require('crypto');
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
console.log('Raw (email link):', rawToken);
console.log('Hash (DB):', tokenHash);
```

### 12.3 Firebase CLI Rule Deployment

```bash
firebase deploy --only firestore:rules --project zoho-cda77
```

### 12.4 Mail-Tester Workflow

1. Send an invitation to the address provided by [mail-tester.com](https://www.mail-tester.com).
2. Check the score and the SPF/DKIM/DMARC section.
3. Fix DNS or provider settings until the score is ≥ 9/10.

### 12.5 Rollback Checklist

- [ ] Revert `public/_redirects` to the previous content and redeploy Netlify.
- [ ] Revert backend env vars to the last known working set.
- [ ] Re-publish the previous `firestore.rules`.
- [ ] Keep the `token_hash` column and dual-write until acceptance is confirmed stable; do not drop `token` prematurely.
- [ ] Restore `data/life_pms.db` from backup only if the migration corrupts data (last resort).

---

## Conclusion

The invitation-email failure is **not** a single bug. It is the combined result of:

1. **Missing SMTP credentials** causing the backend to silently use the non-delivering Ethereal sandbox (RC-1).
2. **A broken production proxy** causing the deployed frontend to receive 404 and fabricate a success response (RC-2).
3. **A frontend fallback** that converts backend failure into a false positive (RC-2 frontend half).
4. **Separate Firebase configuration** for passwordless sign-in (RC-3), which is not the cause of invitation failure but must be handled if that feature is required.
5. **Derived security weaknesses** in token storage and Firestore rules that should be fixed alongside the delivery repair (RC-6).

Fixing Phase 1 (real SMTP) and Phase 3 (live backend proxy) restores end-to-end delivery. Phases 4–7 ensure the fix is secure, scalable, and maintainable. Every code change above is anchored to a file, function, or configuration value documented in `AUTHENTICATION_ANALYSIS.md`; items the source does not establish are explicitly marked **VERIFY** in §11.

**Do not modify application code until this plan is reviewed and the §11 items are confirmed.**
