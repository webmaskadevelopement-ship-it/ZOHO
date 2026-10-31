-- Life Project Management System (Zoho Projects Alternative)
-- SQLite Database Schema Definition with Relational & JSONB Hybrid Model

PRAGMA foreign_keys = ON;

-- 1. Portals (Multi-Tenant Workspaces)
CREATE TABLE IF NOT EXISTS portals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT,
    logo_url TEXT,
    business_hours TEXT DEFAULT '{"workingDays":[1,2,3,4,5],"startHour":"09:00","endHour":"18:00","timezone":"UTC"}',
    holidays TEXT DEFAULT '[]',
    currency TEXT DEFAULT 'USD',
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Client Companies (for external client accounts)
CREATE TABLE IF NOT EXISTS client_companies (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    currency TEXT DEFAULT 'USD',
    created_at TEXT NOT NULL
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee', -- 'admin', 'manager', 'employee', 'contractor', 'client'
    cost_per_hour REAL DEFAULT 0.0,
    billable_rate_per_hour REAL DEFAULT 0.0,
    department TEXT,
    avatar_url TEXT,
    bio TEXT,
    phone TEXT,
    two_factor_secret TEXT,
    two_factor_enabled INTEGER DEFAULT 0,
    client_company_id TEXT REFERENCES client_companies(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 4. Portal Members
CREATE TABLE IF NOT EXISTS portal_members (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'employee',
    custom_profile_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    UNIQUE(portal_id, user_id)
);

-- 4b. Invited Members (Pre-registered & Invited Users)
CREATE TABLE IF NOT EXISTS invited_members (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    status TEXT NOT NULL DEFAULT 'pending',
    invited_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 5. Teams (User Groups)
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    member_ids TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- 6. Leave & Availability Records
CREATE TABLE IF NOT EXISTS leave_records (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    leave_type TEXT DEFAULT 'vacation',
    status TEXT DEFAULT 'approved',
    created_at TEXT NOT NULL
);

-- 7. Project Groups (Portfolios)
CREATE TABLE IF NOT EXISTS project_groups (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT NOT NULL
);

-- 8. Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_group_id TEXT REFERENCES project_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    key_prefix TEXT NOT NULL,
    task_seq_counter INTEGER DEFAULT 0,
    issue_seq_counter INTEGER DEFAULT 0,
    owner_id TEXT NOT NULL REFERENCES users(id),
    member_ids TEXT DEFAULT '[]',
    client_company_ids TEXT DEFAULT '[]',
    layout_id TEXT,
    status_id TEXT DEFAULT 'active',
    project_type TEXT DEFAULT 'active', -- 'active', 'template', 'archived', 'trashed'
    is_public INTEGER DEFAULT 1,
    is_strict_schedule INTEGER DEFAULT 0,
    is_rollup_project INTEGER DEFAULT 0,
    enabled_modules TEXT DEFAULT '["tasks","issues","phases","timesheets","finance","files","wiki","discussions"]',
    start_date TEXT,
    end_date TEXT,
    budget_config TEXT DEFAULT '{"currency":"USD","budgetType":"project_hours","billingMethod":"project_hours","plannedCost":0,"actualCost":0,"plannedHours":0,"actualHours":0,"revenueBudget":0,"earnedValue":0}',
    stats TEXT DEFAULT '{"openTaskCount":0,"closedTaskCount":0,"openIssueCount":0,"closedIssueCount":0,"completionPercentage":0,"healthScore":"on_track"}',
    is_trashed INTEGER DEFAULT 0,
    custom_fields TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 9. Phases (Milestones)
CREATE TABLE IF NOT EXISTS phases (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date TEXT,
    end_date TEXT,
    owner_id TEXT REFERENCES users(id),
    budget REAL DEFAULT 0.0,
    completion_percentage REAL DEFAULT 0.0,
    flag TEXT DEFAULT 'internal', -- 'internal' | 'external'
    status TEXT DEFAULT 'active',
    start_after_phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
    start_after_days INTEGER DEFAULT 0,
    sequence INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 10. Task Lists
CREATE TABLE IF NOT EXISTS task_lists (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    flag TEXT DEFAULT 'internal', -- 'internal' | 'external'
    is_general_default INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    is_rolled_over INTEGER DEFAULT 0,
    sequence TEXT DEFAULT '{"milestoneSequence":0,"projectSequence":0}',
    stats TEXT DEFAULT '{"openTaskCount":0,"closedTaskCount":0,"completionPercentage":0}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 11. Tasks & Subtasks
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
    task_list_id TEXT NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    prefix_key TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description_html TEXT DEFAULT '',
    note TEXT DEFAULT '',
    flag TEXT DEFAULT 'internal', -- 'internal' | 'external'
    depth INTEGER DEFAULT 0,
    parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    root_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    ancestor_ids TEXT DEFAULT '[]',
    sheet_sequence INTEGER DEFAULT 0,
    status_id TEXT DEFAULT 'open',
    is_closed_type INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    completion_percentage REAL DEFAULT 0.0,
    start_date TEXT,
    end_date TEXT,
    duration TEXT DEFAULT '{"value":1,"type":"days"}',
    predecessors TEXT DEFAULT '[]',
    successor_ids TEXT DEFAULT '[]',
    is_on_critical_path INTEGER DEFAULT 0,
    baseline_start_date TEXT,
    baseline_end_date TEXT,
    owner_ids TEXT DEFAULT '[]',
    owners_and_work TEXT DEFAULT '{"workType":"standard","unit":"hours","totalPlannedHours":0,"allocations":{}}',
    billing_type TEXT DEFAULT 'billable', -- 'none' | 'billable' | 'non_billable'
    logged_hours TEXT DEFAULT '{"billableMinutes":0,"nonBillableMinutes":0,"totalMinutes":0}',
    budget TEXT DEFAULT '{"plannedHours":0,"plannedCost":0,"actualCost":0,"revenueBudget":0}',
    blueprint_id TEXT,
    checklist_items TEXT DEFAULT '[]',
    recurrence TEXT DEFAULT '{"isActive":false,"frequency":"none"}',
    tag_ids TEXT DEFAULT '[]',
    follower_ids TEXT DEFAULT '[]',
    custom_fields TEXT DEFAULT '{}',
    associated_team TEXT DEFAULT '',
    work_hours TEXT DEFAULT '00:00',
    reminder TEXT DEFAULT 'None',
    is_trashed INTEGER DEFAULT 0,
    trashed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 12. Issues / Bug Tracker
CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    affected_milestone_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
    release_milestone_id TEXT REFERENCES phases(id) ON DELETE SET NULL,
    prefix_key TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description_html TEXT DEFAULT '',
    severity TEXT DEFAULT 'major', -- 'blocker', 'critical', 'major', 'minor'
    reproducibility TEXT DEFAULT 'always', -- 'always', 'sometimes', 'rarely', 'unable'
    classification TEXT DEFAULT 'ui', -- 'security', 'crash', 'data_loss', 'ui', 'performance'
    module TEXT,
    status_id TEXT DEFAULT 'open',
    is_closed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flag TEXT DEFAULT 'internal', -- 'internal' | 'external'
    sla_response_target_date TEXT,
    sla_resolution_target_date TEXT,
    sla_breached INTEGER DEFAULT 0,
    related_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    custom_fields TEXT DEFAULT '{}',
    is_trashed INTEGER DEFAULT 0,
    trashed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 13. Time Logs
CREATE TABLE IF NOT EXISTS time_logs (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    hours REAL NOT NULL,
    minutes INTEGER NOT NULL,
    is_billable INTEGER DEFAULT 1,
    work_notes TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'rejected'
    approved_by TEXT REFERENCES users(id),
    approval_comment TEXT,
    created_at TEXT NOT NULL
);

-- 14. Active Stopwatch Timers
CREATE TABLE IF NOT EXISTS active_timers (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    started_at TEXT NOT NULL,
    is_running INTEGER DEFAULT 1,
    description TEXT,
    UNIQUE(user_id)
);

-- 15. Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    expense_date TEXT NOT NULL,
    description TEXT,
    receipt_url TEXT,
    is_billable INTEGER DEFAULT 1,
    status TEXT DEFAULT 'approved',
    created_at TEXT NOT NULL
);

-- 16. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    client_company_id TEXT REFERENCES client_companies(id),
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    items TEXT DEFAULT '[]',
    subtotal REAL DEFAULT 0.0,
    tax REAL DEFAULT 0.0,
    total REAL DEFAULT 0.0,
    status TEXT DEFAULT 'draft',
    created_at TEXT NOT NULL
);

-- 17. Blueprints (Workflow State Machine)
CREATE TABLE IF NOT EXISTS blueprints (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'task',
    states TEXT NOT NULL DEFAULT '[]',
    transitions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 18. Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    conditions TEXT DEFAULT '[]',
    actions TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 19. Outgoing Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    events TEXT DEFAULT '["task.created","task.updated","issue.created"]',
    secret TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- 20. Comments
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    flag TEXT DEFAULT 'internal',
    parent_comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    mentions TEXT DEFAULT '[]',
    reactions TEXT DEFAULT '{}',
    attachments TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- 21. Files & Document Repository
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    folder_id TEXT,
    name TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    mime_type TEXT,
    current_version INTEGER DEFAULT 1,
    versions TEXT DEFAULT '[]',
    is_checked_out INTEGER DEFAULT 0,
    checked_out_by TEXT REFERENCES users(id),
    flag TEXT DEFAULT 'internal',
    annotations TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- 22. Wiki / Collaborative Pages
CREATE TABLE IF NOT EXISTS wiki_pages (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_page_id TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content_json TEXT DEFAULT '{}',
    content_html TEXT DEFAULT '',
    last_edited_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 23. Discussions / Forums
CREATE TABLE IF NOT EXISTS discussions (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'General',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_locked INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 24. Project & Direct Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_direct INTEGER DEFAULT 0,
    member_ids TEXT DEFAULT '[]',
    messages TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- 25. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 26. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    changes TEXT DEFAULT '{}',
    ip_address TEXT,
    created_at TEXT NOT NULL
);

-- 27. Custom Fields
CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_type TEXT NOT NULL,
    options TEXT DEFAULT '[]',
    default_value TEXT,
    is_required INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 28. Custom Saved Views
CREATE TABLE IF NOT EXISTS custom_views (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    scope TEXT DEFAULT 'project',
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filters_ast TEXT DEFAULT '{}',
    sort_config TEXT DEFAULT '[]',
    column_config TEXT DEFAULT '[]',
    group_config TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);

-- 29. Custom Security Profiles
CREATE TABLE IF NOT EXISTS custom_profiles (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions TEXT DEFAULT '{"tasks":{"read":true,"write":true,"delete":false},"issues":{"read":true,"write":true,"delete":false},"timesheets":{"read":true,"write":true,"delete":false},"finance":{"read":false,"write":false,"delete":false}}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 30. Project Layouts
CREATE TABLE IF NOT EXISTS project_layouts (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    field_ids TEXT DEFAULT '[]',
    statuses TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- 31. Relational Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'FS', -- 'FS', 'SS', 'FF', 'SF'
    lag_days INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(predecessor_id, successor_id)
);

-- 32. Task Relations (relates_to, duplicates, blocks, is_blocked_by)
CREATE TABLE IF NOT EXISTS task_relations (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- 'relates_to', 'duplicates', 'blocks', 'is_blocked_by'
    created_at TEXT NOT NULL,
    UNIQUE(source_task_id, target_task_id, relation_type)
);

-- 33. Smart Task Reminders
CREATE TABLE IF NOT EXISTS task_reminders (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL DEFAULT 'before_due', -- 'before_due', 'after_start', 'custom_date', 'daily'
    remind_at TEXT NOT NULL,
    offset_minutes INTEGER DEFAULT 120,
    is_sent INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 34. Task Upvoting / Prioritization
CREATE TABLE IF NOT EXISTS task_votes (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(task_id, user_id)
);

-- 35. SLA Policies
CREATE TABLE IF NOT EXISTS sla_policies (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    severity TEXT NOT NULL, -- 'blocker', 'critical', 'major', 'minor'
    response_time_hours REAL NOT NULL DEFAULT 1.0,
    resolution_time_hours REAL NOT NULL DEFAULT 4.0,
    escalation_target_id TEXT REFERENCES users(id),
    created_at TEXT NOT NULL
);

-- 36. SLA Breach Logs
CREATE TABLE IF NOT EXISTS sla_breach_logs (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    policy_id TEXT REFERENCES sla_policies(id) ON DELETE SET NULL,
    breach_type TEXT NOT NULL, -- 'response', 'resolution'
    breached_at TEXT NOT NULL,
    details TEXT DEFAULT '{}'
);

-- 37. Rate Cards
CREATE TABLE IF NOT EXISTS rate_cards (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT,
    cost_per_hour REAL DEFAULT 0.0,
    billable_rate_per_hour REAL DEFAULT 0.0,
    currency TEXT DEFAULT 'USD',
    created_at TEXT NOT NULL
);

-- 38. Folders (Cloud Drive Hierarchy)
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 39. Proof Annotations (Visual Proofing Pins)
CREATE TABLE IF NOT EXISTS proof_annotations (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    x_percent REAL NOT NULL,
    y_percent REAL NOT NULL,
    width_percent REAL DEFAULT 0,
    height_percent REAL DEFAULT 0,
    comment TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'changes_requested'
    created_at TEXT NOT NULL
);

-- 40. Global Tags
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT NOT NULL,
    UNIQUE(portal_id, name)
);

-- 41. Entity Tags Mapping
CREATE TABLE IF NOT EXISTS entity_tags (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'task', 'issue', 'phase'
    entity_id TEXT NOT NULL,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(entity_type, entity_id, tag_id)
);

-- 42. Webhook Deliveries & Retries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload TEXT NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    success INTEGER DEFAULT 0,
    attempted_at TEXT NOT NULL
);

-- 43. Active Sessions (Device Revocation)
CREATE TABLE IF NOT EXISTS active_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 44. Personal Access Tokens (PATs)
CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    scopes TEXT DEFAULT '["read","write"]',
    last_used_at TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL
);

-- 45. Public Share Tokens (Read-Only Gantt / Kanban)
CREATE TABLE IF NOT EXISTS public_shares (
    id TEXT PRIMARY KEY,
    portal_id TEXT NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    view_type TEXT NOT NULL DEFAULT 'gantt', -- 'gantt', 'kanban', 'sheet'
    share_token TEXT UNIQUE NOT NULL,
    is_password_protected INTEGER DEFAULT 0,
    password_hash TEXT,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_portal_members_lookup ON portal_members(portal_id, user_id);
CREATE INDEX IF NOT EXISTS idx_projects_portal ON projects(portal_id, project_type);
CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id, sequence);
CREATE INDEX IF NOT EXISTS idx_task_lists_project ON task_lists(project_id, phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, task_list_id, phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id, root_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_flag ON tasks(portal_id, flag);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id, status_id, severity);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_date ON time_logs(portal_id, user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(portal_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_task_dependencies ON task_dependencies(predecessor_id, successor_id);
CREATE INDEX IF NOT EXISTS idx_task_relations ON task_relations(source_task_id, target_task_id);
CREATE INDEX IF NOT EXISTS idx_folders_project ON folders(project_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_proof_annotations_file ON proof_annotations(file_id, version);
CREATE INDEX IF NOT EXISTS idx_entity_tags ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_public_shares_token ON public_shares(share_token);

-- 43. In-App Requests Table (Instagram-style Pending/Accepted/Rejected queue)
CREATE TABLE IF NOT EXISTS in_app_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    request_type TEXT NOT NULL CHECK(request_type IN (
      'USER_CONNECTION',
      'PROJECT_INVITE',
      'TASK_HANDOFF',
      'TEAM_INVITE',
      'APPROVAL_REQUEST'
    )),
    target_entity_id TEXT, -- e.g., project_id, task_id, or team_id
    payload_json TEXT DEFAULT '{}', -- e.g., {"role": "Employee", "message": "Please take over this WBS task"}
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_requests_receiver_status ON in_app_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_sender ON in_app_requests(sender_id);

-- 44. User Connections Table (For direct Instagram-style collaborator connections)
CREATE TABLE IF NOT EXISTS user_connections (
    user_id TEXT NOT NULL,
    connected_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, connected_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (connected_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_connections_lookup ON user_connections(user_id, connected_user_id);

