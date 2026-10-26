const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class TagsService {
    static getTags(portalId) {
        return db.queryAll('SELECT * FROM tags WHERE portal_id = ? ORDER BY name ASC', [portalId]);
    }

    static createTag(portalId, { name, color = '#3B82F6' }) {
        if (!name) throw new Error('Tag name is required.');
        const existing = db.queryOne('SELECT * FROM tags WHERE portal_id = ? AND name = ?', [portalId, name]);
        if (existing) return existing;

        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            'INSERT INTO tags (id, portal_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
            [id, portalId, name, color, now]
        );
        return db.queryOne('SELECT * FROM tags WHERE id = ?', [id]);
    }

    static deleteTag(portalId, tagId) {
        db.execute('DELETE FROM tags WHERE id = ? AND portal_id = ?', [tagId, portalId]);
        db.execute('DELETE FROM entity_tags WHERE tag_id = ? AND portal_id = ?', [tagId, portalId]);
        return { success: true };
    }

    static assignTag(portalId, { entityType, entityId, tagId }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        try {
            db.execute(
                `INSERT INTO entity_tags (id, portal_id, entity_type, entity_id, tag_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, portalId, entityType, entityId, tagId, now]
            );
        } catch (e) {
            // Already assigned
        }
        return this.getEntityTags(portalId, entityType, entityId);
    }

    static removeTag(portalId, { entityType, entityId, tagId }) {
        db.execute(
            'DELETE FROM entity_tags WHERE portal_id = ? AND entity_type = ? AND entity_id = ? AND tag_id = ?',
            [portalId, entityType, entityId, tagId]
        );
        return this.getEntityTags(portalId, entityType, entityId);
    }

    static getEntityTags(portalId, entityType, entityId) {
        return db.queryAll(
            `SELECT t.* FROM tags t
             JOIN entity_tags et ON t.id = et.tag_id
             WHERE et.portal_id = ? AND et.entity_type = ? AND et.entity_id = ?`,
            [portalId, entityType, entityId]
        );
    }
}

module.exports = TagsService;
