const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const WbsRollupEngine = require('../engines/wbsRollupEngine');

async function seed() {
    console.log('🌱 Starting database seeding for Life Project Management System...');

    // Clean existing data
    db.exec(`
        DELETE FROM notifications;
        DELETE FROM comments;
        DELETE FROM files;
        DELETE FROM wiki_pages;
        DELETE FROM discussions;
        DELETE FROM chat_rooms;
        DELETE FROM time_logs;
        DELETE FROM active_timers;
        DELETE FROM expenses;
        DELETE FROM invoices;
        DELETE FROM issues;
        DELETE FROM tasks;
        DELETE FROM task_lists;
        DELETE FROM phases;
        DELETE FROM projects;
        DELETE FROM project_groups;
        DELETE FROM teams;
        DELETE FROM leave_records;
        DELETE FROM blueprints;
        DELETE FROM automation_rules;
        DELETE FROM webhooks;
        DELETE FROM custom_views;
        DELETE FROM custom_fields;
        DELETE FROM audit_logs;
        DELETE FROM portal_members;
        DELETE FROM client_companies;
        DELETE FROM users;
        DELETE FROM portals;
    `);

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Create Portal
    const portalId = 'portal-demo-zoho';
    db.execute(
        `INSERT INTO portals (id, name, slug, custom_domain, logo_url, business_hours, holidays, currency, created_at, updated_at)
         VALUES (?, 'Acme Global Workspace', 'acme', 'pms.acme.com', 'https://cdn.example.com/logo.png',
                 '{"workingDays":[1,2,3,4,5],"startHour":"09:00","endHour":"18:00","timezone":"UTC"}',
                 '[{"name":"New Year","date":"2026-01-01"},{"name":"Independence Day","date":"2026-07-04"}]',
                 'USD', ?, ?)`,
        [portalId, now, now]
    );

    // 2. Client Company
    const clientCompanyId = 'client-company-acme';
    db.execute(
        `INSERT INTO client_companies (id, portal_id, name, email, phone, address, currency, created_at)
         VALUES (?, ?, 'Acme Enterprise Corp', 'billing@acme.com', '+1-555-0199', '100 Silicon Way, CA', 'USD', ?)`,
        [clientCompanyId, portalId, now]
    );

    // 3. Create Users
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const users = [
        { id: 'user-admin', email: 'admin@lifepms.com', name: 'Alex Director (Admin)', role: 'admin', cost: 90, billable: 160, dept: 'Executive' },
        { id: 'user-manager', email: 'manager@lifepms.com', name: 'Sarah Jenkins (PM)', role: 'manager', cost: 70, billable: 130, dept: 'Product' },
        { id: 'user-dev', email: 'dev@lifepms.com', name: 'Devon Vance (Lead Dev)', role: 'employee', cost: 55, billable: 110, dept: 'Engineering' },
        { id: 'user-qa', email: 'qa@lifepms.com', name: 'Quinn Adams (QA Lead)', role: 'employee', cost: 45, billable: 95, dept: 'QA' },
        { id: 'user-client', email: 'client@acme.com', name: 'Chloe Stakeholder (Client)', role: 'client', cost: 0, billable: 0, dept: 'Client' }
    ];

    for (const u of users) {
        db.execute(
            `INSERT INTO users (id, email, password_hash, name, role, cost_per_hour, billable_rate_per_hour, department, client_company_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.email, passwordHash, u.name, u.role, u.cost, u.billable, u.dept, u.role === 'client' ? clientCompanyId : null, now, now]
        );

        // Add to portal members
        db.execute(
            `INSERT INTO portal_members (id, portal_id, user_id, role, status, created_at)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [uuidv4(), portalId, u.id, u.role, now]
        );
    }

    // 4. Teams
    const teamEngId = uuidv4();
    db.execute(
        `INSERT INTO teams (id, portal_id, name, description, member_ids, created_at)
         VALUES (?, ?, 'Platform Engineering', 'Core architecture and full-stack builders', ?, ?)`,
        [teamEngId, portalId, JSON.stringify(['user-admin', 'user-dev']), now]
    );

    // 5. Project Group
    const groupId = 'group-enterprise';
    db.execute(
        `INSERT INTO project_groups (id, portal_id, name, description, color, created_at)
         VALUES (?, ?, 'Enterprise Modernization Portfolio', 'High-impact flagship software projects', '#2563EB', ?)`,
        [groupId, portalId, now]
    );

    // 6. Project
    const projectId = 'proj-zoho-core';
    const budgetConfig = {
        currency: 'USD',
        budgetType: 'project_hours',
        billingMethod: 'project_hours',
        plannedCost: 50000,
        actualCost: 12500,
        plannedHours: 400,
        actualHours: 110,
        revenueBudget: 85000,
        earnedValue: 18000
    };

    db.execute(
        `INSERT INTO projects (
            id, portal_id, project_group_id, name, description, key_prefix,
            task_seq_counter, issue_seq_counter, owner_id, member_ids, client_company_ids,
            project_type, is_public, is_strict_schedule, is_rollup_project,
            start_date, end_date, budget_config, stats, is_trashed, created_at, updated_at
        ) VALUES (
            ?, ?, ?, 'Life Project Management System', 'Full-scale Zoho Projects alternative with strict 5-level WBS and multi-view engine', 'ZPA',
            6, 2, 'user-admin', ?, ?,
            'active', 1, 0, 0,
            '2026-10-01', '2026-12-31', ?, '{}', 0, ?, ?
        )`,
        [
            projectId, portalId, groupId,
            JSON.stringify(['user-admin', 'user-manager', 'user-dev', 'user-qa', 'user-client']),
            JSON.stringify([clientCompanyId]),
            JSON.stringify(budgetConfig),
            now, now
        ]
    );

    // 7. Phases (Milestones)
    const phase1Id = 'phase-1-wbs';
    db.execute(
        `INSERT INTO phases (id, portal_id, project_id, name, description, start_date, end_date, owner_id, budget, completion_percentage, flag, status, sequence, created_at, updated_at)
         VALUES (?, ?, ?, 'Phase 1: Architecture & WBS Foundation', 'Multi-tenant isolation and 5-level tree flattener', '2026-10-01', '2026-10-20', 'user-manager', 15000, 100, 'external', 'completed', 1, ?, ?)`,
        [phase1Id, portalId, projectId, now, now]
    );

    const phase2Id = 'phase-2-grid';
    db.execute(
        `INSERT INTO phases (id, portal_id, project_id, name, description, start_date, end_date, owner_id, budget, completion_percentage, flag, status, start_after_phase_id, start_after_days, sequence, created_at, updated_at)
         VALUES (?, ?, ?, 'Phase 2: Task List Sheet & Agile Views', 'High-density spreadsheet grid, Kanban and interactive Gantt with CPM', '2026-10-21', '2026-11-15', 'user-manager', 20000, 50, 'external', 'active', ?, 1, 2, ?, ?)`,
        [phase2Id, portalId, projectId, phase1Id, now, now]
    );

    const phase3Id = 'phase-3-evm';
    db.execute(
        `INSERT INTO phases (id, portal_id, project_id, name, description, start_date, end_date, owner_id, budget, completion_percentage, flag, status, start_after_phase_id, start_after_days, sequence, created_at, updated_at)
         VALUES (?, ?, ?, 'Phase 3: Financial EVM & Automation Studio', 'Earned value calculations, timesheets approval, and blueprint state machine', '2026-11-16', '2026-12-15', 'user-admin', 15000, 0, 'internal', 'active', ?, 1, 3, ?, ?)`,
        [phase3Id, portalId, projectId, phase2Id, now, now]
    );

    // 8. Task Lists
    const list1Id = 'list-sprint-1';
    db.execute(
        `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, is_completed, sequence, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Backend Core & Schema Pipeline', 'internal', 0, 1, '{"milestoneSequence":1,"projectSequence":1}', ?, ?)`,
        [list1Id, portalId, projectId, phase1Id, now, now]
    );

    const list2Id = 'list-sprint-2';
    db.execute(
        `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, is_completed, sequence, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Virtualized Sheet Grid & Kanban Engine', 'internal', 0, 0, '{"milestoneSequence":1,"projectSequence":2}', ?, ?)`,
        [list2Id, portalId, projectId, phase2Id, now, now]
    );

    const listClientId = 'list-client-deliverables';
    db.execute(
        `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, is_completed, sequence, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'Client Review & Sign-Off Milestones', 'external', 1, 0, '{"milestoneSequence":2,"projectSequence":3}', ?, ?)`,
        [listClientId, portalId, projectId, phase2Id, now, now]
    );

    // 9. Tasks & Subtasks
    // Task 1 (Completed)
    const task1Id = 'task-zpa-1';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-1', 1,
            'Multi-Portal Tenant Isolation & RBAC Architecture', '<p>Construct relational database schema with portal isolation</p>',
            'external', 0, NULL, NULL, '[]',
            1, 'completed', 1, 1, 'high', 100,
            '2026-10-01', '2026-10-08', '{"value":6,"type":"days"}', '[]', '["task-zpa-2"]', 1,
            '["user-dev"]', '{"workType":"standard","allocations":{"user-dev":{"standardValue":"40"}}}', 'billable',
            '{"plannedHours":40,"plannedCost":2200}', '[{"id":"chk1","label":"Multi-portal slug lookup","checked":true}]',
            ?, ?
        )`,
        [task1Id, portalId, projectId, phase1Id, list1Id, now, now]
    );

    // Task 2 (Completed)
    const task2Id = 'task-zpa-2';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-2', 2,
            'Security Policies & Client Visibility Scoping', '<p>Mask costPerHour and hide internal flags</p>',
            'external', 0, NULL, NULL, '[]',
            2, 'completed', 1, 1, 'high', 100,
            '2026-10-09', '2026-10-18', '{"value":8,"type":"days"}', '[{"taskId":"task-zpa-1","type":"FS","lagDays":0}]', '["task-zpa-3"]', 1,
            '["user-dev","user-qa"]', '{"workType":"standard","allocations":{}}', 'billable',
            '{"plannedHours":50,"plannedCost":2500}', '[{"id":"chk2","label":"Client visibility test suite","checked":true}]',
            ?, ?
        )`,
        [task2Id, portalId, projectId, phase1Id, list1Id, now, now]
    );

    // Task 3 (Parent Task, In Progress)
    const task3Id = 'task-zpa-3';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-3', 3,
            'High-Density Virtualized Task List Sheet Grid', '<p>Spreadsheet UI with instant inline cell edits and formula rollups</p>',
            'external', 0, NULL, NULL, '[]',
            3, 'in_progress', 0, 0, 'high', 60,
            '2026-10-21', '2026-11-05', '{"value":12,"type":"days"}', '[{"taskId":"task-zpa-2","type":"FS","lagDays":1}]', '["task-zpa-6"]', 1,
            '["user-dev"]', '{"workType":"standard","allocations":{"user-dev":{"standardValue":"60"}}}', 'billable',
            '{"plannedHours":80,"plannedCost":4400}', '[{"id":"chk3","label":"Keyboard arrow navigation","checked":true},{"id":"chk4","label":"Formula columns","checked":false}]',
            ?, ?
        )`,
        [task3Id, portalId, projectId, phase2Id, list2Id, now, now]
    );

    // Task 4 (Subtask of Task 3, Depth 1)
    const task4Id = 'task-zpa-4';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-4', 4,
            'Inline Cell Editors for Dates, Owners and Status', '<p>Subtask: Excel-style inline editor with arrow navigation</p>',
            'internal', 1, ?, ?, ?,
            4, 'completed', 1, 1, 'medium', 100,
            '2026-10-21', '2026-10-27', '{"value":5,"type":"days"}', '[]', '[]', 0,
            '["user-dev"]', '{"workType":"standard","allocations":{}}', 'billable',
            '{"plannedHours":30,"plannedCost":1650}', '[]',
            ?, ?
        )`,
        [task4Id, portalId, projectId, phase2Id, list2Id, task3Id, task3Id, JSON.stringify([task3Id]), now, now]
    );

    // Task 5 (Subtask of Task 3, Depth 1)
    const task5Id = 'task-zpa-5';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-5', 5,
            'Multi-Owner Work Allocation Matrix Calculation', '<p>Subtask: Standard vs flexible daily hours calculation</p>',
            'internal', 1, ?, ?, ?,
            5, 'in_progress', 0, 0, 'medium', 50,
            '2026-10-28', '2026-11-04', '{"value":6,"type":"days"}', '[]', '[]', 0,
            '["user-dev"]', '{"workType":"standard","allocations":{}}', 'billable',
            '{"plannedHours":30,"plannedCost":1650}', '[]',
            ?, ?
        )`,
        [task5Id, portalId, projectId, phase2Id, list2Id, task3Id, task3Id, JSON.stringify([task3Id]), now, now]
    );

    // Task 6 (Interactive Gantt with Critical Path, dependent on Task 3)
    const task6Id = 'task-zpa-6';
    db.execute(
        `INSERT INTO tasks (
            id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
            name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
            sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
            start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
            owner_ids, owners_and_work, billing_type, budget, checklist_items, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?, 'ZPA-6', 6,
            'Interactive Gantt Chart with CPM Critical Path & Auto-Cascade', '<p>Visual timeline with SVG dependency lines and zero-slack critical path</p>',
            'external', 0, NULL, NULL, '[]',
            6, 'open', 0, 0, 'high', 0,
            '2026-11-06', '2026-11-18', '{"value":9,"type":"days"}', '[{"taskId":"task-zpa-3","type":"FS","lagDays":1}]', '[]', 1,
            '["user-dev","user-manager"]', '{"workType":"standard","allocations":{}}', 'billable',
            '{"plannedHours":60,"plannedCost":3600}', '[]',
            ?, ?
        )`,
        [task6Id, portalId, projectId, phase2Id, listClientId, now, now]
    );

    // 10. Issues / Bugs
    const issue1Id = 'issue-bug-1';
    db.execute(
        `INSERT INTO issues (
            id, portal_id, project_id, affected_milestone_id, release_milestone_id,
            prefix_key, sequence_number, title, description_html, severity,
            reproducibility, classification, module, status_id, is_closed,
            priority, assignee_id, reporter_id, flag, sla_response_target_date,
            sla_resolution_target_date, sla_breached, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            'BUG-1', 1, 'Gantt dependency arrow misalignment on browser window resize',
            '<p>SVG connector coordinates drift when browser is resized to under 1200px</p>',
            'major', 'always', 'ui', 'Gantt View', 'open', 0,
            'high', 'user-dev', 'user-qa', 'external',
            '2026-10-23T08:00:00.000Z', '2026-10-23T18:00:00.000Z', 0,
            ?, ?
        )`,
        [issue1Id, portalId, projectId, phase1Id, phase2Id, now, now]
    );

    const issue2Id = 'issue-bug-2';
    db.execute(
        `INSERT INTO issues (
            id, portal_id, project_id, affected_milestone_id, release_milestone_id,
            prefix_key, sequence_number, title, description_html, severity,
            reproducibility, classification, module, status_id, is_closed,
            priority, assignee_id, reporter_id, flag, sla_response_target_date,
            sla_resolution_target_date, sla_breached, created_at, updated_at
        ) VALUES (
            ?, ?, ?, ?, ?,
            'BUG-2', 2, 'Critical SQL deadlock during concurrent bulk task updates',
            '<p>Occurred during load test with 50 parallel task updates</p>',
            'critical', 'sometimes', 'crash', 'Core Database', 'in_progress', 0,
            'high', 'user-dev', 'user-admin', 'internal',
            '2026-10-22T04:00:00.000Z', '2026-10-22T10:00:00.000Z', 1,
            ?, ?
        )`,
        [issue2Id, portalId, projectId, phase1Id, phase2Id, now, now]
    );

    // 11. Time Logs
    db.execute(
        `INSERT INTO time_logs (id, portal_id, project_id, task_id, user_id, log_date, hours, minutes, is_billable, work_notes, status, approved_by, created_at)
         VALUES (?, ?, ?, ?, 'user-dev', '2026-10-15', 8, 0, 1, 'Completed portal tenant isolation middleware and unit tests', 'approved', 'user-manager', ?)`,
        [uuidv4(), portalId, projectId, task1Id, now]
    );

    db.execute(
        `INSERT INTO time_logs (id, portal_id, project_id, task_id, user_id, log_date, hours, minutes, is_billable, work_notes, status, approved_by, created_at)
         VALUES (?, ?, ?, ?, 'user-dev', '2026-10-18', 7, 30, 1, 'Finished client visibility filtering and masked financial costPerHour', 'approved', 'user-manager', ?)`,
        [uuidv4(), portalId, projectId, task2Id, now]
    );

    db.execute(
        `INSERT INTO time_logs (id, portal_id, project_id, task_id, user_id, log_date, hours, minutes, is_billable, work_notes, status, created_at)
         VALUES (?, ?, ?, ?, 'user-dev', ?, 5, 0, 1, 'Built virtualized sheet grid keyboard navigation prototype', 'draft', ?)`,
        [uuidv4(), portalId, projectId, task3Id, today, now]
    );

    // 12. Expenses
    db.execute(
        `INSERT INTO expenses (id, portal_id, project_id, category, amount, currency, expense_date, description, is_billable, status, created_at)
         VALUES (?, ?, ?, 'Cloud Infrastructure', 450.0, 'USD', '2026-10-10', 'High-memory compute instances for load testing', 1, 'approved', ?)`,
        [uuidv4(), portalId, projectId, now]
    );

    // Seed 4 additional realistic sample projects (5-10 entries max per module, clean & professional)
    const extraProjects = [
        {
            id: 'proj-mobile-app',
            name: 'Mobile App Redesign',
            prefix: 'MAR',
            desc: 'iOS & Android native client redesign with offline-first sync',
            tasks: [
                { id: 'task-mar-1', prefix: 'MAR-1', name: 'User Flow & Wireframe Approval', status: 'completed', owner: 'user-manager', comp: 100 },
                { id: 'task-mar-2', prefix: 'MAR-2', name: 'Design Token Library Implementation', status: 'in_progress', owner: 'user-dev', comp: 65 },
                { id: 'task-mar-3', prefix: 'MAR-3', name: 'Offline SQLite Local Storage Engine', status: 'in_progress', owner: 'user-dev', comp: 40 },
                { id: 'task-mar-4', prefix: 'MAR-4', name: 'Biometric Login & TouchID Integration', status: 'open', owner: 'user-qa', comp: 0 }
            ]
        },
        {
            id: 'proj-design-system',
            name: 'Unified Design System',
            prefix: 'UDS',
            desc: 'Shared typography, components, and accessible color tokens',
            tasks: [
                { id: 'task-uds-1', prefix: 'UDS-1', name: 'Accessibility Contrast Audit (WCAG AA)', status: 'completed', owner: 'user-qa', comp: 100 },
                { id: 'task-uds-2', prefix: 'UDS-2', name: 'Modal, Dialog and Drawer Components', status: 'in_progress', owner: 'user-dev', comp: 70 },
                { id: 'task-uds-3', prefix: 'UDS-3', name: 'Data Grid & Table Keyboard Navigation', status: 'open', owner: 'user-dev', comp: 15 }
            ]
        },
        {
            id: 'proj-analytics',
            name: 'Customer Analytics Pipeline',
            prefix: 'CAP',
            desc: 'Real-time telemetry and reporting warehouse pipeline',
            tasks: [
                { id: 'task-cap-1', prefix: 'CAP-1', name: 'Clickstream Event Schema Validation', status: 'completed', owner: 'user-dev', comp: 100 },
                { id: 'task-cap-2', prefix: 'CAP-2', name: 'Kafka Topic Partitioning & Dead-Letter Queue', status: 'in_progress', owner: 'user-dev', comp: 55 },
                { id: 'task-cap-3', prefix: 'CAP-3', name: 'Executive Revenue Dashboard Metrics', status: 'open', owner: 'user-admin', comp: 0 }
            ]
        },
        {
            id: 'proj-compliance',
            name: 'Security & Compliance Audit',
            prefix: 'SCA',
            desc: 'SOC2 Type II controls verification and penetration testing',
            tasks: [
                { id: 'task-sca-1', prefix: 'SCA-1', name: 'Automated Vulnerability Scan Pipeline', status: 'completed', owner: 'user-qa', comp: 100 },
                { id: 'task-sca-2', prefix: 'SCA-2', name: 'Data Retention & Encryption Policy Review', status: 'in_progress', owner: 'user-manager', comp: 80 },
                { id: 'task-sca-3', prefix: 'SCA-3', name: 'External Penetration Test Remediation', status: 'open', owner: 'user-dev', comp: 20 }
            ]
        }
    ];

    for (const ep of extraProjects) {
        db.execute(
            `INSERT INTO projects (
                id, portal_id, project_group_id, name, description, key_prefix,
                task_seq_counter, issue_seq_counter, owner_id, member_ids, client_company_ids,
                project_type, is_public, is_strict_schedule, is_rollup_project,
                start_date, end_date, budget_config, stats, is_trashed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'user-admin', ?, '[]', 'active', 1, 0, 0, '2026-10-01', '2026-12-31', '{}', '{}', 0, ?, ?)`,
            [ep.id, portalId, groupId, ep.name, ep.desc, ep.prefix, ep.tasks.length, JSON.stringify(['user-admin', 'user-manager', 'user-dev', 'user-qa']), now, now]
        );

        const listId = `list-${ep.id}-core`;
        db.execute(
            `INSERT INTO task_lists (id, portal_id, project_id, phase_id, name, flag, is_general_default, created_at, updated_at)
             VALUES (?, ?, ?, NULL, 'Core Deliverables', 'internal', 1, ?, ?)`,
            [listId, portalId, ep.id, now, now]
        );

        let seq = 1;
        for (const t of ep.tasks) {
            db.execute(
                `INSERT INTO tasks (
                    id, portal_id, project_id, phase_id, task_list_id, prefix_key, sequence_number,
                    name, description_html, flag, depth, parent_task_id, root_task_id, ancestor_ids,
                    sheet_sequence, status_id, is_closed_type, is_completed, priority, completion_percentage,
                    start_date, end_date, duration, predecessors, successor_ids, is_on_critical_path,
                    owner_ids, owners_and_work, billing_type, is_trashed, created_at, updated_at
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, '', 'internal', 0, NULL, NULL, '[]', ?, ?, ?, ?, 'medium', ?, '2026-10-15', '2026-11-15', '{"value":5,"type":"days"}', '[]', '[]', 0, ?, '{"workType":"standard"}', 'billable', 0, ?, ?)`,
                [t.id, portalId, ep.id, listId, t.prefix, seq, t.name, seq, t.status, t.comp === 100 ? 1 : 0, t.comp === 100 ? 1 : 0, t.comp, JSON.stringify([t.owner]), now, now]
            );
            seq++;
        }
        WbsRollupEngine.rollupProject(db, ep.id);
    }

    // 13. Blueprints (Workflow State Machine)
    const blueprintId = 'bp-software-dev';
    const bpStates = [
        { id: 'open', name: 'Open / Backlog', color: '#64748B', metaState: 'Open' },
        { id: 'in_progress', name: 'In Development', color: '#3B82F6', metaState: 'In Progress' },
        { id: 'review', name: 'Code Review', color: '#8B5CF6', metaState: 'In Progress' },
        { id: 'completed', name: 'Completed & Verified', color: '#10B981', metaState: 'Closed' }
    ];
    const bpTransitions = [
        {
            id: 't-start-dev',
            name: 'Start Development',
            fromStateId: 'open',
            toStateId: 'in_progress',
            allowedRoles: ['admin', 'manager', 'employee'],
            postActions: [{ type: 'set_completion', value: 10 }]
        },
        {
            id: 't-submit-review',
            name: 'Submit for Review',
            fromStateId: 'in_progress',
            toStateId: 'review',
            allowedRoles: ['admin', 'manager', 'employee'],
            beforeCriteria: { requireAllChecklistsCompleted: true },
            duringPrompts: [{ field: 'prLink', label: 'Pull Request Link', required: true, type: 'url' }],
            postActions: [{ type: 'set_completion', value: 75 }]
        },
        {
            id: 't-approve-close',
            name: 'Verify & Close',
            fromStateId: 'review',
            toStateId: 'completed',
            allowedRoles: ['admin', 'manager'],
            postActions: [{ type: 'set_completion', value: 100 }]
        }
    ];

    db.execute(
        `INSERT INTO blueprints (id, portal_id, name, entity_type, states, transitions, created_at, updated_at)
         VALUES (?, ?, 'Agile Software Dev Transition Lifecycle', 'task', ?, ?, ?, ?)`,
        [blueprintId, portalId, JSON.stringify(bpStates), JSON.stringify(bpTransitions), now, now]
    );

    // 14. Collaborative Comments
    db.execute(
        `INSERT INTO comments (id, portal_id, entity_type, entity_id, user_id, content, flag, mentions, reactions, attachments, created_at)
         VALUES (?, ?, 'task', ?, 'user-manager', 'Great work on ZPA-1! @Alex Director please review the client-scoping spec.', 'external', '["Alex Director"]', '{"thumbsup":2}', '[]', ?)`,
        [uuidv4(), portalId, task1Id, now]
    );

    // 15. Wiki Page
    db.execute(
        `INSERT INTO wiki_pages (id, portal_id, project_id, title, content_html, last_edited_by, created_at, updated_at)
         VALUES (?, ?, ?, 'Engineering Architecture SOP', '<h2>5-Level WBS Hierarchy Standards</h2><p>All tasks must be assigned to a Task List within an active Phase.</p>', 'user-admin', ?, ?)`,
        [uuidv4(), portalId, projectId, now, now]
    );

    // Run Rollup Engine on Project
    WbsRollupEngine.rollupProject(db, projectId);

    console.log('✅ Seeding completed successfully!');
    console.log('👉 Demo Accounts:');
    console.log('   - Admin:    admin@lifepms.com    / Password123!');
    console.log('   - Manager:  manager@lifepms.com  / Password123!');
    console.log('   - Dev:      dev@lifepms.com      / Password123!');
    console.log('   - QA Lead:  qa@lifepms.com       / Password123!');
    console.log('   - Client:   client@acme.com      / Password123!');
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
