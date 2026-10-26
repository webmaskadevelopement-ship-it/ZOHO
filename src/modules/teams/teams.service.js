const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class TeamsService {
    static getTeams(portalId) {
        return db.queryAll('SELECT * FROM teams WHERE portal_id = ? ORDER BY name ASC', [portalId]);
    }

    static createTeam(portalId, { name, description = '', memberIds = [] }) {
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO teams (id, portal_id, name, description, member_ids, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, portalId, name, description, JSON.stringify(memberIds), now]
        );
        return db.queryOne('SELECT * FROM teams WHERE id = ?', [id]);
    }

    static updateTeam(portalId, teamId, { name, description, memberIds }) {
        const team = db.queryOne('SELECT * FROM teams WHERE id = ? AND portal_id = ?', [teamId, portalId]);
        if (!team) throw new Error('Team not found.');

        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (memberIds !== undefined) { updates.push('member_ids = ?'); params.push(JSON.stringify(memberIds)); }

        if (updates.length > 0) {
            params.push(teamId);
            db.execute(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        return db.queryOne('SELECT * FROM teams WHERE id = ?', [teamId]);
    }

    static deleteTeam(portalId, teamId) {
        db.execute('DELETE FROM teams WHERE id = ? AND portal_id = ?', [teamId, portalId]);
        return { success: true };
    }
}

module.exports = TeamsService;
