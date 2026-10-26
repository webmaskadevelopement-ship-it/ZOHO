const app = require('./app');
const config = require('./config');
const db = require('./db/database');

// Ensure DB is initialized
db.getInstance();

const server = app.listen(config.port, () => {
    console.log(`================================================================`);
    console.log(`🚀 Life Project Management System (Zoho Projects Alternative)`);
    console.log(`📡 Backend Server listening on http://localhost:${config.port}`);
    console.log(`📊 API Explorer & Dashboard: http://localhost:${config.port}`);
    console.log(`📑 OpenAPI Specification: http://localhost:${config.port}/api/v1/integrations/swagger.json`);
    console.log(`================================================================`);
});

// Keep process active in background execution
const keepAlive = setInterval(() => {}, 1000 * 60 * 60);

process.on('SIGTERM', () => {
    clearInterval(keepAlive);
    server.close();
});

process.on('SIGINT', () => {
    clearInterval(keepAlive);
    server.close();
});

module.exports = server;
