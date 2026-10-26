const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class CollaborationService {
    // 1. Threaded Comments
    static getComments(portalId, entityType, entityId, isClient = false) {
        let sql = `
            SELECT c.*, u.name as user_name, u.email as user_email, u.avatar_url
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.portal_id = ? AND c.entity_type = ? AND c.entity_id = ?
        `;
        const params = [portalId, entityType, entityId];

        if (isClient) {
            sql += " AND c.flag = 'external'";
        }

        sql += ' ORDER BY c.created_at ASC';
        const rows = db.queryAll(sql, params);

        return rows.map(c => ({
            ...c,
            mentions: JSON.parse(c.mentions || '[]'),
            reactions: JSON.parse(c.reactions || '{}'),
            attachments: JSON.parse(c.attachments || '[]')
        }));
    }

    static createComment(portalId, {
        entityType,
        entityId,
        userId,
        content,
        flag = 'internal',
        parentCommentId = null,
        mentions = [],
        attachments = []
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        // Extract mentions and task embeds (e.g. @john, #ZPA-101)
        const extractedMentions = [...mentions];
        const mentionMatches = content.match(/@(\w+)/g);
        if (mentionMatches) {
            mentionMatches.forEach(m => extractedMentions.push(m.substring(1)));
        }

        db.execute(
            `INSERT INTO comments (id, portal_id, entity_type, entity_id, user_id, content, flag, parent_comment_id, mentions, reactions, attachments, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
            [
                id, portalId, entityType, entityId, userId, content, flag,
                parentCommentId, JSON.stringify(Array.from(new Set(extractedMentions))),
                JSON.stringify(attachments), now
            ]
        );

        // If mentions exist, create notifications
        for (const mentionName of extractedMentions) {
            const user = db.queryOne('SELECT id FROM users WHERE name LIKE ? OR email LIKE ?', [`%${mentionName}%`, `%${mentionName}%`]);
            if (user && user.id !== userId) {
                this.createNotification(portalId, {
                    recipientId: user.id,
                    type: 'mention',
                    title: 'New Mention',
                    message: `You were mentioned in a ${entityType} comment: "${content.substring(0, 80)}"`,
                    linkUrl: `/${entityType}s/${entityId}`
                });
            }
        }

        return db.queryOne(
            `SELECT c.*, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
            [id]
        );
    }

    // 2. Files & Versioning & Proofing Annotations
    static getFiles(portalId, projectId, isClient = false) {
        let sql = 'SELECT * FROM files WHERE portal_id = ? AND project_id = ?';
        const params = [portalId, projectId];
        if (isClient) sql += " AND flag = 'external'";
        sql += ' ORDER BY created_at DESC';

        const rows = db.queryAll(sql, params);
        return rows.map(f => ({
            ...f,
            versions: JSON.parse(f.versions || '[]'),
            annotations: JSON.parse(f.annotations || '[]')
        }));
    }

    static createFile(portalId, {
        projectId,
        folderId = null,
        name,
        size = 0,
        mimeType = 'application/octet-stream',
        flag = 'internal',
        fileUrl = ''
    }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const initialVersion = [{ version: 1, uploadedAt: now, size, name, fileUrl }];

        try {
            db.execute('ALTER TABLE files ADD COLUMN file_url TEXT');
        } catch (e) {}

        db.execute(
            `INSERT INTO files (id, portal_id, project_id, folder_id, name, size, mime_type, current_version, versions, is_checked_out, flag, annotations, file_url, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?, '[]', ?, ?)`,
            [id, portalId, projectId, folderId, name, size, mimeType, JSON.stringify(initialVersion), flag, fileUrl, now]
        );

        return db.queryOne('SELECT * FROM files WHERE id = ?', [id]);
    }

    // Folders (Cloud Drive Hierarchy - PDF Feature 110)
    static getFolders(portalId, projectId) {
        return db.queryAll('SELECT * FROM folders WHERE portal_id = ? AND project_id = ? ORDER BY name ASC', [portalId, projectId]);
    }

    static createFolder(portalId, { projectId, parentId = null, name }) {
        if (!projectId || !name) throw new Error('projectId and name are required.');
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            'INSERT INTO folders (id, portal_id, project_id, parent_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, portalId, projectId, parentId, name, now]
        );
        return db.queryOne('SELECT * FROM folders WHERE id = ?', [id]);
    }

    static deleteFolder(portalId, folderId) {
        db.execute('DELETE FROM folders WHERE id = ? AND portal_id = ?', [folderId, portalId]);
        return { success: true };
    }

    // File Versioning & Rollback (PDF Feature 111)
    static uploadNewFileVersion(portalId, fileId, { name, size = 0, notes = '', uploaderId }) {
        const file = db.queryOne('SELECT * FROM files WHERE id = ? AND portal_id = ?', [fileId, portalId]);
        if (!file) throw new Error('File not found.');
        if (file.is_checked_out && file.checked_out_by !== uploaderId) {
            throw new Error('File is checked out and locked by another user.');
        }

        const versions = JSON.parse(file.versions || '[]');
        const nextVer = (file.current_version || 1) + 1;
        const now = new Date().toISOString();
        versions.push({
            version: nextVer,
            name: name || file.name,
            size,
            notes,
            uploadedAt: now,
            uploaderId
        });

        db.execute(
            'UPDATE files SET current_version = ?, name = ?, size = ?, versions = ? WHERE id = ?',
            [nextVer, name || file.name, size, JSON.stringify(versions), fileId]
        );
        return db.queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    }

    static rollbackFileVersion(portalId, fileId, targetVersion) {
        const file = db.queryOne('SELECT * FROM files WHERE id = ? AND portal_id = ?', [fileId, portalId]);
        if (!file) throw new Error('File not found.');

        const versions = JSON.parse(file.versions || '[]');
        const target = versions.find(v => v.version === Number(targetVersion));
        if (!target) throw new Error(`Target version ${targetVersion} not found in file version history.`);

        db.execute(
            'UPDATE files SET current_version = ?, name = ?, size = ? WHERE id = ?',
            [target.version, target.name, target.size || file.size, fileId]
        );
        return db.queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
    }

    static toggleFileCheckout(portalId, fileId, userId) {
        const file = db.queryOne('SELECT * FROM files WHERE id = ? AND portal_id = ?', [fileId, portalId]);
        if (!file) throw new Error('File not found.');

        const isLocked = file.is_checked_out ? 0 : 1;
        const lockedBy = isLocked ? userId : null;

        db.execute(
            'UPDATE files SET is_checked_out = ?, checked_out_by = ? WHERE id = ?',
            [isLocked, lockedBy, fileId]
        );
        return { fileId, isCheckedOut: !!isLocked, checkedOutBy: lockedBy };
    }

    static addProofingAnnotation(portalId, fileId, { pageNumber = 1, xPercent, yPercent, widthPercent = 0, heightPercent = 0, comment, authorId, status = 'pending' }) {
        const file = db.queryOne('SELECT * FROM files WHERE id = ? AND portal_id = ?', [fileId, portalId]);
        if (!file) throw new Error('File not found.');

        const annotations = JSON.parse(file.annotations || '[]');
        const annotation = {
            id: uuidv4(),
            pageNumber,
            xPercent,
            yPercent,
            widthPercent,
            heightPercent,
            comment,
            authorId,
            status,
            createdAt: new Date().toISOString()
        };
        annotations.push(annotation);

        db.execute('UPDATE files SET annotations = ? WHERE id = ?', [JSON.stringify(annotations), fileId]);

        // Also record in proof_annotations table
        try {
            db.execute(
                `INSERT INTO proof_annotations (id, portal_id, file_id, version, x_percent, y_percent, width_percent, height_percent, comment, author_id, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [annotation.id, portalId, fileId, file.current_version, xPercent, yPercent, widthPercent, heightPercent, comment, authorId, status, annotation.createdAt]
            );
        } catch (e) {}

        return annotation;
    }

    // 3. Wiki Pages
    static getWikiPages(portalId, projectId) {
        return db.queryAll('SELECT * FROM wiki_pages WHERE portal_id = ? AND project_id = ? ORDER BY title ASC', [portalId, projectId]);
    }

    static createWikiPage(portalId, { projectId, parentPageId = null, title, contentJson = {}, contentHtml = '', userId }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO wiki_pages (id, portal_id, project_id, parent_page_id, title, content_json, content_html, last_edited_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, projectId, parentPageId, title, JSON.stringify(contentJson), contentHtml, userId, now, now]
        );

        return db.queryOne('SELECT * FROM wiki_pages WHERE id = ?', [id]);
    }

    // 4. Discussions / Forums
    static getDiscussions(portalId, projectId) {
        return db.queryAll(
            `SELECT d.*, u.name as author_name
             FROM discussions d
             JOIN users u ON d.author_id = u.id
             WHERE d.portal_id = ? AND d.project_id = ?
             ORDER BY d.created_at DESC`,
            [portalId, projectId]
        );
    }

    static createDiscussion(portalId, { projectId, category = 'General', title, content, authorId }) {
        const id = uuidv4();
        const now = new Date().toISOString();

        db.execute(
            `INSERT INTO discussions (id, portal_id, project_id, category, title, content, author_id, is_locked, replies_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
            [id, portalId, projectId, category, title, content, authorId, now]
        );

        return db.queryOne('SELECT * FROM discussions WHERE id = ?', [id]);
    }

    // 5. Chat Rooms
    static getChatRooms(portalId, projectId = null) {
        let sql = 'SELECT * FROM chat_rooms WHERE portal_id = ?';
        const params = [portalId];
        if (projectId) {
            sql += ' AND project_id = ?';
            params.push(projectId);
        }
        sql += ' ORDER BY created_at DESC';
        const rooms = db.queryAll(sql, params);

        return rooms.map(r => ({
            ...r,
            member_ids: JSON.parse(r.member_ids || '[]'),
            messages: JSON.parse(r.messages || '[]')
        }));
    }

    static sendChatMessage(portalId, roomId, { senderId, senderName, text }) {
        const room = db.queryOne('SELECT * FROM chat_rooms WHERE id = ? AND portal_id = ?', [roomId, portalId]);
        if (!room) throw new Error('Chat room not found.');

        const messages = JSON.parse(room.messages || '[]');
        const msg = {
            id: uuidv4(),
            senderId,
            senderName,
            text,
            createdAt: new Date().toISOString()
        };
        messages.push(msg);

        db.execute('UPDATE chat_rooms SET messages = ? WHERE id = ?', [JSON.stringify(messages), roomId]);
        return msg;
    }

    // 6. Notifications
    static getNotifications(portalId, userId) {
        let rows = db.queryAll(
            'SELECT * FROM notifications WHERE portal_id = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 50',
            [portalId, userId]
        );
        if (rows.length === 0) {
            const now = new Date();
            const seedItems = [
                {
                    type: 'task_assigned',
                    title: 'New Task Assigned',
                    message: 'Sarah Jenkins assigned you to "Stitch AI for Website Code"',
                    linkUrl: '#tasks',
                    isRead: 0,
                    minutesAgo: 10
                },
                {
                    type: 'sla_warning',
                    title: 'SLA Escalation Warning',
                    message: 'Critical Bug ISS-101 has 1h 45m remaining before SLA breach',
                    linkUrl: '#issues',
                    isRead: 0,
                    minutesAgo: 35
                },
                {
                    type: 'mention',
                    title: 'New Comment Mention',
                    message: 'Quinn Adams mentioned @you in task AE1-T42: "Please review validation logic."',
                    linkUrl: '#tasks',
                    isRead: 0,
                    minutesAgo: 60
                },
                {
                    type: 'mention',
                    title: 'Design Blueprint Mention',
                    message: 'Ritika Sharma mentioned @you on Architecture Diagram asset',
                    linkUrl: '#documents',
                    isRead: 1,
                    minutesAgo: 180
                },
                {
                    type: 'timesheet_approved',
                    title: 'Timesheet Approved',
                    message: 'Your 38.0h timesheet for week 43 was approved by Alex Chen',
                    linkUrl: '#finance',
                    isRead: 1,
                    minutesAgo: 240
                }
            ];

            for (const item of seedItems) {
                const itemTime = new Date(now.getTime() - item.minutesAgo * 60000).toISOString();
                db.execute(
                    `INSERT INTO notifications (id, portal_id, recipient_id, type, title, message, link_url, is_read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [uuidv4(), portalId, userId, item.type, item.title, item.message, item.linkUrl, item.isRead, itemTime]
                );
            }

            rows = db.queryAll(
                'SELECT * FROM notifications WHERE portal_id = ? AND recipient_id = ? ORDER BY created_at DESC LIMIT 50',
                [portalId, userId]
            );
        }
        return rows;
    }

    static markNotificationsRead(portalId, userId, notificationId = null) {
        if (notificationId) {
            db.execute('UPDATE notifications SET is_read = 1 WHERE portal_id = ? AND recipient_id = ? AND id = ?', [portalId, userId, notificationId]);
        } else {
            db.execute('UPDATE notifications SET is_read = 1 WHERE portal_id = ? AND recipient_id = ?', [portalId, userId]);
        }
        return { success: true };
    }

    static createNotification(portalId, { recipientId, type, title, message, linkUrl = '' }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO notifications (id, portal_id, recipient_id, type, title, message, link_url, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [id, portalId, recipientId, type, title, message, linkUrl, now]
        );
    }
}

module.exports = CollaborationService;
