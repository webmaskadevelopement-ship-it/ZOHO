const db = require('../../db/database');
const TasksService = require('../tasks/tasks.service');
const IssuesService = require('../issues/issues.service');
const ProjectsService = require('../projects/projects.service');

class IntegrationsService {
    /**
     * Imports tasks from Zoho Projects or Jira JSON payload
     */
    static importProjectData(portalId, projectId, { source = 'zoho', items = [] }) {
        let importedCount = 0;

        return db.transaction(() => {
            // Find or create default import task list
            let list = db.queryOne('SELECT id FROM task_lists WHERE project_id = ? LIMIT 1', [projectId]);
            const listId = list.id;

            for (const item of items) {
                TasksService.createTask(portalId, {
                    projectId,
                    taskListId: listId,
                    name: item.name || item.summary || item.title || 'Imported Task',
                    descriptionHtml: item.description || '',
                    priority: item.priority?.toLowerCase() || 'medium',
                    startDate: item.startDate || item.start_date,
                    endDate: item.endDate || item.end_date,
                    duration: { value: item.duration || 1, type: 'days' }
                });
                importedCount++;
            }

            return {
                success: true,
                source,
                importedCount
            };
        });
    }

    /**
     * Exports complete project WBS and metadata in JSON or CSV format
     */
    static exportProjectData(portalId, projectId, format = 'json') {
        const project = ProjectsService.getProjectById(portalId, projectId);
        const phases = db.queryAll('SELECT * FROM phases WHERE project_id = ? ORDER BY sequence ASC', [projectId]);
        const taskLists = db.queryAll('SELECT * FROM task_lists WHERE project_id = ?', [projectId]);
        const tasks = TasksService.getTasks(portalId, projectId);
        const issues = IssuesService.getIssues(portalId, projectId);
        const timeLogs = db.queryAll('SELECT * FROM time_logs WHERE project_id = ?', [projectId]);

        if (format === 'csv') {
            // Generate CSV of Tasks
            const headers = ['PrefixKey', 'Name', 'Phase', 'TaskList', 'Priority', 'Status', 'CompletionPercent', 'StartDate', 'EndDate', 'Flag'];
            const rows = tasks.map(t => [
                `"${t.prefix_key}"`,
                `"${(t.name || '').replace(/"/g, '""')}"`,
                `"${t.phase_id || ''}"`,
                `"${t.task_list_id || ''}"`,
                `"${t.priority}"`,
                `"${t.status_id}"`,
                `"${t.completion_percentage}%"`,
                `"${t.start_date || ''}"`,
                `"${t.end_date || ''}"`,
                `"${t.flag}"`
            ].join(','));

            return [headers.join(','), ...rows].join('\n');
        }

        return {
            exportedAt: new Date().toISOString(),
            project,
            phases,
            taskLists,
            tasks,
            issues,
            timeLogs
        };
    }

    /**
     * Git Webhook Integration:
     * Parses commit message or PR body (e.g., "Fixes #BUG-1" or "Resolves #ZPA-101")
     */
    static handleGitWebhook(portalId, { commitMessage, commitSha, branch, author, projectId }) {
        const bugMatch = commitMessage.match(/(?:Fixes|Resolves|Closes)\s+#(BUG-\d+)/i);
        const taskMatch = commitMessage.match(/(?:Fixes|Resolves|Closes)\s+#([A-Z]{2,4}-\d+)/i);

        const actionsTaken = [];

        if (bugMatch) {
            const bugKey = bugMatch[1].toUpperCase();
            let issue = null;
            if (projectId) {
                issue = db.queryOne('SELECT id, project_id FROM issues WHERE prefix_key = ? AND portal_id = ? AND project_id = ? ORDER BY created_at DESC', [bugKey, portalId, projectId]);
            }
            if (!issue) {
                issue = db.queryOne('SELECT id, project_id FROM issues WHERE prefix_key = ? AND portal_id = ? ORDER BY created_at DESC', [bugKey, portalId]);
            }
            if (issue) {
                IssuesService.updateIssue(portalId, issue.id, {
                    statusId: 'closed',
                    descriptionHtml: `Automatically closed via commit ${commitSha} on branch ${branch} by ${author}.`
                });
                actionsTaken.push(`Closed issue ${bugKey}`);
            }
        }

        if (taskMatch) {
            const taskKey = taskMatch[1].toUpperCase();
            let task = null;
            if (projectId) {
                task = db.queryOne('SELECT id, project_id FROM tasks WHERE prefix_key = ? AND portal_id = ? AND project_id = ? ORDER BY created_at DESC', [taskKey, portalId, projectId]);
            }
            if (!task) {
                task = db.queryOne('SELECT id, project_id FROM tasks WHERE prefix_key = ? AND portal_id = ? ORDER BY created_at DESC', [taskKey, portalId]);
            }
            if (task) {
                TasksService.updateTask(portalId, task.id, {
                    statusId: 'completed',
                    completionPercentage: 100
                });
                actionsTaken.push(`Completed task ${taskKey}`);
            }
        }

        return {
            success: true,
            commitSha,
            actionsTaken
        };
    }

    /**
     * Returns the complete OpenAPI 3.0 specification for the platform
     */
    static getOpenApiSpec() {
        return {
            openapi: '3.0.3',
            info: {
                title: 'Life Project Management System API (Zoho Projects Alternative)',
                version: '1.0.0',
                description: 'Full-scale, enterprise-ready REST API for Life Project Management System featuring 5-level WBS, multi-tenancy, RBAC, EVM budgeting, issue tracking with SLAs, live timers, and automation blueprints.'
            },
            servers: [
                { url: 'http://localhost:5000/api/v1', description: 'Local Development Server' }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
                    apiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' }
                }
            },
            paths: {
                '/auth/register': { post: { summary: 'Register a new user account' } },
                '/auth/login': { post: { summary: 'Login and receive JWT session' } },
                '/portals': { get: { summary: 'List user portals' }, post: { summary: 'Create a new portal' } },
                '/projects': { get: { summary: 'List projects in portal' }, post: { summary: 'Create project' } },
                '/phases/project/{projectId}': { get: { summary: 'List phases (milestones)' } },
                '/task-lists/project/{projectId}': { get: { summary: 'List task lists' } },
                '/tasks/project/{projectId}': { get: { summary: 'List tasks with subtasks and dependencies' } },
                '/issues/project/{projectId}': { get: { summary: 'List defects/issues with SLAs' } },
                '/timesheets': { get: { summary: 'List time logs' }, post: { summary: 'Log hours' } },
                '/budgets/evm/{projectId}': { get: { summary: 'Get EVM performance metrics' } },
                '/views/sheet/{projectId}': { get: { summary: 'Get virtualized Task List Sheet tree' } },
                '/views/kanban/{projectId}': { get: { summary: 'Get Kanban board' } },
                '/views/gantt/{projectId}': { get: { summary: 'Get Gantt chart with critical path' } },
                '/reports/portfolio-summary': { get: { summary: 'Get portfolio executive summary' } }
            }
        };
    }
}

module.exports = IntegrationsService;
