const mysql = require('mysql2/promise');

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'electronics_store',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Handle connection errors
pool.on('connection', (connection) => {
    console.log('📦 New database connection established');

    connection.on('error', (err) => {
        console.error('❌ Database connection error:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 Attempting to reconnect...');
        }
    });
});

module.exports = pool;
