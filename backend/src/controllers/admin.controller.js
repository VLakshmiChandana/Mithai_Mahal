/**
 * Administrative Control Center & Operational Dashboards Controller
 */

const adminService = require('../services/admin.service');
const auditService = require('../services/audit.service');

async function getSuperAdminAnalytics(req, res, next) {
  try {
    const data = await adminService.getSuperAdminAnalytics();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getSalesTrends(req, res, next) {
  try {
    const { days } = req.query;
    const data = await adminService.getSalesTrends({ days });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getTopPerformers(req, res, next) {
  try {
    const data = await adminService.getTopPerformers();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAllAccounts(req, res, next) {
  try {
    const { role, search, status, page, limit } = req.query;
    const data = await adminService.listAllAccounts({ role, search, status, page, limit });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

async function updateAccountStatus(req, res, next) {
  try {
    const { role, userId } = req.params;
    const { isActive, reason } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await adminService.updateAccountStatus({
      actor: req.user,
      role,
      userId,
      isActive,
      reason,
      ipAddress,
      userAgent
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { page, limit, action, actorType, targetType, startDate, endDate } = req.query;
    const data = await auditService.listAuditLogs({
      page,
      limit,
      action,
      actorType,
      targetType,
      startDate,
      endDate
    });
    res.status(200).json({ success: true, data: data.items, pagination: data.pagination });
  } catch (err) {
    next(err);
  }
}

async function getPlatformConfig(req, res, next) {
  try {
    const data = await adminService.getPlatformConfig();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updatePlatformConfig(req, res, next) {
  try {
    const { commissionRatePercent, reason } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await adminService.updatePlatformConfig({
      actor: req.user,
      commissionRatePercent,
      reason,
      ipAddress,
      userAgent
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
}

async function suspendShop(req, res, next) {
  try {
    const { sellerId } = req.params;
    const { reason } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await adminService.suspendShop({
      actor: req.user,
      sellerId,
      reason,
      ipAddress,
      userAgent
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
}

async function reactivateShop(req, res, next) {
  try {
    const { sellerId } = req.params;
    const { reason } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await adminService.reactivateShop({
      actor: req.user,
      sellerId,
      reason,
      ipAddress,
      userAgent
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (err) {
    next(err);
  }
}

async function getAdminOperationalMetrics(req, res, next) {
  try {
    const data = await adminService.getAdminOperationalMetrics();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSuperAdminAnalytics,
  getSalesTrends,
  getTopPerformers,
  listAllAccounts,
  updateAccountStatus,
  listAuditLogs,
  getPlatformConfig,
  updatePlatformConfig,
  getAdminOperationalMetrics,
  suspendShop,
  reactivateShop
};
