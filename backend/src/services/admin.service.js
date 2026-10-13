/**
 * Administrative Control Center & Analytics Service
 * Provides business intelligence, operational queues, audit integration, and safe account lifecycle management.
 */

const { pool } = require('../config/db');
const config = require('../config/env');
const auditService = require('./audit.service');
const { ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

/**
 * Super Admin: High-level business overview and financial metrics
 */
async function getSuperAdminAnalytics() {
  // 1. Today's Financial Metrics from authoritative Payments table
  const [todayPaymentRows] = await pool.query(`
    SELECT
      COALESCE(SUM(amount), 0) AS todayRevenue,
      COALESCE(COUNT(id), 0) AS todaySuccessfulPayments
    FROM payments
    WHERE status IN ('SUCCESS', 'CAPTURED')
      AND DATE(created_at) = CURDATE();
  `);

  // 1b. Today's Order Counts from Orders table (No cartesian join multiplication)
  const [todayOrderRows] = await pool.query(`
    SELECT
      COALESCE(COUNT(id), 0) AS todayOrdersCount,
      COALESCE(COUNT(CASE WHEN order_status = 'DELIVERED' THEN 1 END), 0) AS todayCompletedOrders,
      COALESCE(COUNT(CASE WHEN order_status = 'CANCELLED' THEN 1 END), 0) AS todayCancelledOrders
    FROM orders
    WHERE DATE(created_at) = CURDATE();
  `);

  // 1c. Today's Refund & Failure count
  const [todayRefundRows] = await pool.query(`
    SELECT COALESCE(COUNT(id), 0) AS refundsCount
    FROM payments
    WHERE status IN ('REFUNDED', 'FAILED')
      AND DATE(created_at) = CURDATE();
  `);

  // 2. Lifetime Platform Volume & Settlements
  const [lifetimeRows] = await pool.query(`
    SELECT
      COALESCE(SUM(amount), 0) AS lifetimeGrossSales,
      COALESCE(COUNT(id), 0) AS lifetimePaidTransactions
    FROM payments
    WHERE status IN ('SUCCESS', 'CAPTURED');
  `);

  const [commissionRows] = await pool.query(`
    SELECT
      COALESCE(SUM(vs.platform_commission), 0) AS lifetimeCommissionRetained,
      COALESCE(SUM(vs.net_seller_payout), 0) AS lifetimeNetPayouts
    FROM vendor_settlements vs;
  `);

  // Fallback commission calculation if settlement ledger has not been generated yet
  const grossSales = parseFloat(lifetimeRows[0].lifetimeGrossSales) || 0;
  const configuredRate = config.payment.commissionRatePercent || 10.0;
  const retainedCommission = parseFloat(commissionRows[0].lifetimeCommissionRetained) || (grossSales * (configuredRate / 100));
  const netPayouts = parseFloat(commissionRows[0].lifetimeNetPayouts) || (grossSales - retainedCommission);

  // 3. Seller Compliance & Approval Statuses
  const [sellerStatusRows] = await pool.query(`
    SELECT
      COALESCE(COUNT(CASE WHEN verification_status IN ('PENDING', 'UNDER_REVIEW') THEN 1 END), 0) AS pendingSellerApprovals,
      COALESCE(COUNT(CASE WHEN verification_status = 'APPROVED' AND is_active = TRUE AND account_status = 'ACTIVE' THEN 1 END), 0) AS approvedSellers,
      COALESCE(COUNT(CASE WHEN verification_status = 'REJECTED' THEN 1 END), 0) AS rejectedSellerApplications,
      COALESCE(COUNT(CASE WHEN account_status = 'SUSPENDED' OR is_active = FALSE THEN 1 END), 0) AS suspendedShops,
      COUNT(*) AS totalSellersCount
    FROM sellers;
  `);

  // 4. Platform Accounts Count
  const [adminCount] = await pool.query('SELECT COUNT(*) as total FROM admins WHERE is_active = TRUE;');
  const [accountantCount] = await pool.query('SELECT COUNT(*) as total FROM accountants WHERE is_active = TRUE;');
  const [customerCount] = await pool.query('SELECT COUNT(*) as total FROM seller_users WHERE is_active = TRUE;');

  return {
    today: {
      revenue: parseFloat(todayPaymentRows[0].todayRevenue) || 0,
      successfulPayments: parseInt(todayPaymentRows[0].todaySuccessfulPayments, 10) || 0,
      ordersCount: parseInt(todayOrderRows[0].todayOrdersCount, 10) || 0,
      completedOrders: parseInt(todayOrderRows[0].todayCompletedOrders, 10) || 0,
      cancelledOrders: parseInt(todayOrderRows[0].todayCancelledOrders, 10) || 0,
      refundsCount: parseInt(todayRefundRows[0].refundsCount, 10) || 0
    },
    lifetime: {
      grossSales,
      paidTransactions: parseInt(lifetimeRows[0].lifetimePaidTransactions, 10) || 0,
      commissionRetained: Number(retainedCommission.toFixed(2)),
      netPayouts: Number(netPayouts.toFixed(2))
    },
    sellers: {
      pendingApprovals: parseInt(sellerStatusRows[0].pendingSellerApprovals, 10) || 0,
      approvedSellers: parseInt(sellerStatusRows[0].approvedSellers, 10) || 0,
      rejectedApplications: parseInt(sellerStatusRows[0].rejectedSellerApplications, 10) || 0,
      suspendedShops: parseInt(sellerStatusRows[0].suspendedShops, 10) || 0,
      totalSellers: parseInt(sellerStatusRows[0].totalSellersCount, 10) || 0
    },
    accounts: {
      admins: adminCount[0].total || 0,
      accountants: accountantCount[0].total || 0,
      customers: customerCount[0].total || 0,
      superAdmins: 1
    }
  };
}

/**
 * Sales Trends: Aggregated by day over specified range
 */
async function getSalesTrends({ days = 7 } = {}) {
  const safeDays = Math.min(90, Math.max(1, parseInt(days, 10)));
  const [rows] = await pool.query(`
    SELECT
      DATE(o.created_at) AS date,
      COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END), 0) AS totalSales,
      COUNT(o.id) AS totalOrders,
      COALESCE(COUNT(CASE WHEN o.order_status = 'DELIVERED' THEN 1 END), 0) AS deliveredOrders,
      COALESCE(COUNT(CASE WHEN o.order_status = 'CANCELLED' THEN 1 END), 0) AS cancelledOrders
    FROM orders o
    WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY DATE(o.created_at)
    ORDER BY date ASC;
  `, [safeDays]);

  // Index retrieved rows by YYYY-MM-DD
  const rowMap = new Map();
  rows.forEach(r => {
    let dStr;
    if (r.date instanceof Date) {
      const year = r.date.getFullYear();
      const month = String(r.date.getMonth() + 1).padStart(2, '0');
      const day = String(r.date.getDate()).padStart(2, '0');
      dStr = `${year}-${month}-${day}`;
    } else {
      dStr = String(r.date).slice(0, 10);
    }
    rowMap.set(dStr, {
      totalSales: parseFloat(r.totalSales) || 0,
      totalOrders: parseInt(r.totalOrders, 10) || 0,
      deliveredOrders: parseInt(r.deliveredOrders, 10) || 0,
      cancelledOrders: parseInt(r.cancelledOrders, 10) || 0
    });
  });

  // Construct continuous calendar sequence across the requested window
  const results = [];
  const now = new Date();
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dKey = `${year}-${month}-${day}`;
    const stats = rowMap.get(dKey) || {
      totalSales: 0,
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0
    };
    results.push({
      date: `${dKey}T00:00:00.000Z`,
      totalSales: stats.totalSales,
      totalOrders: stats.totalOrders,
      deliveredOrders: stats.deliveredOrders,
      cancelledOrders: stats.cancelledOrders
    });
  }

  return results;
}

/**
 * Top Performers: Best selling sweets & top sweet shops
 */
async function getTopPerformers() {
  // Best selling products ranked by units sold
  const [topProducts] = await pool.query(`
    SELECT
      oi.product_id,
      oi.product_name,
      SUM(oi.quantity) AS unitsSold,
      SUM(oi.item_total) AS totalRevenue,
      p.image_url,
      p.price
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE o.payment_status = 'PAID'
    GROUP BY oi.product_id, oi.product_name, p.image_url, p.price
    ORDER BY unitsSold DESC
    LIMIT 5;
  `);

  // Best performing sweet shops ranked by verified order revenue
  const [topShops] = await pool.query(`
    SELECT
      s.id,
      s.business_name,
      s.logo,
      s.city,
      COUNT(o.id) AS totalPaidOrders,
      COALESCE(SUM(o.total_amount), 0) AS verifiedRevenue
    FROM sellers s
    JOIN orders o ON s.id = o.seller_id
    WHERE o.payment_status = 'PAID'
    GROUP BY s.id, s.business_name, s.logo, s.city
    ORDER BY verifiedRevenue DESC
    LIMIT 5;
  `);

  return {
    topProducts: topProducts.map(p => ({
      productId: p.product_id,
      productName: p.product_name,
      unitsSold: parseInt(p.unitsSold, 10) || 0,
      totalRevenue: parseFloat(p.totalRevenue) || 0,
      imageUrl: p.image_url || '/sweets/motichoor-laddu.svg',
      price: parseFloat(p.price) || 0
    })),
    topShops: topShops.map(s => ({
      shopId: s.id,
      shopName: s.business_name,
      logo: s.logo || '/sweets/shop-storefront.svg',
      city: s.city || 'Mumbai',
      totalPaidOrders: parseInt(s.totalPaidOrders, 10) || 0,
      verifiedRevenue: parseFloat(s.verifiedRevenue) || 0
    }))
  };
}

/**
 * Super Admin: Paginated platform account management
 */
async function listAllAccounts({ role = 'ALL', search = '', status = 'ALL', page = 1, limit = 20 } = {}) {
  const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * pageLimit;
  const searchFilter = search ? `%${search.trim()}%` : null;

  const queries = [];
  const params = [];

  // Super Admins
  if (role === 'ALL' || role === 'SUPER_ADMIN') {
    queries.push(`
      SELECT id, name, email, NULL as phone, 'SUPER_ADMIN' as role, is_active, 'ACTIVE' as account_status, last_login_at, created_at
      FROM super_admins
      WHERE (? IS NULL OR name LIKE ? OR email LIKE ?)
      ${status === 'ACTIVE' ? 'AND is_active = TRUE' : status === 'INACTIVE' ? 'AND is_active = FALSE' : ''}
    `);
    params.push(searchFilter, searchFilter, searchFilter);
  }

  // Admins
  if (role === 'ALL' || role === 'ADMIN') {
    queries.push(`
      SELECT id, name, email, mobile_number as phone, 'ADMIN' as role, is_active, 'ACTIVE' as account_status, last_login_at, created_at
      FROM admins
      WHERE (? IS NULL OR name LIKE ? OR email LIKE ?)
      ${status === 'ACTIVE' ? 'AND is_active = TRUE' : status === 'INACTIVE' ? 'AND is_active = FALSE' : ''}
    `);
    params.push(searchFilter, searchFilter, searchFilter);
  }

  // Accountants
  if (role === 'ALL' || role === 'ACCOUNTANT') {
    queries.push(`
      SELECT id, name, email, mobile_number as phone, 'ACCOUNTANT' as role, is_active, 'ACTIVE' as account_status, last_login_at, created_at
      FROM accountants
      WHERE (? IS NULL OR name LIKE ? OR email LIKE ?)
      ${status === 'ACTIVE' ? 'AND is_active = TRUE' : status === 'INACTIVE' ? 'AND is_active = FALSE' : ''}
    `);
    params.push(searchFilter, searchFilter, searchFilter);
  }

  // Sellers
  if (role === 'ALL' || role === 'SELLER') {
    queries.push(`
      SELECT id, business_name as name, email, phone, 'SELLER' as role, is_active, account_status, last_login_at, created_at
      FROM sellers
      WHERE (? IS NULL OR business_name LIKE ? OR email LIKE ?)
      ${status === 'ACTIVE' ? 'AND is_active = TRUE AND account_status = "ACTIVE"' : status === 'INACTIVE' ? 'AND (is_active = FALSE OR account_status != "ACTIVE")' : ''}
    `);
    params.push(searchFilter, searchFilter, searchFilter);
  }

  // Customers
  if (role === 'ALL' || role === 'CUSTOMER') {
    queries.push(`
      SELECT id, CONCAT(first_name, ' ', COALESCE(last_name, '')) as name, email, phone, 'CUSTOMER' as role, is_active, 'ACTIVE' as account_status, last_login_at, created_at
      FROM seller_users
      WHERE (? IS NULL OR first_name LIKE ? OR email LIKE ?)
      ${status === 'ACTIVE' ? 'AND is_active = TRUE' : status === 'INACTIVE' ? 'AND is_active = FALSE' : ''}
    `);
    params.push(searchFilter, searchFilter, searchFilter);
  }

  if (queries.length === 0) {
    return { items: [], pagination: { total: 0, page: 1, limit: pageLimit, totalPages: 0 } };
  }

  const unionSql = queries.join(' UNION ALL ');
  const countSql = `SELECT COUNT(*) as total FROM (${unionSql}) as combined;`;
  const [totalCountRows] = await pool.query(countSql, params);
  const total = totalCountRows[0].total;

  const dataSql = `
    SELECT * FROM (${unionSql}) as combined
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?;
  `;
  const [rows] = await pool.query(dataSql, [...params, pageLimit, offset]);

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

/**
 * Super Admin: Safe account status update (Deactivate/Reactivate)
 */
async function updateAccountStatus({ actor, role, userId, isActive, reason = 'Administrative update', ipAddress, userAgent }) {
  const cleanRole = role.toUpperCase();

  // Guard against deactivating self or last Super Admin
  if (cleanRole === 'SUPER_ADMIN' && actor.id === userId && !isActive) {
    throw new ForbiddenError('Super Admins cannot deactivate their own account.');
  }

  let table = '';
  switch (cleanRole) {
    case 'ADMIN':
      table = 'admins';
      break;
    case 'ACCOUNTANT':
      table = 'accountants';
      break;
    case 'SELLER':
      table = 'sellers';
      break;
    case 'CUSTOMER':
      table = 'seller_users';
      break;
    case 'SUPER_ADMIN':
      table = 'super_admins';
      break;
    default:
      throw new ValidationError(`Unsupported account role: ${role}`);
  }

  const [existing] = await pool.query(`SELECT id, is_active, email FROM \`${table}\` WHERE id = ?;`, [userId]);
  if (existing.length === 0) {
    throw new NotFoundError(`Account not found in ${cleanRole} directory.`);
  }

  const newActive = Boolean(isActive);

  if (cleanRole === 'SELLER') {
    const newAccountStatus = newActive ? 'ACTIVE' : 'SUSPENDED';
    await pool.query(
      'UPDATE sellers SET is_active = ?, account_status = ?, updated_at = NOW() WHERE id = ?;',
      [newActive, newAccountStatus, userId]
    );
  } else {
    await pool.query(
      `UPDATE \`${table}\` SET is_active = ?, updated_at = NOW() WHERE id = ?;`,
      [newActive, userId]
    );
  }

  // Audit log entry
  await auditService.logAction({
    actorId: actor.id,
    actorType: actor.role,
    actorName: actor.name || actor.email,
    action: newActive ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DEACTIVATED',
    targetId: userId,
    targetType: cleanRole,
    details: { email: existing[0].email, previousActive: existing[0].is_active, newActive },
    ipAddress,
    userAgent,
    reason
  });

  return {
    userId,
    role: cleanRole,
    isActive: newActive,
    email: existing[0].email,
    message: `Account ${existing[0].email} has been ${newActive ? 'reactivated' : 'deactivated'}.`
  };
}

/**
 * Admin & Super Admin: Operational Metrics
 */
async function getAdminOperationalMetrics() {
  const [pendingReviews] = await pool.query(`
    SELECT COUNT(*) AS total FROM sellers WHERE verification_status IN ('PENDING', 'UNDER_REVIEW');
  `);

  const [activeOrders] = await pool.query(`
    SELECT COUNT(*) AS total FROM orders WHERE order_status IN ('PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY');
  `);

  const [openTickets] = await pool.query(`
    SELECT COUNT(*) AS total FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS');
  `);

  const [lowStock] = await pool.query(`
    SELECT COUNT(*) AS total FROM products WHERE stock_quantity <= low_stock_threshold AND is_active = TRUE;
  `);

  // Recent 10 orders across shops
  const [recentOrders] = await pool.query(`
    SELECT o.id, o.order_number, o.total_amount, o.order_status, o.payment_status, o.recipient_name, o.created_at, s.business_name
    FROM orders o
    JOIN sellers s ON o.seller_id = s.id
    ORDER BY o.created_at DESC
    LIMIT 10;
  `);

  // Recent 10 support tickets
  const [recentTickets] = await pool.query(`
    SELECT t.id, t.ticket_number, t.subject, t.category, t.priority, t.status, t.created_at
    FROM support_tickets t
    ORDER BY t.created_at DESC
    LIMIT 10;
  `);

  return {
    metrics: {
      pendingReviews: pendingReviews[0].total || 0,
      activeOrders: activeOrders[0].total || 0,
      openTickets: openTickets[0].total || 0,
      lowStockProducts: lowStock[0].total || 0
    },
    recentOrders,
    recentTickets
  };
}

/**
 * Super Admin: System Configuration
 */
async function getPlatformConfig() {
  const [dbStatus] = await pool.query('SELECT VERSION() as version, DATABASE() as dbName;');

  return {
    environment: config.nodeEnv,
    paymentProvider: config.payment.provider,
    razorpayKeyId: config.payment.razorpayKeyId,
    commissionRatePercent: config.payment.commissionRatePercent,
    database: {
      status: 'CONNECTED',
      name: dbStatus[0]?.dbName,
      version: dbStatus[0]?.version
    },
    uptimeSeconds: Math.floor(process.uptime())
  };
}

/**
 * Super Admin: Update Platform Configuration
 */
async function updatePlatformConfig({ actor, commissionRatePercent, reason, ipAddress, userAgent }) {
  const rate = parseFloat(commissionRatePercent);
  if (isNaN(rate) || rate < 0 || rate > 50) {
    throw new ValidationError('Platform commission must be between 0% and 50%.');
  }

  const oldRate = config.payment.commissionRatePercent;
  config.payment.commissionRatePercent = rate;

  await auditService.logAction({
    actorId: actor.id,
    actorType: actor.role,
    actorName: actor.name || actor.email,
    action: 'PLATFORM_CONFIG_UPDATED',
    details: { setting: 'commissionRatePercent', oldRate, newRate: rate },
    ipAddress,
    userAgent,
    reason: reason || 'Commission rate policy change'
  });

  return {
    commissionRatePercent: rate,
    message: 'Platform commission rate updated successfully.'
  };
}

/**
 * Super Admin: Suspend an already-approved shop
 * Enforces mandatory reason, status updates, and audit persistence.
 */
async function suspendShop({ actor, sellerId, reason, ipAddress, userAgent }) {
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    throw new ValidationError('A detailed suspension reason (minimum 5 characters) is required.');
  }

  const [rows] = await pool.query(
    'SELECT id, business_name, email, account_status, verification_status, is_active FROM sellers WHERE id = ? LIMIT 1;',
    [sellerId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Sweet shop seller not found.');
  }

  const seller = rows[0];

  // Update seller account_status to SUSPENDED, is_active = FALSE
  await pool.query(
    `UPDATE sellers 
     SET account_status = 'SUSPENDED',
         is_active = FALSE,
         rejection_reason = ?,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [`Suspended by Super Admin: ${reason.trim()}`, sellerId]
  );

  // Persistent Audit Log
  await auditService.logAction({
    actorId: actor.id,
    actorType: actor.role || 'SUPER_ADMIN',
    actorName: actor.name || actor.email,
    action: 'SHOP_SUSPENDED',
    targetId: sellerId,
    targetType: 'SHOP',
    details: {
      businessName: seller.business_name,
      email: seller.email,
      previousAccountStatus: seller.account_status,
      previousActive: seller.is_active,
      newAccountStatus: 'SUSPENDED',
      newActive: false
    },
    ipAddress,
    userAgent,
    reason: reason.trim()
  });

  return {
    sellerId,
    businessName: seller.business_name,
    accountStatus: 'SUSPENDED',
    isActive: false,
    message: `Sweet shop "${seller.business_name}" has been suspended successfully.`
  };
}

/**
 * Super Admin: Reactivate an eligible suspended shop
 * Enforces verified status check, mandatory reason, and audit persistence.
 */
async function reactivateShop({ actor, sellerId, reason, ipAddress, userAgent }) {
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    throw new ValidationError('A detailed reactivation reason (minimum 5 characters) is required.');
  }

  const [rows] = await pool.query(
    'SELECT id, business_name, email, account_status, verification_status, is_active FROM sellers WHERE id = ? LIMIT 1;',
    [sellerId]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Sweet shop seller not found.');
  }

  const seller = rows[0];

  if (seller.verification_status !== 'APPROVED') {
    throw new ValidationError(
      `Cannot reactivate shop "${seller.business_name}" because its verification status is ${seller.verification_status}. Seller must be in APPROVED state before reactivation.`
    );
  }

  // Restore account_status to ACTIVE, is_active = TRUE
  await pool.query(
    `UPDATE sellers 
     SET account_status = 'ACTIVE',
         is_active = TRUE,
         rejection_reason = NULL,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?;`,
    [sellerId]
  );

  // Persistent Audit Log
  await auditService.logAction({
    actorId: actor.id,
    actorType: actor.role || 'SUPER_ADMIN',
    actorName: actor.name || actor.email,
    action: 'SHOP_REACTIVATED',
    targetId: sellerId,
    targetType: 'SHOP',
    details: {
      businessName: seller.business_name,
      email: seller.email,
      previousAccountStatus: seller.account_status,
      previousActive: seller.is_active,
      newAccountStatus: 'ACTIVE',
      newActive: true
    },
    ipAddress,
    userAgent,
    reason: reason.trim()
  });

  return {
    sellerId,
    businessName: seller.business_name,
    accountStatus: 'ACTIVE',
    isActive: true,
    message: `Sweet shop "${seller.business_name}" has been reactivated successfully.`
  };
}

module.exports = {
  getSuperAdminAnalytics,
  getSalesTrends,
  getTopPerformers,
  listAllAccounts,
  updateAccountStatus,
  getAdminOperationalMetrics,
  getPlatformConfig,
  updatePlatformConfig,
  suspendShop,
  reactivateShop
};
