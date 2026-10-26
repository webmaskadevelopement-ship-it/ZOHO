const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const CollaborationService = require('./collaboration.service');
const { authenticate, optionalAuth } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');
const { enforceClientVisibility } = require('../../middleware/clientVisibility');
const { storage, db: firestoreDb } = require('../../config/firebase');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

// Comments & Live Chat (Supports authenticated team and guest visitor comments)
router.get('/comments/:entityType/:entityId', optionalAuth, (req, res, next) => {
    try {
        const portalId = req.headers['x-portal-id'] || req.portalId || 'portal-demo-zoho';
        const comments = CollaborationService.getComments(portalId, req.params.entityType, req.params.entityId, req.isClient || false);
        res.json({ success: true, data: comments });
    } catch (err) {
        next(err);
    }
});

router.post('/comments', optionalAuth, (req, res, next) => {
    try {
        const portalId = req.body.portalId || req.headers['x-portal-id'] || req.portalId || 'portal-demo-zoho';
        const { entityType, entityId, content, flag, attachments } = req.body;
        if (!entityType || !entityId || !content) {
            return res.status(400).json({ success: false, error: 'entityType, entityId, and content are required.' });
        }
        const userId = req.user?.id || (req.body.persona?.includes('Admin') ? 'user-admin' : 'user-dev');
        const comment = CollaborationService.createComment(portalId, {
            entityType,
            entityId,
            userId,
            content,
            flag: flag || 'internal',
            attachments: attachments || []
        });
        res.status(201).json({ success: true, data: comment });
    } catch (err) {
        next(err);
    }
});

router.use(authenticate, portalScope, enforceClientVisibility);

// Folders Hierarchy (PDF Feature 110)
router.get('/folders/:projectId', (req, res, next) => {
    try {
        const folders = CollaborationService.getFolders(req.portalId, req.params.projectId);
        res.json({ success: true, data: folders });
    } catch (err) {
        next(err);
    }
});

router.post('/folders', (req, res, next) => {
    try {
        const folder = CollaborationService.createFolder(req.portalId, req.body);
        res.status(201).json({ success: true, data: folder });
    } catch (err) {
        next(err);
    }
});

router.delete('/folders/:id', (req, res, next) => {
    try {
        const result = CollaborationService.deleteFolder(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Files & Proofing
router.get('/files/:projectId', (req, res, next) => {
    try {
        const files = CollaborationService.getFiles(req.portalId, req.params.projectId, req.isClient);
        res.json({ success: true, data: files });
    } catch (err) {
        next(err);
    }
});

// Upload File to Firebase Storage or local fallback
router.post('/files/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file provided for upload.' });
        }

        const projectId = req.body.projectId || 'proj-ai-training';
        const folderId = req.body.folderId || null;
        const flag = req.body.flag || 'internal';
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        const size = req.file.size;
        const safeName = `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        let downloadUrl = '';
        let storageTarget = 'firebase';

        // 1. Attempt Firebase Storage upload
        if (storage) {
            try {
                const bucket = storage.bucket();
                const fileRef = bucket.file(`documents/${safeName}`);
                await fileRef.save(req.file.buffer, {
                    contentType: mimeType,
                    metadata: {
                        firebaseStorageDownloadTokens: uuidv4(),
                        uploadedBy: req.user.id
                    }
                });
                downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileRef.name)}?alt=media`;
            } catch (firebaseErr) {
                console.warn('[Firebase Storage] Direct upload notice, fallback to static uploads:', firebaseErr.message);
            }
        }

        // 2. Fallback to local storage if Firebase Storage is unavailable or lacks cloud credentials
        if (!downloadUrl) {
            storageTarget = 'local';
            const uploadDir = path.resolve(__dirname, '../../../data/uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            const filePath = path.join(uploadDir, safeName);
            fs.writeFileSync(filePath, req.file.buffer);
            downloadUrl = `/uploads/${safeName}`;
        }

        // 3. Save File Record in Database
        const fileRecord = CollaborationService.createFile(req.portalId, {
            projectId,
            folderId,
            name: originalName,
            size,
            mimeType,
            flag,
            fileUrl: downloadUrl
        });

        // 4. Firestore sync if available
        if (firestoreDb && typeof firestoreDb.collection === 'function') {
            try {
                await firestoreDb.collection('portals').doc(req.portalId).collection('files').doc(fileRecord.id).set({
                    ...fileRecord,
                    downloadUrl,
                    storageTarget,
                    uploadedAt: new Date().toISOString()
                }, { merge: true });
            } catch (e) {
                console.warn('[Firestore] Sync file notice:', e.message);
            }
        }

        res.status(201).json({
            success: true,
            data: {
                ...fileRecord,
                fileUrl: downloadUrl,
                file_url: downloadUrl
            },
            downloadUrl,
            storageTarget
        });
    } catch (err) {
        next(err);
    }
});

router.post('/files', (req, res, next) => {
    try {
        const file = CollaborationService.createFile(req.portalId, req.body);
        res.status(201).json({ success: true, data: file });
    } catch (err) {
        next(err);
    }
});

// File Versioning & Rollback (PDF Feature 111)
router.post('/files/:id/versions', (req, res, next) => {
    try {
        const file = CollaborationService.uploadNewFileVersion(req.portalId, req.params.id, {
            ...req.body,
            uploaderId: req.user.id
        });
        res.status(201).json({ success: true, data: file });
    } catch (err) {
        next(err);
    }
});

router.post('/files/:id/rollback', (req, res, next) => {
    try {
        const { targetVersion } = req.body;
        const file = CollaborationService.rollbackFileVersion(req.portalId, req.params.id, targetVersion);
        res.json({ success: true, data: file });
    } catch (err) {
        next(err);
    }
});

// File Check-In/Check-Out Locking (PDF Feature 111)
router.post('/files/:id/checkout', (req, res, next) => {
    try {
        const status = CollaborationService.toggleFileCheckout(req.portalId, req.params.id, req.user.id);
        res.json({ success: true, data: status });
    } catch (err) {
        next(err);
    }
});

router.post('/files/:id/annotations', (req, res, next) => {
    try {
        const annotation = CollaborationService.addProofingAnnotation(req.portalId, req.params.id, {
            ...req.body,
            authorId: req.user.id
        });
        res.status(201).json({ success: true, data: annotation });
    } catch (err) {
        next(err);
    }
});

// Wiki Pages
router.get('/wiki/:projectId', (req, res, next) => {
    try {
        const pages = CollaborationService.getWikiPages(req.portalId, req.params.projectId);
        res.json({ success: true, data: pages });
    } catch (err) {
        next(err);
    }
});

router.post('/wiki', (req, res, next) => {
    try {
        const page = CollaborationService.createWikiPage(req.portalId, {
            ...req.body,
            userId: req.user.id
        });
        res.status(201).json({ success: true, data: page });
    } catch (err) {
        next(err);
    }
});

// Discussions
router.get('/discussions/:projectId', (req, res, next) => {
    try {
        const discussions = CollaborationService.getDiscussions(req.portalId, req.params.projectId);
        res.json({ success: true, data: discussions });
    } catch (err) {
        next(err);
    }
});

router.post('/discussions', (req, res, next) => {
    try {
        const discussion = CollaborationService.createDiscussion(req.portalId, {
            ...req.body,
            authorId: req.user.id
        });
        res.status(201).json({ success: true, data: discussion });
    } catch (err) {
        next(err);
    }
});

// Chat Rooms & Messages
router.get('/chat', (req, res, next) => {
    try {
        const rooms = CollaborationService.getChatRooms(req.portalId, req.query.projectId);
        res.json({ success: true, data: rooms });
    } catch (err) {
        next(err);
    }
});

router.post('/chat/:roomId/messages', (req, res, next) => {
    try {
        const msg = CollaborationService.sendChatMessage(req.portalId, req.params.roomId, {
            senderId: req.user.id,
            senderName: req.user.name,
            text: req.body.text
        });
        res.status(201).json({ success: true, data: msg });
    } catch (err) {
        next(err);
    }
});

// Notifications
router.get('/notifications', (req, res, next) => {
    try {
        const notifications = CollaborationService.getNotifications(req.portalId, req.user.id);
        res.json({ success: true, data: notifications });
    } catch (err) {
        next(err);
    }
});

router.post('/notifications/mark-read', (req, res, next) => {
    try {
        const { notificationId } = req.body || {};
        const result = CollaborationService.markNotificationsRead(req.portalId, req.user.id, notificationId);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
