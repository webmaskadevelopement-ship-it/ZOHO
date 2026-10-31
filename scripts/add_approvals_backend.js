const fs = require('fs');
const path = require('path');

// 1. Update requests.service.js
const servicePath = path.join(__dirname, '../src/modules/requests/requests.service.js');
let serviceContent = fs.readFileSync(servicePath, 'utf8');

const targetServiceEnd = `        return {
            id: requestId,
            status: 'CANCELLED',
            message: 'Pending outgoing request cancelled.'
        };
    }
}`;

const newMethodCode = `        return {
            id: requestId,
            status: 'CANCELLED',
            message: 'Pending outgoing request cancelled.'
        };
    }

    /**
     * Get approvals list for logged-in user (My Approvals Section)
     * Supports user-wise data isolation:
     * - Admins/Managers see workspace approvals
     * - Employees/Members see approvals where they are the sender, receiver, or project owner
     */
    static getApprovalsForUser(userId, userRole = 'employee') {
        let sql = \`
            SELECT r.*,
                   s.name as sender_name,
                   s.username as sender_username,
                   s.email as sender_email,
                   rec.name as receiver_name,
                   rec.username as receiver_username,
                   rec.email as receiver_email,
                   p.name as project_name,
                   p.key_prefix as project_prefix,
                   p.owner_id as project_owner_id
            FROM in_app_requests r
            JOIN users s ON r.sender_id = s.id
            JOIN users rec ON r.receiver_id = rec.id
            LEFT JOIN projects p ON r.target_entity_id = p.id
        \`;
        let params = [];

        if (userRole !== 'admin') {
            sql += \` WHERE (r.sender_id = ? OR r.receiver_id = ? OR p.owner_id = ?)\`;
            params = [userId, userId, userId];
        }

        sql += \` ORDER BY r.responded_at DESC, r.created_at DESC\`;
        const rows = db.queryAll(sql, params);

        return rows.map(r => {
            let payload = {};
            try {
                payload = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json || '{}') : (r.payload_json || {});
            } catch (e) {
                payload = {};
            }
            return {
                id: r.id,
                request_type: r.request_type,
                target_entity_id: r.target_entity_id,
                status: r.status,
                created_at: r.created_at,
                responded_at: r.responded_at,
                payload,
                sender: {
                    id: r.sender_id,
                    name: r.sender_name,
                    username: r.sender_username,
                    email: r.sender_email
                },
                receiver: {
                    id: r.receiver_id,
                    name: r.receiver_name,
                    username: r.receiver_username,
                    email: r.receiver_email
                },
                project: {
                    id: r.target_entity_id,
                    name: r.project_name || payload.projectName || 'Project Workspace',
                    key_prefix: r.project_prefix || 'PRJ'
                },
                role: payload.role || 'employee',
                is_approved: r.status === 'ACCEPTED' || r.status === 'APPROVED',
                approval_status: r.status === 'ACCEPTED' ? 'Approved / Accepted' : (r.status === 'PENDING' ? 'Pending Approval' : (r.status === 'REJECTED' ? 'Rejected' : r.status))
            };
        });
    }
}`;

serviceContent = serviceContent.replace(/\r\n/g, '\n');
if (serviceContent.includes(targetServiceEnd.replace(/\r\n/g, '\n'))) {
    serviceContent = serviceContent.replace(targetServiceEnd.replace(/\r\n/g, '\n'), newMethodCode.replace(/\r\n/g, '\n'));
    fs.writeFileSync(servicePath, serviceContent, 'utf8');
    console.log('✓ Added getApprovalsForUser to requests.service.js');
} else {
    console.warn('⚠️ Could not match targetServiceEnd');
}

// 2. Update requests.controller.js
const ctrlPath = path.join(__dirname, '../src/modules/requests/requests.controller.js');
let ctrlContent = fs.readFileSync(ctrlPath, 'utf8');

const routeCode = `// GET /api/v1/requests/approvals - List collaboration approvals for My Approvals section
router.get('/approvals', authenticate, (req, res, next) => {
    try {
        const approvals = RequestsService.getApprovalsForUser(req.user.id, req.user.role);
        res.json({ success: true, data: approvals, count: approvals.length });
    } catch (err) {
        next(err);
    }
});\n\n`;

if (!ctrlContent.includes('/approvals')) {
    ctrlContent = ctrlContent.replace("router.get('/incoming'", routeCode + "router.get('/incoming'");
    fs.writeFileSync(ctrlPath, ctrlContent, 'utf8');
    console.log('✓ Added /approvals route to requests.controller.js');
}

