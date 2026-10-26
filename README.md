# Life Project Management System (Zoho Projects & Linear Alternative)

A complete, enterprise-grade, human-designed backend architecture and non-AI dashboard built directly from real-world SaaS workflows.

The system reconciles a strict **5-Level Work Breakdown Structure (WBS)** with dual work-item tracking (Tasks & Bugs), Role-Based Access Control (Admin, Manager, Employee, Client), live stopwatch timers, Earned Value Management (EVM), and deterministic "What-If" schedule simulation.

---

## 📸 Dashboard Screens (Exact Visual Reference)

The dashboard frontend is located in [`src/public`](file:///c:/Users/DELL/Documents/ZOHO/src/public) and is built using **clean, non-AI Vanilla JS/CSS** modeled directly after the user's reference designs:

1. **Global Dashboard (`Home`)**:
   - **6 Metric Cards**: `Open Tasks`, `Closed Tasks`, `Open Issues`, `Closed Issues`, `Open Phases`, `Closed Phases`.
   - **4 Core Widgets**: `My Tasks`, `My Issues`, `My Work Items Due Today`, `My Overdue Work Items`.
2. **Project Task Sheet (`WE-11 AI Training`)**:
   - Group by Task List: `Phase System (5)`, `RESEARCH SYSTEM (2)`, `CREATIVE DESIGN SYSTEM (1)`, `EDITING SYSTEM PRIORITY (1)`.
   - High-density rows with ID (`AE1-T42`), task name, owner avatar, green `Open` status pills, tags, start dates.
   - Quick action bar: `All Open ▾`, `List ▾`, `+ Add Task`, `⚡ Automation`.
3. **Task Detail Slide-Over Drawer**:
   - Click on **any** task row to open the right-side detail drawer.
   - Displays task ID badge (`AE1-T15`), title (`Stitch AI for Website Code`), `Internal | By Nikhil Kaushik | ⏱ 00:00:00 ▶`.
   - Live status selector, description accordion, and full task information matrix (Owner, Work Hours, Start/Due Dates, Duration, Priority, Completion %).
4. **Creative Labs**:
   - **What-If Flight Simulator**: Test milestone slips, developer leaves, and cost inflation with side-by-side Before vs After metrics and algorithmic prescriptive mitigations.
   - **Risk Radar & Health Pulse**: Single Point of Failure (SPOF) bottleneck detector and chokepoint task warnings.
   - **CPM Gantt Timeline & SVG Export**: Zero-slack Critical Path timeline with 1-click vector SVG download.

---

## 🔒 Role-Based Access Control (RBAC)

The system enforces strict role-based permission boundaries at the controller and database layer:

| Role | Permissions & Visibility | Data Scope |
|---|---|---|
| **Admin** (`Alex Director`) | Master access to all projects, user management, financial cost rates ($/hr), blueprints, and raw data ingestion. | **All Projects & Data** |
| **Manager** (`Sarah Jenkins`) | Project creation, WBS management, timesheet approvals, EVM budgeting, and What-If simulation. | **All Workspace Data** |
| **Employee** (`Nikhil Kaushik`) | Task execution, bug reporting, live stopwatch logging. Internal cost rates and profit margins masked. | **Internal Team Work** |
| **Client** (`Chloe Stakeholder`) | **Client Isolation Mode**: Strictly restricted to external-flagged deliverables. Timesheets, EVM budgets, internal sprint tasks, and employee hourly costs are masked at the API gateway layer. | **External Deliverables Only** |

---

## 📦 How to Insert Real Production Data

The backend includes a dedicated, clean ingestion engine that accepts real data without mixing with draft or dummy seed logic:

### Option 1: Direct from the Admin Dashboard (1-Click UI)
1. Sign in as **Admin** (`Alex Director`).
2. Click the **"📥 Ingest Data"** button in the top navigation bar.
3. Click **"📄 Load Verified Agency Template"** to preview the pre-configured structure (or paste your custom JSON).
4. Click **"Execute Ingestion"**. The backend performs an atomic SQLite transaction, updating all projects, task lists, and tasks in real-time!

### Option 2: Using the JSON Template & CLI Script
1. Open the production template:
   [`data/templates/real_data_template.json`](file:///c:/Users/DELL/Documents/ZOHO/data/templates/real_data_template.json)
2. Add your real company projects, task lists, tasks, issues, and users following the clean schema:
   ```json
   {
     "users": [
       { "id": "user-nikhil", "email": "nikhil@company.com", "name": "Nikhil Kaushik", "role": "employee" }
     ],
     "projects": [
       { "id": "proj-ai-training", "keyPrefix": "AE1", "name": "WE-11 AI Training", "budgetAmount": 45000 }
     ],
     "taskLists": [
       { "id": "list-phase-system", "projectId": "proj-ai-training", "name": "Phase System", "sequence": 1 }
     ],
     "tasks": [
       { "id": "task-ae1-t15", "projectId": "proj-ai-training", "taskListId": "list-phase-system", "prefixKey": "AE1-T15", "name": "Stitch AI for Website Code", "statusId": "in_progress", "ownerIds": ["user-nikhil"] }
     ]
   }
   ```
3. Run the import script:
   ```powershell
   npm.cmd run data:import
   ```
   *(Or specify a custom file: `node scripts/importRealData.js path/to/my_data.json`)*

### Option 3: Using the REST API
Administrators can POST real data payloads directly to:
```http
POST /api/v1/integrations/import-real-data
Authorization: Bearer <ADMIN_JWT_TOKEN>
x-portal-id: portal-demo-zoho
Content-Type: application/json

{
  "users": [...],
  "projects": [...],
  "taskLists": [...],
  "tasks": [...]
}
```

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```powershell
npm.cmd install
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` and fill in your settings:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key

# Real SMTP Email Settings (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Life PMS <notifications@lifepms.com>"

# Firebase Cloud Messaging & Service Account
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### 3. Run Automated Tests (34 Tests Across Local & Firebase)
```powershell
npm.cmd test
```

### 4. Start Server & Visual Dashboard
```powershell
npm.cmd start
```
Open **`http://localhost:5000`** in any web browser.

---

## 🔥 Google Firebase Cloud Stack & Auth (`zoho-cda77`)

The project is connected directly to your Firebase project **`zoho-cda77`**:
- **Firebase Auth (Client SDK)**: Initialized in [`src/public/firebase-auth-client.js`](file:///c:/Users/DELL/Documents/ZOHO/src/public/firebase-auth-client.js) with your project configuration:
  - Email & Password Sign-In & Sign-Up
  - Google Pop-up Sign-In
  - Auto-synchronization with Life PMS session & RBAC roles
- **Firebase Hosting**: Configured in [`firebase.json`](file:///c:/Users/DELL/Documents/ZOHO/firebase.json) and [`.firebaserc`](file:///c:/Users/DELL/Documents/ZOHO/.firebaserc):
  ```powershell
  firebase deploy --only hosting
  ```
- **Firebase Backend Token Verification**: `POST /api/v1/auth/firebase-login` in [`src/modules/auth/auth.controller.js`](file:///c:/Users/DELL/Documents/ZOHO/src/modules/auth/auth.controller.js) exchanges Firebase ID Tokens for authenticated user sessions.
- **Firebase Cloud Messaging (FCM)**: Push notifications dispatched via [`src/services/fcmNotificationService.js`](file:///c:/Users/DELL/Documents/ZOHO/src/services/fcmNotificationService.js).

---

## 🛠️ Module Architecture

```
src/
├── config/                  # Environment, SMTP, Firebase & GitHub settings
├── db/                      # SQLite database connection & schema
├── engines/                 # Pure algorithmic business logic
│   ├── criticalPathEngine.js      # CPM topological sort & float calculations
│   ├── scenarioSimulatorEngine.js # "What-If" project flight simulator
│   ├── riskRadarEngine.js         # Single Point of Failure (SPOF) & chokepoints
│   ├── evmEngine.js               # Earned Value Management (PV, EV, AC, CPI, SPI)
│   ├── slaEngine.js               # Defect SLA response/resolution timers
│   └── wbsRollupEngine.js         # 5-level recursive progress rollups
├── middleware/              # Auth, RBAC, Client Visibility, Error Handler
├── modules/                 # Modular domain controllers & services
├── public/                  # Clean, non-AI frontend dashboard (HTML, CSS, JS)
└── services/                # Real production infrastructure
    ├── dataIngestionService.js    # Production data importer
    ├── emailService.js            # SMTP transactional emails (nodemailer)
    ├── fcmNotificationService.js  # Firebase push notifications
    └── firebaseAuthService.js     # Firebase ID token verification
```
