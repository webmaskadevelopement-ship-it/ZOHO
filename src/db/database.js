const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
}

let dbInstance = null;

function getDatabase(customPath) {
    if (dbInstance && !customPath) {
        return dbInstance;
    }

    const pathToUse = customPath || config.dbPath;
    const db = new DatabaseSync(pathToUse);

    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');

    if (!customPath) {
        dbInstance = db;
    }

    // Initialize schema
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    try {
        require('./migrateSchema')(db);
    } catch (e) {}
    if (fs.existsSync(schemaPath)) {
        try {
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schemaSql);
        } catch (schemaErr) {
            console.warn('[Database] Initial schema exec notice:', schemaErr.message);
        }
    }
    try {
        require('./seedInvites').initInvitedMembers();
    } catch (e) {}

    return db;
}

let inTransaction = false;

// Wrapper for ergonomic queries
const db = {
    getInstance: () => getDatabase(),

    queryOne: (sql, params = []) => {
        const stmt = getDatabase().prepare(sql);
        return stmt.get(...params);
    },

    queryAll: (sql, params = []) => {
        const stmt = getDatabase().prepare(sql);
        return stmt.all(...params);
    },

    execute: (sql, params = []) => {
        const stmt = getDatabase().prepare(sql);
        return stmt.run(...params);
    },

    exec: (sql) => {
        return getDatabase().exec(sql);
    },

    transaction: (fn) => {
        const database = getDatabase();
        if (inTransaction) {
            return fn(database);
        }
        inTransaction = true;
        database.exec('BEGIN IMMEDIATE');
        try {
            const result = fn(database);
            database.exec('COMMIT');
            return result;
        } catch (error) {
            database.exec('ROLLBACK');
            throw error;
        } finally {
            inTransaction = false;
        }
    }
};

module.exports = db;
