/**
 * Staff Management Controller
 * 
 * Privileged administrative actions:
 * - POST /api/v1/staff/admins      (Create Admin - Super Admin only)
 * - POST /api/v1/staff/accountants (Create Accountant - Super Admin only)
 * - POST /api/v1/staff/sellers     (Create Seller - Super Admin or authorized Admin)
 * - GET  /api/v1/staff/sellers     (List all Sellers - Staff with manage_seller_accounts)
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const BCRYPT_ROUNDS = 12;

async function createAdmin(req, res, next) {
  try {
    const { name, email, password, mobileNumber } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const creatorId = req.user.id; // Enforce authenticated Super Admin as creator

    // Check email uniqueness across admins table
    const [existing] = await pool.query('SELECT id FROM admins WHERE email = ? LIMIT 1;', [normalizedEmail]);
    if (existing.length > 0) {
      throw new AppError('An administrator with this email already exists.', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query(
      `INSERT INTO admins (
        id, name, email, mobile_number, password_hash, created_by, is_active
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, TRUE
      );`,
      [name, normalizedEmail, mobileNumber || null, passwordHash, creatorId]
    );

    const [created] = await pool.query(
      `SELECT id, name, email, mobile_number, created_by, is_active, created_at 
       FROM admins WHERE email = ?;`,
      [normalizedEmail]
    );

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      data: created[0]
    });
  } catch (err) {
    next(err);
  }
}

async function createAccountant(req, res, next) {
  try {
    const { name, email, password, mobileNumber } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const creatorId = req.user.id;

    const [existing] = await pool.query('SELECT id FROM accountants WHERE email = ? LIMIT 1;', [normalizedEmail]);
    if (existing.length > 0) {
      throw new AppError('An accountant with this email already exists.', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query(
      `INSERT INTO accountants (
        id, name, email, mobile_number, password_hash, created_by, is_active
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, TRUE
      );`,
      [name, normalizedEmail, mobileNumber || null, passwordHash, creatorId]
    );

    const [created] = await pool.query(
      `SELECT id, name, email, mobile_number, created_by, is_active, created_at 
       FROM accountants WHERE email = ?;`,
      [normalizedEmail]
    );

    res.status(201).json({
      success: true,
      message: 'Accountant account created successfully.',
      data: created[0]
    });
  } catch (err) {
    next(err);
  }
}

async function createSeller(req, res, next) {
  try {
    const {
      businessName,
      legalName,
      businessType,
      email,
      phone,
      gstin,
      password
    } = req.body;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedGstin = gstin.trim().toUpperCase();
    const creatorId = req.user.id;
    const creatorType = req.user.userType;

    // Check email uniqueness
    const [existingEmail] = await pool.query('SELECT id FROM sellers WHERE email = ? LIMIT 1;', [normalizedEmail]);
    if (existingEmail.length > 0) {
      throw new AppError('A sweet shop seller with this email already exists.', 409, 'CONFLICT');
    }

    // Check GSTIN uniqueness
    const [existingGst] = await pool.query('SELECT id FROM sellers WHERE gstin = ? LIMIT 1;', [normalizedGstin]);
    if (existingGst.length > 0) {
      throw new AppError('A sweet shop seller with this GSTIN already exists.', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await pool.query(
      `INSERT INTO sellers (
        id, business_name, legal_name, business_type, email, phone, gstin,
        password_hash, account_status, verification_status, created_by, created_by_type, is_active
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?,
        ?, 'ACTIVE', 'APPROVED', ?, ?, TRUE
      );`,
      [
        businessName,
        legalName || null,
        businessType || 'PROPRIETORSHIP',
        normalizedEmail,
        phone,
        normalizedGstin,
        passwordHash,
        creatorId,
        creatorType
      ]
    );

    const [created] = await pool.query(
      `SELECT id, business_name, legal_name, business_type, email, phone, gstin, 
              account_status, verification_status, is_active, created_at 
       FROM sellers WHERE email = ?;`,
      [normalizedEmail]
    );

    res.status(201).json({
      success: true,
      message: 'Sweet shop seller account created successfully.',
      data: created[0]
    });
  } catch (err) {
    next(err);
  }
}

async function listSellers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT id, business_name, legal_name, business_type, email, phone, gstin, 
              account_status, verification_status, is_active, created_at 
       FROM sellers 
       ORDER BY created_at DESC;`
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAdmin,
  createAccountant,
  createSeller,
  listSellers
};
