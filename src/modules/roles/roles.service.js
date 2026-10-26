const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class RolesService {
    /**
     * Predefined roles according to Zoho Projects specification
     */
    static getPredefinedRoles() {
        return [
            {
                id: 'role-admin',
                name: 'Admin',
                key: 'admin',
                description: 'Full portal and financial access, configuration, user management, and project deletion.',
                isSystem: true,
                permissions: {
                    projects: { read: true, write: true, delete: true },
                    tasks: { read: true, write: true, delete: true },
                    issues: { read: true, write: true, delete: true },
                    timesheets: { read: true, write: true, approve: true, delete: true },
                    finance: { read: true, write: true, delete: true },
                    settings: { read: true, write: true }
                }
            },
            {
                id: 'role-manager',
                name: 'Manager',
                key: 'manager',
                description: 'Project management, task assignments, timesheet approvals, and project budget views.',
                isSystem: true,
                permissions: {
                    projects: { read: true, write: true, delete: false },
                    tasks: { read: true, write: true, delete: true },
                    issues: { read: true, write: true, delete: true },
                    timesheets: { read: true, write: true, approve: true, delete: false },
                    finance: { read: true, write: true, delete: false },
                    settings: { read: true, write: false }
                }
            },
            {
                id: 'role-employee',
                name: 'Employee',
                key: 'employee',
                description: 'Standard team member: can view projects, update assigned tasks, and log timesheets.',
                isSystem: true,
                permissions: {
                    projects: { read: true, write: false, delete: false },
                    tasks: { read: true, write: true, delete: false },
                    issues: { read: true, write: true, delete: false },
                    timesheets: { read: true, write: true, approve: false, delete: false },
                    finance: { read: false, write: false, delete: false },
                    settings: { read: false, write: false }
                }
            },
            {
                id: 'role-contractor',
                name: 'Contractor',
                key: 'contractor',
                description: 'Limited internal contributor with strictly scoped task assignments.',
                isSystem: true,
                permissions: {
                    projects: { read: true, write: false, delete: false },
                    tasks: { read: true, write: true, delete: false },
                    issues: { read: true, write: true, delete: false },
                    timesheets: { read: true, write: true, approve: false, delete: false },
                    finance: { read: false, write: false, delete: false },
                    settings: { read: false, write: false }
                }
            },
            {
                id: 'role-client',
                name: 'Client',
                key: 'client',
                description: 'External customer account restricted strictly to external-flagged items. All financial data masked.',
                isSystem: true,
                permissions: {
                    projects: { read: true, write: false, delete: false },
                    tasks: { read: true, write: false, delete: false },
                    issues: { read: true, write: true, delete: false },
                    timesheets: { read: false, write: false, approve: false, delete: false },
                    finance: { read: false, write: false, delete: false },
                    settings: { read: false, write: false }
                }
            }
        ];
    }

    /**
     * Lists all built-in roles plus custom security profiles
     */
    static getRoles(portalId) {
        const predefined = this.getPredefinedRoles();
        const custom = this.getProfiles(portalId).map(p => ({
            id: p.id,
            name: p.name,
            key: p.id,
            description: p.description,
            isSystem: false,
            permissions: p.permissions
        }));
        return [...predefined, ...custom];
    }

    /**
     * Custom Security Profiles CRUD
     */
    static getProfiles(portalId) {
        const rows = db.queryAll('SELECT * FROM custom_profiles WHERE portal_id = ? ORDER BY created_at ASC', [portalId]);
        return rows.map(r => ({
            ...r,
            permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : r.permissions
        }));
    }

    static getProfileById(portalId, profileId) {
        const row = db.queryOne('SELECT * FROM custom_profiles WHERE portal_id = ? AND id = ?', [portalId, profileId]);
        if (!row) throw new Error('Security profile not found.');
        return {
            ...row,
            permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions || '{}') : row.permissions
        };
    }

    static createProfile(portalId, { name, description = '', permissions = {} }) {
        if (!name) throw new Error('Profile name is required.');
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO custom_profiles (id, portal_id, name, description, permissions, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, description, JSON.stringify(permissions), now, now]
        );
        return this.getProfileById(portalId, id);
    }

    static updateProfile(portalId, profileId, { name, description, permissions }) {
        const existing = this.getProfileById(portalId, profileId);
        const newName = name !== undefined ? name : existing.name;
        const newDesc = description !== undefined ? description : existing.description;
        const newPerms = permissions !== undefined ? JSON.stringify(permissions) : JSON.stringify(existing.permissions);
        const now = new Date().toISOString();

        db.execute(
            `UPDATE custom_profiles SET name = ?, description = ?, permissions = ?, updated_at = ? WHERE id = ? AND portal_id = ?`,
            [newName, newDesc, newPerms, now, profileId, portalId]
        );
        return this.getProfileById(portalId, profileId);
    }

    static deleteProfile(portalId, profileId) {
        db.execute('DELETE FROM custom_profiles WHERE id = ? AND portal_id = ?', [profileId, portalId]);
        return { success: true, message: 'Security profile removed.' };
    }

    /**
     * Field-Level Security Masking: Strips cost_per_hour, plannedCost, actualCost from non-managers
     */
    static maskFinancialFields(item, userRole) {
        if (!item) return item;
        const isPrivileged = userRole === 'admin' || userRole === 'manager';
        if (isPrivileged) return item;

        const cloned = { ...item };
        delete cloned.cost_per_hour;
        delete cloned.billable_rate_per_hour;
        if (cloned.budget_config) {
            try {
                const bc = typeof cloned.budget_config === 'string' ? JSON.parse(cloned.budget_config) : { ...cloned.budget_config };
                delete bc.plannedCost;
                delete bc.actualCost;
                delete bc.revenueBudget;
                cloned.budget_config = bc;
            } catch (e) {}
        }
        return cloned;
    }
}

module.exports = RolesService;
