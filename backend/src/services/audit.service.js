/**
 * Audit Logging Service
 * Records administrative actions with actor, action, target, timestamp, and optional reason.
 */

const { pool } = require('../config/db');

/**
 * Log an administrative action
 * @param {Object} entry - { actorId, actorType, actorName, action, targetId, targetType, details, ipAddress, userAgent, reason }
 */
async function logAction({
  actorId,
  actorType,
  actorName,
  action,
  targetId = null,
  targetType = null,
  details = null,
  ipAddress = null,
  userAgent = null,
  reason = null
}) {
  try {
    await pool.query(`
      INSERT INTO audit_logs (
        id, actor_id, actor_type, actor_name, action,
        target_id, target_type, details, ip_address, user_agent, reason, created_at
      ) VALUES (
        UUID(), ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, NOW()
      );
    `, [
      actorId,
      actorType,
      actorName || 'System Admin',
      action,
      targetId,
      targetType,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
      reason
    ]);
  } catch (err) {
    // Non-blocking log failure; avoid throwing inside user transaction
    console.error('[AUDIT LOG ERROR]:', err.message);
  }
}

/**
 * List audit logs with pagination and filtering
 * @param {Object} query - { page, limit, action, actorType, targetType, startDate, endDate }
 */
async function listAuditLogs({
  page = 1,
  limit = 20,
  action,
  actorType,
  targetType,
  startDate,
  endDate
} = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const conditions = [];
  const params = [];

  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (actorType) {
    conditions.push('actor_type = ?');
    params.push(actorType);
  }
  if (targetType) {
    conditions.push('target_type = ?');
    params.push(targetType);
  }
  if (startDate) {
    conditions.push('created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('created_at <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await pool.query(
    `SELECT id, actor_id, actor_type, actor_name, action, target_id, target_type, details, ip_address, reason, created_at
     FROM audit_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, pageLimit, offset]
  );

  return {
    items: rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit)
    }
  };
}

module.exports = {
  logAction,
  listAuditLogs
};
