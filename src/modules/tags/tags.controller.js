const express = require('express');
const router = express.Router();
const TagsService = require('./tags.service');
const { authenticate } = require('../../middleware/auth');
const portalScope = require('../../middleware/portalScope');

router.use(authenticate, portalScope);

// List portal tags
router.get('/', (req, res, next) => {
    try {
        const tags = TagsService.getTags(req.portalId);
        res.json({ success: true, data: tags });
    } catch (err) {
        next(err);
    }
});

// Create tag
router.post('/', (req, res, next) => {
    try {
        const { name, color } = req.body;
        const tag = TagsService.createTag(req.portalId, { name, color });
        res.status(201).json({ success: true, data: tag });
    } catch (err) {
        next(err);
    }
});

// Delete tag
router.delete('/:id', (req, res, next) => {
    try {
        const result = TagsService.deleteTag(req.portalId, req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

// Assign tag to entity
router.post('/assign', (req, res, next) => {
    try {
        const { entityType, entityId, tagId } = req.body;
        const entityTags = TagsService.assignTag(req.portalId, { entityType, entityId, tagId });
        res.json({ success: true, data: entityTags });
    } catch (err) {
        next(err);
    }
});

// Remove tag from entity
router.post('/remove', (req, res, next) => {
    try {
        const { entityType, entityId, tagId } = req.body;
        const entityTags = TagsService.removeTag(req.portalId, { entityType, entityId, tagId });
        res.json({ success: true, data: entityTags });
    } catch (err) {
        next(err);
    }
});

// Get tags for entity
router.get('/entity/:entityType/:entityId', (req, res, next) => {
    try {
        const tags = TagsService.getEntityTags(req.portalId, req.params.entityType, req.params.entityId);
        res.json({ success: true, data: tags });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
