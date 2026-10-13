/**
 * Customer Management Controller
 * 
 * Endpoints:
 * - POST  /api/v1/customers/register      (Register customer under sellerId context)
 * - GET   /api/v1/customers/profile       (Get authenticated customer profile)
 * - PATCH /api/v1/customers/profile       (Update authenticated customer profile)
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { AppError, NotFoundError } = require('../middleware/errorHandler');

const BCRYPT_ROUNDS = 12;
const CUSTOMER_ROLE_ID = '00000000-0000-0000-0000-000000000006';

async function registerCustomer(req, res, next) {
  const connection = await pool.getConnection();
  try {
    let { sellerId, email, password, firstName, lastName, phone } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. If sellerId omitted, find first active approved sweet shop
    if (!sellerId) {
      const [defaultShops] = await connection.query(
        "SELECT id FROM sellers WHERE is_active = TRUE AND account_status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;"
      );
      if (defaultShops.length === 0) {
        throw new NotFoundError('No active sweet shop available for customer registration.');
      }
      sellerId = defaultShops[0].id;
    }

    // Verify target seller exists and is active
    const [sellerRows] = await connection.query(
      'SELECT id, business_name, is_active FROM sellers WHERE id = ?;',
      [sellerId]
    );

    if (sellerRows.length === 0 || !sellerRows[0].is_active) {
      throw new NotFoundError('Target sweet shop does not exist or is inactive.');
    }

    // 2. Check tenant-scoped email uniqueness: UNIQUE(seller_id, email)
    const [existing] = await connection.query(
      'SELECT id FROM seller_users WHERE seller_id = ? AND email = ? LIMIT 1;',
      [sellerId, normalizedEmail]
    );

    if (existing.length > 0) {
      throw new AppError('An account with this email already exists under this sweet shop.', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await connection.beginTransaction();

    // 3. Insert customer account into seller_users
    const customerId = require('crypto').randomUUID();
    await connection.query(
      `INSERT INTO seller_users (
        id, seller_id, email, phone, password_hash, first_name, last_name, is_active
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, TRUE
      );`,
      [customerId, sellerId, normalizedEmail, phone || null, passwordHash, firstName, lastName || null]
    );

    // 4. Assign CUSTOMER role in seller_user_roles
    await connection.query(
      `INSERT INTO seller_user_roles (id, seller_user_id, role_id)
       VALUES (UUID(), ?, ?);`,
      [customerId, CUSTOMER_ROLE_ID]
    );

    await connection.commit();

    const [created] = await connection.query(
      `SELECT id, seller_id, email, phone, first_name, last_name, is_active, created_at 
       FROM seller_users WHERE id = ?;`,
      [customerId]
    );

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      data: created[0]
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function getProfile(req, res, next) {
  try {
    const customerId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, seller_id, email, phone, first_name, last_name, profile_photo, is_active, created_at, updated_at 
       FROM seller_users 
       WHERE id = ?;`,
      [customerId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Customer account not found.');
    }

    res.status(200).json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const customerId = req.user.id;
    const { firstName, lastName, phone, profilePhoto } = req.body;

    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (profilePhoto !== undefined) {
      updates.push('profile_photo = ?');
      values.push(profilePhoto);
    }

    if (updates.length === 0) {
      throw new AppError('No profile fields provided to update.', 400, 'BAD_REQUEST');
    }

    values.push(customerId);

    await pool.query(
      `UPDATE seller_users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      values
    );

    const [updated] = await pool.query(
      `SELECT id, seller_id, email, phone, first_name, last_name, profile_photo, updated_at 
       FROM seller_users 
       WHERE id = ?;`,
      [customerId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: updated[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerCustomer,
  getProfile,
  updateProfile
};
