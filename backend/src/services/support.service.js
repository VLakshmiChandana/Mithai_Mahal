/**
 * Customer Support Ticket Service
 * 
 * Features:
 * - Customers: Create support tickets linked to orders, view own tickets, append reply messages.
 * - Support Agents: View all tickets, filter by status/priority, claim/assign tickets, post replies, and update ticket resolution status.
 */

const { pool } = require('../config/db');
const { NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');

function generateTicketNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `TCK-${dateStr}-${rand}`;
}

/**
 * Customer creates a support ticket
 */
async function createTicket(customerId, { orderId = null, subject, category = 'ORDER_ISSUE', priority = 'MEDIUM', initialMessage }) {
  let sellerId = null;
  const sanitizedOrderId = typeof orderId === 'string' && orderId.trim() ? orderId.trim() : null;

  // 1. If orderId is provided, verify it belongs to this customer
  if (sanitizedOrderId) {
    const [orders] = await pool.query(
      'SELECT id, seller_id FROM orders WHERE id = ? AND user_id = ? LIMIT 1;',
      [sanitizedOrderId, customerId]
    );
    if (orders.length === 0) {
      throw new ValidationError('Referenced order not found or does not belong to your account.');
    }
    sellerId = orders[0].seller_id;
  } else {
    // For general inquiries, link to customer's registered seller if available
    const [custInfo] = await pool.query('SELECT seller_id FROM seller_users WHERE id = ? LIMIT 1;', [customerId]);
    if (custInfo.length > 0 && custInfo[0].seller_id) {
      sellerId = custInfo[0].seller_id;
    }
  }

  // 2. Prevent duplicate ticket creation from accidental double submissions or retries
  const [duplicateCheck] = await pool.query(
    `SELECT id, ticket_number, created_at 
     FROM support_tickets 
     WHERE user_id = ? AND subject = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 SECOND) 
     ORDER BY created_at DESC LIMIT 1;`,
    [customerId, subject.trim()]
  );
  if (duplicateCheck.length > 0) {
    return getTicketById(duplicateCheck[0].id, customerId, false);
  }

  // 3. Get customer name
  const [custRows] = await pool.query('SELECT first_name, last_name FROM seller_users WHERE id = ?;', [customerId]);
  const senderName = custRows.length > 0 ? `${custRows[0].first_name} ${custRows[0].last_name || ''}`.trim() : 'Customer';

  const ticketNumber = generateTicketNumber();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO support_tickets (
        id, ticket_number, user_id, order_id, seller_id, subject, category, priority, status
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, ?, 'OPEN'
      );`,
      [ticketNumber, customerId, sanitizedOrderId, sellerId, subject.trim(), category, priority]
    );

    const [tck] = await connection.query('SELECT id FROM support_tickets WHERE ticket_number = ? LIMIT 1;', [ticketNumber]);
    const ticketId = tck[0].id;

    // Add initial message
    await connection.query(
      `INSERT INTO support_ticket_messages (
        id, ticket_id, sender_id, sender_type, sender_name, message
      ) VALUES (
        UUID(), ?, ?, 'CUSTOMER', ?, ?
      );`,
      [ticketId, customerId, senderName, initialMessage.trim()]
    );

    await connection.commit();
    return getTicketById(ticketId, customerId, false);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Get ticket details with messages
 */
async function getTicketById(ticketId, requesterId = null, isStaff = false) {
  let query = `
    SELECT t.*, o.order_number, s.business_name as sweet_shop_name
    FROM support_tickets t
    LEFT JOIN orders o ON t.order_id = o.id
    LEFT JOIN sellers s ON t.seller_id = s.id
    WHERE t.id = ?
  `;
  const params = [ticketId];

  if (!isStaff && requesterId) {
    query += ' AND t.user_id = ?';
    params.push(requesterId);
  }
  query += ' LIMIT 1;';

  const [tckRows] = await pool.query(query, params);
  if (tckRows.length === 0) {
    throw new NotFoundError('Support ticket not found.');
  }

  const ticket = tckRows[0];

  const [messages] = await pool.query(
    `SELECT id, sender_id, sender_type, sender_name, message, created_at
     FROM support_ticket_messages
     WHERE ticket_id = ?
     ORDER BY created_at ASC;`,
    [ticket.id]
  );

  return {
    ...ticket,
    messages
  };
}

/**
 * List tickets for customer
 */
async function listCustomerTickets(customerId, { page = 1, limit = 20, status = null }) {
  const conditions = ['t.user_id = ?'];
  const params = [customerId];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM support_tickets t ${where};`, params);
  const total = countRows[0].total;

  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT t.id, t.ticket_number, t.order_id, o.order_number, t.subject, t.category,
            t.priority, t.status, t.created_at, t.updated_at
     FROM support_tickets t
     LEFT JOIN orders o ON t.order_id = o.id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    items: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

/**
 * List tickets for support agents & admins
 */
async function listStaffTickets({ page = 1, limit = 20, status = null, category = null, priority = null }) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (category) {
    conditions.push('t.category = ?');
    params.push(category);
  }
  if (priority) {
    conditions.push('t.priority = ?');
    params.push(priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM support_tickets t ${where};`, params);
  const total = countRows[0].total;

  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT t.id, t.ticket_number, t.user_id, t.order_id, o.order_number, t.subject,
            t.category, t.priority, t.status, t.assigned_agent_id, t.created_at, t.updated_at
     FROM support_tickets t
     LEFT JOIN orders o ON t.order_id = o.id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?;`,
    [...params, Number(limit), Number(offset)]
  );

  return {
    items: rows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

/**
 * Add a message to an existing ticket
 */
async function addTicketMessage(ticketId, sender, messageText) {
  const isStaff = ['CUSTOMER_CARE', 'ADMIN', 'SUPER_ADMIN'].includes(sender.userType);
  const ticket = await getTicketById(ticketId, sender.id, isStaff);

  if (ticket.status === 'CLOSED') {
    throw new ValidationError('Cannot add messages to a closed support ticket.');
  }

  await pool.query(
    `INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_type, sender_name, message
    ) VALUES (
      UUID(), ?, ?, ?, ?, ?
    );`,
    [ticketId, sender.id, sender.userType, sender.name || 'Support Agent', messageText]
  );

  await pool.query('UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;', [ticketId]);

  return getTicketById(ticketId, sender.id, isStaff);
}

/**
 * Update ticket status or assign agent (Support staff only)
 */
async function updateTicketStatus(ticketId, agentId, { status = null, assignedAgentId = null }) {
  const updates = [];
  const params = [];

  if (status) {
    updates.push('status = ?');
    params.push(status);
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
    }
  }

  if (assignedAgentId !== undefined) {
    updates.push('assigned_agent_id = ?');
    params.push(assignedAgentId);
  }

  if (updates.length === 0) {
    return getTicketById(ticketId, null, true);
  }

  params.push(ticketId);
  await pool.query(
    `UPDATE support_tickets SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
    params
  );

  return getTicketById(ticketId, null, true);
}

module.exports = {
  createTicket,
  getTicketById,
  listCustomerTickets,
  listStaffTickets,
  addTicketMessage,
  updateTicketStatus
};
