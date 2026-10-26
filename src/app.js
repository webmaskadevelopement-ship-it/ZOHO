const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Import Controllers
const authController = require('./modules/auth/auth.controller');
const portalsController = require('./modules/portals/portals.controller');
const teamsController = require('./modules/teams/teams.controller');
const projectsController = require('./modules/projects/projects.controller');
const phasesController = require('./modules/phases/phases.controller');
const taskListsController = require('./modules/taskLists/taskLists.controller');
const tasksController = require('./modules/tasks/tasks.controller');
const issuesController = require('./modules/issues/issues.controller');
const timesheetsController = require('./modules/timesheets/timesheets.controller');
const budgetsController = require('./modules/budgets/budgets.controller');
const blueprintsController = require('./modules/blueprints/blueprints.controller');
const automationController = require('./modules/automation/automation.controller');
const collaborationController = require('./modules/collaboration/collaboration.controller');
const viewsController = require('./modules/views/views.controller');
const reportsController = require('./modules/reports/reports.controller');
const integrationsController = require('./modules/integrations/integrations.controller');
const rolesController = require('./modules/roles/roles.controller');
const customFieldsController = require('./modules/customFields/customFields.controller');
const invoicesController = require('./modules/invoices/invoices.controller');
const tagsController = require('./modules/tags/tags.controller');
const aiController = require('./modules/ai/ai.controller');
const WorkerRunner = require('./services/workers/workerRunner');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static frontend dashboard & API explorer
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(__dirname, '../data/uploads')));

// Dedicated /login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Life Project Management System Backend (Zoho Projects Alternative)',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// API Routes (v1)
app.use('/api/v1/auth', authController);
app.use('/api/v1/portals', portalsController);
app.use('/api/v1/teams', teamsController);
app.use('/api/v1/roles', rolesController);
app.use('/api/v1/projects', projectsController);
app.use('/api/v1/phases', phasesController);
app.use('/api/v1/task-lists', taskListsController);
app.use('/api/v1/tasks', tasksController);
app.use('/api/v1/issues', issuesController);
app.use('/api/v1/timesheets', timesheetsController);
app.use('/api/v1/budgets', budgetsController);
app.use('/api/v1/invoices', invoicesController);
app.use('/api/v1/custom-fields', customFieldsController);
app.use('/api/v1/blueprints', blueprintsController);
app.use('/api/v1/automation', automationController);
app.use('/api/v1/collaboration', collaborationController);
app.use('/api/v1/tags', tagsController);
app.use('/api/v1/views', viewsController);
app.use('/api/v1/reports', reportsController);
app.use('/api/v1/integrations', integrationsController);
app.use('/api/v1/ai', aiController);

// Manual trigger for background workers / cron tasks
app.post('/api/v1/workers/trigger', (req, res) => {
    const results = WorkerRunner.runAll();
    res.json({ success: true, results });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
