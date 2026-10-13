import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as adminApi from '../api/admin.api';
import * as sellerApi from '../api/seller.api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import DocumentPreviewModal from '../components/admin/DocumentPreviewModal';
import SalesTrajectoryChart from '../components/admin/SalesTrajectoryChart';
import {
  ShieldAlert,
  TrendingUp,
  Store,
  Users,
  Award,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserPlus,
  RefreshCw,
  Search,
  DollarSign,
  Activity,
  Calendar,
  Lock,
  Eye,
  CheckCircle2,
  Clock,
  Sliders
} from 'lucide-react';

export default function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('overview'); // overview, accounts, sellers, audit, config
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [salesTrends, setSalesTrends] = useState([]);
  const [topPerformers, setTopPerformers] = useState(null);
  const [trendDays, setTrendDays] = useState(7);
  const [isTrendsLoading, setIsTrendsLoading] = useState(false);

  // Accounts Management State
  const [accounts, setAccounts] = useState([]);
  const [accountRoleFilter, setAccountRoleFilter] = useState('ALL');
  const [accountSearch, setAccountSearch] = useState('');
  const [accountStatusFilter, setAccountStatusFilter] = useState('ALL');
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsPagination, setAccountsPagination] = useState(null);
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);

  // Account Status Modal
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    account: null,
    newStatus: false,
    reason: ''
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Staff Creation Modals
  const [staffModal, setStaffModal] = useState({ isOpen: false, type: 'ADMIN' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', mobileNumber: '' });
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Seller Compliance State
  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerDocs, setSellerDocs] = useState([]);
  const [reviewAction, setReviewAction] = useState(null); // 'APPROVED' | 'REJECTED'
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  // Platform Config State
  const [platformConfig, setPlatformConfig] = useState(null);
  const [configCommission, setConfigCommission] = useState('10.0');
  const [configReason, setConfigReason] = useState('');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Shop Suspension Modal State (Task B)
  const [shopSuspensionModal, setShopSuspensionModal] = useState({
    isOpen: false,
    shop: null,
    action: 'SUSPEND', // 'SUSPEND' or 'REACTIVATE'
    reason: ''
  });
  const [isSubmittingShopAction, setIsSubmittingShopAction] = useState(false);

  // Load Main Analytics & Config
  const loadOverviewData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsRes, trendsRes, performersRes, configRes] = await Promise.all([
        adminApi.getSuperAdminAnalytics(),
        adminApi.getSalesTrends({ days: trendDays }),
        adminApi.getTopPerformers(),
        adminApi.getPlatformConfig()
      ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (trendsRes.success) setSalesTrends(trendsRes.data || []);
      if (performersRes.success) setTopPerformers(performersRes.data);
      if (configRes.success) {
        setPlatformConfig(configRes.data);
        setConfigCommission(String(configRes.data.commissionRatePercent || '10.0'));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Super Admin metrics.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshTelemetry = async () => {
    setIsRefreshing(true);
    try {
      await loadOverviewData();
      if (activeTab === 'accounts') await loadAccounts(accountsPage);
      if (activeTab === 'sellers') await loadSellers();
      if (activeTab === 'audit') await loadAuditLogs(auditPage);
      if (activeTab === 'config') await loadOverviewData();
      showToast('Telemetry and platform data refreshed.', 'success');
    } catch {
      showToast('Could not refresh all platform metrics.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectTrendDays = async (days) => {
    setTrendDays(days);
    setIsTrendsLoading(true);
    try {
      const res = await adminApi.getSalesTrends({ days });
      if (res.success) {
        setSalesTrends(res.data || []);
      }
    } catch {
      showToast('Could not load sales trends for selected window.', 'error');
    } finally {
      setIsTrendsLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();
  }, []);

  // Load Accounts
  const loadAccounts = async (page = 1) => {
    setIsAccountsLoading(true);
    try {
      const res = await adminApi.listAllAccounts({
        role: accountRoleFilter,
        search: accountSearch,
        status: accountStatusFilter,
        page,
        limit: 15
      });
      if (res.success) {
        setAccounts(res.data || []);
        setAccountsPagination(res.pagination);
        setAccountsPage(page);
      }
    } catch (err) {
      showToast('Could not load accounts list.', 'error');
    } finally {
      setIsAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accounts') {
      loadAccounts(1);
    }
  }, [activeTab, accountRoleFilter, accountStatusFilter]);

  // Load Sellers
  const loadSellers = async () => {
    try {
      const res = await sellerApi.listSellersForAdmin();
      setSellers(res.data || []);
    } catch (err) {
      showToast('Failed to load seller verification records.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'sellers') {
      loadSellers();
    }
  }, [activeTab]);

  // Load Audit Logs
  const loadAuditLogs = async (page = 1) => {
    try {
      const res = await adminApi.listAuditLogs({
        page,
        limit: 20,
        action: auditActionFilter || undefined
      });
      if (res.success) {
        setAuditLogs(res.data || []);
        setAuditPagination(res.pagination);
        setAuditPage(page);
      }
    } catch (err) {
      showToast('Failed to retrieve system audit logs.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs(1);
    }
  }, [activeTab, auditActionFilter]);

  // Account Status Toggle Handler
  const handleToggleStatus = async (e) => {
    e.preventDefault();
    if (!statusModal.account) return;
    setIsUpdatingStatus(true);
    try {
      const res = await adminApi.updateAccountStatus(
        statusModal.account.role,
        statusModal.account.id,
        {
          isActive: statusModal.newStatus,
          reason: statusModal.reason.trim() || 'Super Admin operational override'
        }
      );
      if (res.success) {
        showToast(res.message, 'success');
        setStatusModal({ isOpen: false, account: null, newStatus: false, reason: '' });
        await loadAccounts(accountsPage);
        await loadOverviewData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update account status.', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Staff Creation Handler
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setIsCreatingStaff(true);
    try {
      if (staffModal.type === 'ADMIN') {
        await adminApi.createAdminStaff(staffForm);
        showToast(`Administrator account created successfully: ${staffForm.email}`, 'success');
      } else {
        await adminApi.createAccountantStaff(staffForm);
        showToast(`Accountant account created successfully: ${staffForm.email}`, 'success');
      }
      setStaffModal({ isOpen: false, type: 'ADMIN' });
      setStaffForm({ name: '', email: '', password: '', mobileNumber: '' });
      await loadAccounts(1);
      await loadOverviewData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Staff creation failed.', 'error');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Seller Review Handlers
  const handleInspectSeller = async (seller) => {
    setSelectedSeller(seller);
    try {
      const docsRes = await sellerApi.getSellerDocumentsForAdmin(seller.id);
      setSellerDocs(docsRes.data || []);
    } catch {
      setSellerDocs([]);
    }
  };

  const handleReviewSubmit = async (status) => {
    if (!selectedSeller) return;
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      showToast('Rejection reason is required.', 'error');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await sellerApi.reviewSellerApplication(selectedSeller.id, {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : null
      });

      if (res.success) {
        showToast(`Seller application ${status.toLowerCase()} successfully!`, 'success');
        setReviewAction(null);
        setSelectedSeller(null);
        setRejectionReason('');
        await loadSellers();
        await loadOverviewData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Review submission failed.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Shop Suspension & Reactivation Handler (Task B)
  const handleShopActionSubmit = async (e) => {
    e.preventDefault();
    if (!shopSuspensionModal.shop) return;
    if (!shopSuspensionModal.reason.trim() || shopSuspensionModal.reason.trim().length < 5) {
      showToast('Please provide a detailed reason (at least 5 characters).', 'error');
      return;
    }
    setIsSubmittingShopAction(true);
    try {
      if (shopSuspensionModal.action === 'SUSPEND') {
        const res = await adminApi.suspendShop(shopSuspensionModal.shop.id, shopSuspensionModal.reason.trim());
        showToast(res.message || `Sweet shop "${shopSuspensionModal.shop.business_name}" suspended.`, 'success');
      } else {
        const res = await adminApi.reactivateShop(shopSuspensionModal.shop.id, shopSuspensionModal.reason.trim());
        showToast(res.message || `Sweet shop "${shopSuspensionModal.shop.business_name}" reactivated.`, 'success');
      }
      setShopSuspensionModal({ isOpen: false, shop: null, action: 'SUSPEND', reason: '' });
      setSelectedSeller(null);
      await loadSellers();
      await loadOverviewData();
    } catch (err) {
      showToast(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Shop action failed.', 'error');
    } finally {
      setIsSubmittingShopAction(false);
    }
  };

  // Platform Commission Update
  const handleUpdateCommission = async (e) => {
    e.preventDefault();
    setIsUpdatingConfig(true);
    try {
      const res = await adminApi.updatePlatformConfig({
        commissionRatePercent: parseFloat(configCommission),
        reason: configReason.trim() || 'Updated by Super Admin in control center'
      });
      if (res.success) {
        showToast('Platform commission percentage updated successfully!', 'success');
        setConfigReason('');
        await loadOverviewData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Commission update failed.', 'error');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading Super Admin Control Center..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadOverviewData} />;
  }

  const { today, lifetime, sellers: sellerCounts, accounts: accountCounts } = analytics || {};

  return (
    <div style={{ padding: '2.5rem 0 5rem', background: '#FDFBF7', minHeight: '85vh' }}>
      <div className="container">
        {/* Header Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #7A1C1C 0%, #4A0012 100%)',
          color: '#FFFFFF',
          padding: '2rem 2.25rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 25px -5px rgba(122, 28, 28, 0.3)',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
              <span className="badge badge-gold" style={{ fontSize: '0.72rem', letterSpacing: '0.8px', padding: '3px 8px' }}>
                SUPER ADMIN CONTROL CENTER
              </span>
              <span style={{ fontSize: '0.8rem', color: '#FADBD8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldAlert size={14} /> Full Executive Access
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-serif)', color: '#FFFFFF' }}>
              Mithai Mahal Executive Command
            </h1>
            <p style={{ margin: '0.4rem 0 0', color: '#F5B7B1', fontSize: '0.9rem' }}>
              Platform revenue, compliance audits, seller verifications, and global account lifecycle.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleRefreshTelemetry}
              disabled={isRefreshing}
              className="btn btn-outline"
              style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#FFFFFF', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>
            <button
              onClick={() => { setStaffModal({ isOpen: true, type: 'ADMIN' }); }}
              className="btn"
              style={{ background: 'var(--gold-primary)', color: '#7A1C1C', fontWeight: 700, padding: '0.6rem 1.1rem' }}
            >
              <UserPlus size={16} />
              <span>Provision Admin</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border-subtle)',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}>
          {[
            { id: 'overview', label: 'Executive Overview', icon: TrendingUp },
            { id: 'accounts', label: 'Account Directory', icon: Users },
            { id: 'sellers', label: 'Seller Compliance & KYC', icon: Store },
            { id: 'audit', label: 'Audit Trail & Security', icon: FileText },
            { id: 'config', label: 'Platform Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.8rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--maroon-primary)' : '3px solid transparent',
                  color: isActive ? 'var(--maroon-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: EXECUTIVE OVERVIEW                                          */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'overview' && (
          <div>
            {/* KPI Cards: Today */}
            <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} />
              <span>Today's Live Financial Performance</span>
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem'
            }}>
              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--maroon-primary)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Today's Revenue
                </span>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--maroon-primary)', marginTop: '0.2rem' }}>
                  ₹{Number(today?.revenue || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--veg-green)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={13} /> {today?.successfulPayments || 0} verified payments
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #0D83FF' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Today's Orders
                </span>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0C2340', marginTop: '0.2rem' }}>
                  {today?.ordersCount || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {today?.completedOrders || 0} delivered &bull; {today?.cancelledOrders || 0} cancelled
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #E67E22' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Pending Seller KYC
                </span>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#D35400', marginTop: '0.2rem' }}>
                  {sellerCounts?.pendingApprovals || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Out of {sellerCounts?.totalSellers || 0} total vendors
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--gold-primary)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Platform Commission
                </span>
                <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#7A1C1C', marginTop: '0.2rem' }}>
                  ₹{Number(lifetime?.commissionRetained || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Total platform earnings
                </div>
              </div>
            </div>

            {/* Sales Trends Chart Representation */}
            <SalesTrajectoryChart
              data={salesTrends}
              selectedDays={trendDays}
              onSelectDays={handleSelectTrendDays}
              isLoading={isTrendsLoading}
            />

            {/* Top Performers Ranking Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {/* Top Sweets */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} color="var(--gold-primary)" />
                  <span>Best-Selling Sweets (Units Sold)</span>
                </h3>
                {topPerformers?.topProducts?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No product volume yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {topPerformers?.topProducts?.map((p, idx) => (
                      <div key={p.productId || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-cream)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--maroon-primary)' }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.productName}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{p.price.toFixed(2)} / pack</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge badge-maroon" style={{ fontSize: '0.75rem' }}>{p.unitsSold} units</span>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>₹{p.totalRevenue.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Sweet Shops */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Store size={18} color="var(--gold-primary)" />
                  <span>Top Sweet Shops (Verified Sales)</span>
                </h3>
                {topPerformers?.topShops?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No shop sales recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {topPerformers?.topShops?.map((s, idx) => (
                      <div key={s.shopId || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-cream)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--maroon-primary)' }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.shopName}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.city} &bull; {s.totalPaidOrders} paid orders</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--veg-green)', fontSize: '0.92rem' }}>₹{s.verifiedRevenue.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: ACCOUNT MANAGEMENT                                          */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'accounts' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', margin: 0 }}>
                  Platform Account Governance
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Manage administrative staff, vendor shops, and customer accounts with safe deactivation.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setStaffModal({ isOpen: true, type: 'ADMIN' })}
                  className="btn btn-primary btn-sm"
                >
                  <UserPlus size={15} />
                  <span>Create Admin</span>
                </button>
                <button
                  onClick={() => setStaffModal({ isOpen: true, type: 'ACCOUNTANT' })}
                  className="btn btn-outline btn-sm"
                >
                  <UserPlus size={15} />
                  <span>Create Accountant</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadAccounts(1); }}
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              <select value={accountRoleFilter} onChange={(e) => setAccountRoleFilter(e.target.value)}>
                <option value="ALL">All Roles</option>
                <option value="ADMIN">Platform Admins</option>
                <option value="ACCOUNTANT">Accountants</option>
                <option value="SELLER">Sweet Shop Sellers</option>
                <option value="CUSTOMER">Customers</option>
                <option value="SUPER_ADMIN">Super Admins</option>
              </select>

              <select value={accountStatusFilter} onChange={(e) => setAccountStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated / Suspended Only</option>
              </select>

              <button onClick={() => loadAccounts(1)} className="btn btn-outline btn-sm">
                <Search size={15} />
                <span>Filter Accounts</span>
              </button>
            </div>

            {/* Table */}
            {isAccountsLoading ? (
              <LoadingSpinner text="Retrieving accounts..." />
            ) : accounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No platform accounts matched the search filter criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-cream)', textAlign: 'left', borderBottom: '2px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>User / Business</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email & Phone</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => {
                      const isSelf = user?.id === acc.id;
                      return (
                        <tr key={`${acc.role}-${acc.id}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {acc.name || 'Unnamed User'}
                            {isSelf && <span className="badge badge-gold" style={{ marginLeft: '6px', fontSize: '0.68rem' }}>YOU</span>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {acc.email}
                            {acc.phone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{acc.phone}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={`badge ${acc.role === 'SUPER_ADMIN' ? 'badge-maroon' : acc.role === 'ADMIN' ? 'badge-gold' : acc.role === 'SELLER' ? 'badge-success' : ''}`}>
                              {acc.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {acc.is_active ? (
                              <span style={{ color: 'var(--veg-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={14} /> Active
                              </span>
                            ) : (
                              <span style={{ color: '#E74C3C', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <XCircle size={14} /> Suspended
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {String(acc.created_at).slice(0, 10)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            {isSelf ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Protected</span>
                            ) : (
                              <button
                                onClick={() => setStatusModal({
                                  isOpen: true,
                                  account: acc,
                                  newStatus: !acc.is_active,
                                  reason: ''
                                })}
                                className={`btn btn-sm ${acc.is_active ? 'btn-outline' : 'btn-primary'}`}
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                              >
                                {acc.is_active ? 'Deactivate' : 'Reactivate'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: SELLER COMPLIANCE & KYC                                      */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'sellers' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', margin: 0 }}>
                  Sweet Shop Compliance & Document Review
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Inspect FSSAI license, GSTIN, and business credentials before approving public catalog listings.
                </p>
              </div>

              <button
                onClick={loadSellers}
                disabled={isRefreshing}
                className="btn btn-outline btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
                <span>Refresh Sellers</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selectedSeller ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
              {/* Seller List */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-cream)', textAlign: 'left', borderBottom: '2px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.7rem' }}>Shop Name</th>
                      <th style={{ padding: '0.7rem' }}>Email / Phone</th>
                      <th style={{ padding: '0.7rem' }}>Status</th>
                      <th style={{ padding: '0.7rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s) => {
                      const isSuspended = s.account_status === 'SUSPENDED' || !s.is_active;
                      return (
                        <tr
                          key={s.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: selectedSeller?.id === s.id ? '#FFF5F5' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '0.7rem', fontWeight: 600 }}>
                            {s.business_name}
                            {s.city && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{s.city}</div>}
                          </td>
                          <td style={{ padding: '0.7rem', color: 'var(--text-secondary)' }}>
                            {s.email}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.phone}</div>
                          </td>
                          <td style={{ padding: '0.7rem' }}>
                            {s.verification_status === 'APPROVED' ? (
                              isSuspended ? (
                                <span className="badge" style={{ background: '#FADBD8', color: '#922B21' }}>SUSPENDED</span>
                              ) : (
                                <span className="badge badge-success">APPROVED</span>
                              )
                            ) : s.verification_status === 'REJECTED' ? (
                              <span className="badge badge-maroon">REJECTED</span>
                            ) : (
                              <span className="badge badge-gold">PENDING KYC</span>
                            )}
                          </td>
                          <td style={{ padding: '0.7rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleInspectSeller(s)}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Inspector Pane */}
              {selectedSeller && (
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--border-subtle)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--maroon-primary)' }}>
                        {selectedSeller.business_name}
                      </h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Owner: {selectedSeller.owner_name || 'N/A'} &bull; GSTIN: <code>{selectedSeller.gstin || 'Not Provided'}</code>
                      </p>
                      {selectedSeller.rejection_reason && (
                        <div style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#922B21', background: '#FADBD8', padding: '4px 8px', borderRadius: '4px' }}>
                          <strong>Notice:</strong> {selectedSeller.rejection_reason}
                        </div>
                      )}
                    </div>
                    <button onClick={() => setSelectedSeller(null)} className="btn btn-outline btn-sm" style={{ padding: '2px 6px' }}>
                      Close
                    </button>
                  </div>

                  {/* Documents List */}
                  <div>
                    <h5 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Compliance Documents:
                    </h5>
                    {sellerDocs.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.75rem', background: 'var(--bg-cream)', borderRadius: '4px' }}>
                        No uploaded KYC documents on file.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sellerDocs.map((doc) => {
                          const isPlaceholder = doc.is_placeholder || doc.file_name === 'Pending Document File';
                          const hasFile = doc.has_file && !isPlaceholder;
                          return (
                            <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0.6rem', background: '#F8F9FA', borderRadius: '4px', fontSize: '0.82rem', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FileText size={16} color="var(--maroon-primary)" />
                                  <span>
                                    {doc.document_type}: <strong>{isPlaceholder ? 'Placeholder — File Pending' : doc.file_name}</strong>
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isPlaceholder ? (
                                    <span className="badge" style={{ background: '#FADBD8', color: '#922B21', fontSize: '0.68rem' }}>FILE MISSING</span>
                                  ) : (
                                    <span className={`badge ${doc.verification_status === 'APPROVED' ? 'badge-success' : doc.verification_status === 'REJECTED' ? 'badge-maroon' : 'badge-gold'}`} style={{ fontSize: '0.68rem' }}>
                                      {doc.verification_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {doc.rejection_reason && (
                                <div style={{ fontSize: '0.75rem', color: '#C0392B', background: '#FDEDEC', padding: '4px 8px', borderRadius: '4px' }}>
                                  <strong>Rejection Note:</strong> {doc.rejection_reason}
                                </div>
                              )}
                              {hasFile && (
                                <div style={{ marginTop: '2px' }}>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewDoc(doc)}
                                    className="btn btn-outline btn-sm"
                                    style={{ padding: '2px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Eye size={12} />
                                    <span>Inspect Secure KYC Document</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Review / Governance Actions */}
                  <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    {selectedSeller.verification_status === 'APPROVED' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {selectedSeller.account_status === 'SUSPENDED' || !selectedSeller.is_active ? (
                          <button
                            onClick={() => setShopSuspensionModal({
                              isOpen: true,
                              shop: selectedSeller,
                              action: 'REACTIVATE',
                              reason: ''
                            })}
                            className="btn btn-primary btn-sm"
                            style={{ width: '100%', justifyContent: 'center', background: 'var(--veg-green)', borderColor: 'var(--veg-green)' }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Reactivate Suspended Shop</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setShopSuspensionModal({
                              isOpen: true,
                              shop: selectedSeller,
                              action: 'SUSPEND',
                              reason: ''
                            })}
                            className="btn btn-outline btn-sm"
                            style={{ width: '100%', justifyContent: 'center', borderColor: '#E74C3C', color: '#E74C3C' }}
                          >
                            <ShieldAlert size={15} />
                            <span>Suspend Shop</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <button
                            onClick={() => handleReviewSubmit('APPROVED')}
                            disabled={isSubmittingReview}
                            className="btn btn-primary btn-sm"
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Approve Seller</span>
                          </button>
                          <button
                            onClick={() => setReviewAction('REJECTED')}
                            disabled={isSubmittingReview}
                            className="btn btn-outline btn-sm"
                            style={{ flex: 1, justifyContent: 'center', borderColor: '#E74C3C', color: '#E74C3C' }}
                          >
                            <XCircle size={15} />
                            <span>Reject Application</span>
                          </button>
                        </div>

                        {reviewAction === 'REJECTED' && (
                          <div style={{ marginTop: '0.75rem', background: '#FDEDEC', padding: '0.75rem', borderRadius: '6px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#922B21', marginBottom: '4px' }}>
                              Mandatory Rejection Reason *
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Invalid FSSAI certificate expiry date, please re-upload clear PDF..."
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              required
                              style={{ fontSize: '0.82rem' }}
                            />
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                              <button
                                onClick={() => handleReviewSubmit('REJECTED')}
                                disabled={isSubmittingReview}
                                className="btn btn-primary btn-sm"
                                style={{ background: '#C0392B', borderColor: '#C0392B' }}
                              >
                                Confirm Rejection
                              </button>
                              <button onClick={() => setReviewAction(null)} className="btn btn-outline btn-sm">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 4: AUDIT TRAIL & SECURITY                                      */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'audit' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', margin: 0 }}>
                  System Audit Trail & Security Events
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                  Immutable log of administrative overrides, status modifications, and gateway events.
                </p>
              </div>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{ width: '220px' }}
              >
                <option value="">All Action Types</option>
                <option value="ACCOUNT_DEACTIVATED">Account Deactivations</option>
                <option value="ACCOUNT_REACTIVATED">Account Reactivations</option>
                <option value="PLATFORM_CONFIG_UPDATED">Config Modifications</option>
                <option value="SELLER_REVIEW">Seller Reviews</option>
              </select>
            </div>

            {auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No audit events recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-cream)', textAlign: 'left', borderBottom: '2px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.7rem' }}>Timestamp</th>
                      <th style={{ padding: '0.7rem' }}>Action</th>
                      <th style={{ padding: '0.7rem' }}>Actor</th>
                      <th style={{ padding: '0.7rem' }}>Target</th>
                      <th style={{ padding: '0.7rem' }}>Reason & Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {String(log.created_at).replace('T', ' ').slice(0, 19)}
                        </td>
                        <td style={{ padding: '0.7rem' }}>
                          <span className="badge badge-maroon" style={{ fontSize: '0.72rem' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem', fontWeight: 600 }}>
                          {log.actor_name}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.actor_type}</div>
                        </td>
                        <td style={{ padding: '0.7rem' }}>
                          {log.target_type && <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>{log.target_type}</span>}
                          {log.target_id && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.target_id.slice(0, 8)}...</div>}
                        </td>
                        <td style={{ padding: '0.7rem', color: 'var(--text-secondary)' }}>
                          {log.reason || 'Standard operational update'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 5: PLATFORM CONFIGURATION                                      */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'config' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Gateway & Environment */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} />
                <span>Active Payment Infrastructure</span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment Gateway Provider:</span>
                  <span className="badge badge-gold" style={{ fontWeight: 700 }}>
                    {String(platformConfig?.paymentProvider).toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Razorpay Mode:</span>
                  <span className="badge badge-success" style={{ fontWeight: 600 }}>
                    TEST MODE (SANDBOX)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Public Test Key ID:</span>
                  <code>{platformConfig?.razorpayKeyId}</code>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Database Status:</span>
                  <span style={{ color: 'var(--veg-green)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} /> CONNECTED ({platformConfig?.database?.name})
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Server Uptime:</span>
                  <span>{Math.floor((platformConfig?.uptimeSeconds || 0) / 60)} minutes</span>
                </div>
              </div>
            </div>

            {/* Platform Commission Rule */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} />
                <span>Platform Commission Rate</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Adjust platform commission retained on seller order subtotals (packaging is reimbursed 100% to sellers).
              </p>

              <form onSubmit={handleUpdateCommission} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Commission Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={configCommission}
                    onChange={(e) => setConfigCommission(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Reason for Adjustment *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Festive promotional fee reduction"
                    value={configReason}
                    onChange={(e) => setConfigReason(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingConfig}
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                >
                  <span>{isUpdatingConfig ? 'Saving...' : 'Update Commission Policy'}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Account Deactivate / Reactivate Modal */}
      <Modal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ isOpen: false, account: null, newStatus: false, reason: '' })}
        title={`${statusModal.newStatus ? 'Reactivate' : 'Deactivate'} Account`}
      >
        <form onSubmit={handleToggleStatus} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Are you sure you want to {statusModal.newStatus ? 'reactivate' : 'deactivate'}{' '}
            <strong>{statusModal.account?.name}</strong> ({statusModal.account?.email})?
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Operational Reason for Audit Log *
            </label>
            <input
              type="text"
              placeholder="e.g. Terms violation review / Seller compliance restored"
              value={statusModal.reason}
              onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setStatusModal({ isOpen: false, account: null, newStatus: false, reason: '' })}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingStatus}
              className={`btn ${statusModal.newStatus ? 'btn-primary' : 'btn-outline'}`}
              style={!statusModal.newStatus ? { borderColor: '#E74C3C', color: '#E74C3C' } : {}}
            >
              {isUpdatingStatus ? 'Processing...' : statusModal.newStatus ? 'Confirm Reactivation' : 'Confirm Deactivation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Provision Staff Modal */}
      <Modal
        isOpen={staffModal.isOpen}
        onClose={() => setStaffModal({ isOpen: false, type: 'ADMIN' })}
        title={`Provision New Platform ${staffModal.type === 'ADMIN' ? 'Administrator' : 'Accountant'}`}
      >
        <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Vikram Sharma"
              value={staffForm.name}
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Official Email Address *</label>
            <input
              type="email"
              placeholder="e.g. vikram.admin@mithaimahal.com"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Mobile Number</label>
            <input
              type="tel"
              placeholder="+919876543210"
              value={staffForm.mobileNumber}
              onChange={(e) => setStaffForm({ ...staffForm, mobileNumber: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>Temporary Initial Password *</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              required
              minLength={8}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setStaffModal({ isOpen: false, type: 'ADMIN' })}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingStaff}
              className="btn btn-primary"
            >
              {isCreatingStaff ? 'Creating...' : `Create ${staffModal.type}`}
            </button>
          </div>
        </form>
      </Modal>

      {/* Shop Suspension / Reactivation Modal (Task B) */}
      <Modal
        isOpen={shopSuspensionModal.isOpen}
        onClose={() => setShopSuspensionModal({ isOpen: false, shop: null, action: 'SUSPEND', reason: '' })}
        title={`${shopSuspensionModal.action === 'SUSPEND' ? 'Suspend Sweet Shop' : 'Reactivate Sweet Shop'}: ${shopSuspensionModal.shop?.business_name || ''}`}
      >
        <form onSubmit={handleShopActionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '0.85rem',
            background: shopSuspensionModal.action === 'SUSPEND' ? '#FDEDEC' : '#EAFAF1',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: shopSuspensionModal.action === 'SUSPEND' ? '#922B21' : '#1E8449',
            border: `1px solid ${shopSuspensionModal.action === 'SUSPEND' ? '#F5B7B1' : '#A9DFBF'}`
          }}>
            {shopSuspensionModal.action === 'SUSPEND' ? (
              <p style={{ margin: 0 }}>
                <strong>Warning:</strong> Suspending this shop will immediately remove it from the public directory and block customers from checking out items from this shop. Past order and payment histories are safely preserved.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                <strong>Notice:</strong> Reactivating this shop will restore its active listing in the sweet shop directory and allow new customer orders.
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Mandatory Action Reason *
            </label>
            <textarea
              rows={3}
              placeholder={shopSuspensionModal.action === 'SUSPEND' ? 'State why this shop is being suspended (e.g. food safety violation, expired FSSAI license)...' : 'State reason for reactivation (e.g. renewed FSSAI license verified)...'}
              value={shopSuspensionModal.reason}
              onChange={(e) => setShopSuspensionModal({ ...shopSuspensionModal, reason: e.target.value })}
              required
              minLength={5}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setShopSuspensionModal({ isOpen: false, shop: null, action: 'SUSPEND', reason: '' })}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingShopAction}
              className="btn btn-primary"
              style={{
                background: shopSuspensionModal.action === 'SUSPEND' ? '#C0392B' : 'var(--veg-green)',
                borderColor: shopSuspensionModal.action === 'SUSPEND' ? '#C0392B' : 'var(--veg-green)'
              }}
            >
              {isSubmittingShopAction ? 'Processing...' : shopSuspensionModal.action === 'SUSPEND' ? 'Confirm Shop Suspension' : 'Confirm Shop Reactivation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Secure KYC Document Inspection Modal (Task A) */}
      {previewDoc && selectedSeller && (
        <DocumentPreviewModal
          sellerId={selectedSeller.id}
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
