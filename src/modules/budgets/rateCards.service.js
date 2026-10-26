const { v4: uuidv4 } = require('uuid');
const db = require('../../db/database');

class RateCardsService {
    static getRateCards(portalId) {
        return db.queryAll(
            `SELECT rc.*, u.name as user_name, u.email as user_email
             FROM rate_cards rc
             LEFT JOIN users u ON rc.user_id = u.id
             WHERE rc.portal_id = ?
             ORDER BY rc.created_at DESC`,
            [portalId]
        );
    }

    static createRateCard(portalId, { userId = null, role = null, costPerHour = 0.0, billableRatePerHour = 0.0, currency = 'USD' }) {
        if (!userId && !role) throw new Error('Either userId or role must be provided for a rate card.');
        const id = uuidv4();
        const now = new Date().toISOString();
        db.execute(
            `INSERT INTO rate_cards (id, portal_id, user_id, role, cost_per_hour, billable_rate_per_hour, currency, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, portalId, userId, role, Number(costPerHour), Number(billableRatePerHour), currency, now]
        );
        return db.queryOne('SELECT * FROM rate_cards WHERE id = ?', [id]);
    }

    static updateRateCard(portalId, cardId, { costPerHour, billableRatePerHour, currency }) {
        const existing = db.queryOne('SELECT * FROM rate_cards WHERE id = ? AND portal_id = ?', [cardId, portalId]);
        if (!existing) throw new Error('Rate card not found.');

        const cost = costPerHour !== undefined ? Number(costPerHour) : existing.cost_per_hour;
        const billable = billableRatePerHour !== undefined ? Number(billableRatePerHour) : existing.billable_rate_per_hour;
        const cur = currency || existing.currency;

        db.execute(
            'UPDATE rate_cards SET cost_per_hour = ?, billable_rate_per_hour = ?, currency = ? WHERE id = ? AND portal_id = ?',
            [cost, billable, cur, cardId, portalId]
        );
        return db.queryOne('SELECT * FROM rate_cards WHERE id = ?', [cardId]);
    }

    static deleteRateCard(portalId, cardId) {
        db.execute('DELETE FROM rate_cards WHERE id = ? AND portal_id = ?', [cardId, portalId]);
        return { success: true };
    }
}

module.exports = RateCardsService;
