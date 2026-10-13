const { pool } = require('../src/config/db');
const bcrypt = require('bcrypt');

async function setup() {
  try {
    const hash = await bcrypt.hash('AdminPassword123!', 12);
    await pool.query('UPDATE admins SET password_hash = ? WHERE email = ?;', [hash, 'admin@gmail.com']);
    console.log('Successfully set password for admin@gmail.com to AdminPassword123!');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

setup();
