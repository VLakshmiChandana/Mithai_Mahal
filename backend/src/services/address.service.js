/**
 * Address Service
 * 
 * Manages customer delivery addresses in user_addresses table.
 * Enforces customer ownership: customers can only access/modify their own addresses.
 */

const { pool } = require('../config/db');
const { NotFoundError, ForbiddenError, AppError } = require('../middleware/errorHandler');

/**
 * List all delivery addresses for an authenticated customer
 */
async function listAddresses(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, recipient_name, recipient_phone, address_line_1, address_line_2,
            city, state, pincode, country, address_type, is_default, created_at, updated_at
     FROM user_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, created_at DESC;`,
    [userId]
  );
  return rows;
}

/**
 * Get single address by ID ensuring ownership
 */
async function getAddressById(addressId, userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, recipient_name, recipient_phone, address_line_1, address_line_2,
            city, state, pincode, country, address_type, is_default, created_at, updated_at
     FROM user_addresses
     WHERE id = ? AND user_id = ?
     LIMIT 1;`,
    [addressId, userId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Delivery address not found or does not belong to you.');
  }

  return rows[0];
}

/**
 * Create a new delivery address
 */
async function createAddress(userId, data) {
  const {
    recipientName,
    recipientPhone,
    addressLine1,
    addressLine2 = null,
    city,
    state,
    pincode,
    country = 'India',
    addressType = 'HOME',
    isDefault = false
  } = data;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // If marked default, unset existing default addresses for this customer
    if (isDefault) {
      await connection.query(
        'UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?;',
        [userId]
      );
    } else {
      // If this is the user's first address, make it default automatically
      const [existing] = await connection.query(
        'SELECT COUNT(*) as count FROM user_addresses WHERE user_id = ?;',
        [userId]
      );
      if (existing[0].count === 0) {
        data.isDefault = true;
      }
    }

    const effectiveIsDefault = isDefault || data.isDefault ? 1 : 0;

    await connection.query(
      `INSERT INTO user_addresses (
        id, user_id, recipient_name, recipient_phone, address_line_1, address_line_2,
        city, state, pincode, country, address_type, is_default
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      );`,
      [
        userId,
        recipientName || null,
        recipientPhone || null,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        country,
        addressType,
        effectiveIsDefault
      ]
    );

    const [created] = await connection.query(
      `SELECT * FROM user_addresses 
       WHERE user_id = ? AND address_line_1 = ? AND pincode = ? 
       ORDER BY created_at DESC LIMIT 1;`,
      [userId, addressLine1, pincode]
    );

    await connection.commit();
    return created[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Update delivery address with ownership check
 */
async function updateAddress(addressId, userId, updates) {
  await getAddressById(addressId, userId);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (updates.isDefault) {
      await connection.query(
        'UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?;',
        [userId]
      );
    }

    const fields = [];
    const params = [];

    if (updates.recipientName !== undefined) {
      fields.push('recipient_name = ?');
      params.push(updates.recipientName);
    }
    if (updates.recipientPhone !== undefined) {
      fields.push('recipient_phone = ?');
      params.push(updates.recipientPhone);
    }
    if (updates.addressLine1 !== undefined) {
      fields.push('address_line_1 = ?');
      params.push(updates.addressLine1);
    }
    if (updates.addressLine2 !== undefined) {
      fields.push('address_line_2 = ?');
      params.push(updates.addressLine2);
    }
    if (updates.city !== undefined) {
      fields.push('city = ?');
      params.push(updates.city);
    }
    if (updates.state !== undefined) {
      fields.push('state = ?');
      params.push(updates.state);
    }
    if (updates.pincode !== undefined) {
      fields.push('pincode = ?');
      params.push(updates.pincode);
    }
    if (updates.country !== undefined) {
      fields.push('country = ?');
      params.push(updates.country);
    }
    if (updates.addressType !== undefined) {
      fields.push('address_type = ?');
      params.push(updates.addressType);
    }
    if (updates.isDefault !== undefined) {
      fields.push('is_default = ?');
      params.push(updates.isDefault ? 1 : 0);
    }

    if (fields.length > 0) {
      params.push(addressId, userId);
      await connection.query(
        `UPDATE user_addresses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?;`,
        params
      );
    }

    await connection.commit();
    return getAddressById(addressId, userId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Delete delivery address with ownership check
 */
async function deleteAddress(addressId, userId) {
  await getAddressById(addressId, userId);

  await pool.query(
    'DELETE FROM user_addresses WHERE id = ? AND user_id = ?;',
    [addressId, userId]
  );

  return { deleted: true, id: addressId };
}

/**
 * Set address as default
 */
async function setDefaultAddress(addressId, userId) {
  await getAddressById(addressId, userId);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      'UPDATE user_addresses SET is_default = FALSE WHERE user_id = ?;',
      [userId]
    );

    await connection.query(
      'UPDATE user_addresses SET is_default = TRUE WHERE id = ? AND user_id = ?;',
      [addressId, userId]
    );

    await connection.commit();
    return getAddressById(addressId, userId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  listAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
