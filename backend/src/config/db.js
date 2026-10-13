/**
 * MySQL connection pool configuration using mysql2/promise.
 * Provides connection pooling, automatic reconnection, and promise-based queries.
 */

const mysql = require('mysql2/promise');
const config = require('./env');

// Create a connection pool to manage concurrent database connections
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: config.db.waitForConnections,
  queueLimit: config.db.queueLimit,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {})
});

/**
 * Helper to test and verify the database connection.
 * Returns database version and connected database name.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT VERSION() AS version, DATABASE() AS database_name;');
    return {
      connected: true,
      version: rows[0].version,
      database: rows[0].database_name
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  testConnection
};
