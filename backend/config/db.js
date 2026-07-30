/* ============================================
   MYSQL DATABASE CONNECTION
   ============================================ */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pauline_fashion',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
});

const connectDB = async () => {
  try {
    console.log('Connecting to MySQL...');
    const connection = await pool.getConnection();
    console.log(`MySQL connected: ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'pauline_fashion'}`);
    connection.release();
  } catch (error) {
    console.error('');
    console.error('MySQL connection failed.');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('');
    process.exit(1);
  }
};

const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Query Error:', error.message);
      console.error('SQL:', sql);
    } else {
      console.error('Query Error:', error.code || error.message);
    }
    throw error;
  }
};

const queryOne = async (sql, params = []) => {
  const results = await query(sql, params);
  return results[0] || null;
};

const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { pool, connectDB, query, queryOne, transaction };
