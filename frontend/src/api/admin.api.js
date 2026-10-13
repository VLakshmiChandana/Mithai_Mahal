import apiClient from './client';

// -----------------------------------------------------------------------------
// Super Admin Analytics & Business Intelligence
// -----------------------------------------------------------------------------

export async function getSuperAdminAnalytics() {
  const res = await apiClient.get('/super-admin/analytics/overview');
  return res.data;
}

export async function getSalesTrends(params = {}) {
  const res = await apiClient.get('/super-admin/analytics/sales-trends', { params });
  return res.data;
}

export async function getTopPerformers() {
  const res = await apiClient.get('/super-admin/analytics/top-performers');
  return res.data;
}

// -----------------------------------------------------------------------------
// Super Admin Account Lifecycle Management
// -----------------------------------------------------------------------------

export async function listAllAccounts(params = {}) {
  const res = await apiClient.get('/super-admin/accounts', { params });
  return res.data;
}

export async function updateAccountStatus(role, userId, { isActive, reason }) {
  const res = await apiClient.patch(`/super-admin/accounts/${role}/${userId}/status`, {
    isActive,
    reason
  });
  return res.data;
}

// -----------------------------------------------------------------------------
// Super Admin Platform Audit Logs & Configuration
// -----------------------------------------------------------------------------

export async function listAuditLogs(params = {}) {
  const res = await apiClient.get('/super-admin/audit-logs', { params });
  return res.data;
}

export async function getPlatformConfig() {
  const res = await apiClient.get('/super-admin/config');
  return res.data;
}

export async function updatePlatformConfig(payload) {
  const res = await apiClient.patch('/super-admin/config', payload);
  return res.data;
}

// -----------------------------------------------------------------------------
// Admin & Super Admin Staff Provisioning (Staff Routes)
// -----------------------------------------------------------------------------

export async function createAdminStaff(payload) {
  const res = await apiClient.post('/staff/admins', payload);
  return res.data;
}

export async function createAccountantStaff(payload) {
  const res = await apiClient.post('/staff/accountants', payload);
  return res.data;
}

// -----------------------------------------------------------------------------
// Admin Operational Metrics & Support
// -----------------------------------------------------------------------------

export async function getAdminOperationalMetrics() {
  const res = await apiClient.get('/admin/dashboard/metrics');
  return res.data;
}

// -----------------------------------------------------------------------------
// Super Admin Shop Suspension & Reactivation
// -----------------------------------------------------------------------------

export async function suspendShop(sellerId, reason) {
  const res = await apiClient.post(`/super-admin/shops/${sellerId}/suspend`, { reason });
  return res.data;
}

export async function reactivateShop(sellerId, reason) {
  const res = await apiClient.post(`/super-admin/shops/${sellerId}/reactivate`, { reason });
  return res.data;
}

