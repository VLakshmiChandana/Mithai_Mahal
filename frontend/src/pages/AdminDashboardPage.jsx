import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as adminApi from '../api/admin.api';
import * as sellerApi from '../api/seller.api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import {
  Shield,
  ShoppingBag,
  Store,
  HelpCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  Eye,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DocumentPreviewModal from '../components/admin/DocumentPreviewModal';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);

  // Pending Sellers
  const [pendingSellers, setPendingSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerDocs, setSellerDocs] = useState([]);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboardData = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const [metricsRes, sellersRes] = await Promise.all([
        adminApi.getAdminOperationalMetrics(),
        sellerApi.listSellersForAdmin()
      ]);

      if (metricsRes.success) {
        setMetrics(metricsRes.data?.metrics);
        setRecentOrders(metricsRes.data?.recentOrders || []);
        setRecentTickets(metricsRes.data?.recentTickets || []);
      }

      if (sellersRes.success) {
        const pending = (sellersRes.data || []).filter(
          s => s.verification_status === 'PENDING' || s.verification_status === 'UNDER_REVIEW'
        );
        setPendingSellers(pending);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load operational metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleInspectSeller = async (seller) => {
    setSelectedSeller(seller);
    try {
      const docsRes = await sellerApi.getSellerDocumentsForAdmin(seller.id);
      setSellerDocs(docsRes.data || []);
    } catch {
      setSellerDocs([]);
    }
  };

  const hasMissingDocs = !sellerDocs.length || sellerDocs.some(d => d.is_placeholder || !d.has_file);
  const hasRejectedDocs = sellerDocs.some(d => d.verification_status === 'REJECTED');
  const canApprove = !hasMissingDocs && !hasRejectedDocs && sellerDocs.length > 0;

  let approvalBlockReason = '';
  if (sellerDocs.length === 0) {
    approvalBlockReason = 'No compliance documents submitted yet.';
  } else if (hasRejectedDocs) {
    approvalBlockReason = 'One or more attached documents have been rejected. The seller must re-upload valid documents before approval.';
  } else if (hasMissingDocs) {
    approvalBlockReason = 'Mandatory compliance documents are pending upload or missing files on server.';
  }

  const handleReviewSubmit = async (status) => {
    if (!selectedSeller) return;
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      showToast('Rejection reason is required.', 'error');
      return;
    }
    if (status === 'APPROVED' && !canApprove) {
      showToast(approvalBlockReason || 'Cannot approve seller with invalid or missing documents.', 'error');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await sellerApi.reviewSellerApplication(selectedSeller.id, {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : null
      });

      if (res.success) {
        showToast(`Seller ${status.toLowerCase()} successfully!`, 'success');
        setSelectedSeller(null);
        setReviewAction(null);
        setRejectionReason('');
        await loadDashboardData();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Review failed.';
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading Operations Dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} />;
  }

  return (
    <div style={{ padding: '2.5rem 0 5rem', background: '#FDFBF7', minHeight: '85vh' }}>
      <div className="container">
        {/* Operations Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0C2340 0%, #17375E 100%)',
          color: '#FFFFFF',
          padding: '2rem 2.25rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 10px 25px -5px rgba(12, 35, 64, 0.25)',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
              <span className="badge" style={{ background: '#0D83FF', color: '#FFFFFF', fontSize: '0.72rem', letterSpacing: '0.8px', padding: '3px 8px' }}>
                PLATFORM OPERATIONS ADMIN
              </span>
              <span style={{ fontSize: '0.8rem', color: '#93C5FD', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={14} /> Operational Governance
              </span>
            </div>
            <h1 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-serif)', color: '#FFFFFF' }}>
              Operations Command Dashboard
            </h1>
            <p style={{ margin: '0.4rem 0 0', color: '#CBD5E1', fontSize: '0.9rem' }}>
              Monitor live sweet shop fulfillment, review vendor compliance, and respond to customer tickets.
            </p>
          </div>

          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="btn btn-outline"
            style={{
              borderColor: 'rgba(255,255,255,0.4)',
              color: '#FFFFFF',
              padding: '0.6rem 1rem',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.75 : 1
            }}
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Operations'}</span>
          </button>
        </div>

        {/* Operational KPI Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}>
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #E67E22' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Pending Seller KYC
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#D35400', marginTop: '0.2rem' }}>
                  {metrics?.pendingReviews || 0}
                </div>
              </div>
              <Store size={24} color="#D35400" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
              Awaiting compliance document audit
            </p>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--maroon-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Active Orders
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--maroon-primary)', marginTop: '0.2rem' }}>
                  {metrics?.activeOrders || 0}
                </div>
              </div>
              <ShoppingBag size={24} color="var(--maroon-primary)" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
              In kitchen preparation & delivery transit
            </p>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3498DB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Support Queue
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2980B9', marginTop: '0.2rem' }}>
                  {metrics?.openTickets || 0}
                </div>
              </div>
              <HelpCircle size={24} color="#2980B9" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
              Open customer tickets requiring resolution
            </p>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #C0392B' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Low Stock Sweets
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#C0392B', marginTop: '0.2rem' }}>
                  {metrics?.lowStockProducts || 0}
                </div>
              </div>
              <AlertTriangle size={24} color="#C0392B" />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
              Items below vendor safety thresholds
            </p>
          </div>
        </div>

        {/* Section: Pending Seller Approvals Queue */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', margin: 0 }}>
                Pending Seller Verification Applications ({pendingSellers.length})
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                Review and approve newly submitted sweet shop onboarding applications.
              </p>
            </div>
            <Link to="/admin/sellers" className="btn btn-outline btn-sm">
              <span>Full Seller Directory</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {pendingSellers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--veg-green)', fontWeight: 600 }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem' }} />
              All sweet shop onboarding applications have been reviewed!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selectedSeller ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-cream)', textAlign: 'left', borderBottom: '2px solid var(--border-subtle)' }}>
                      <th style={{ padding: '0.65rem' }}>Shop Name</th>
                      <th style={{ padding: '0.65rem' }}>Contact</th>
                      <th style={{ padding: '0.65rem' }}>Status</th>
                      <th style={{ padding: '0.65rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSellers.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: selectedSeller?.id === s.id ? '#FFF5F5' : 'transparent' }}>
                        <td style={{ padding: '0.65rem', fontWeight: 600 }}>{s.business_name}</td>
                        <td style={{ padding: '0.65rem', color: 'var(--text-secondary)' }}>{s.email}</td>
                        <td style={{ padding: '0.65rem' }}>
                          <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>{s.verification_status}</span>
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                          <button onClick={() => handleInspectSeller(s)} className="btn btn-outline btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Review Pane */}
              {selectedSeller && (
                <div style={{ background: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--border-subtle)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--maroon-primary)' }}>{selectedSeller.business_name}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GSTIN: {selectedSeller.gstin || 'Pending'}</div>
                    </div>
                    <button onClick={() => setSelectedSeller(null)} className="btn btn-outline btn-sm" style={{ padding: '2px 6px' }}>Close</button>
                  </div>

                  <div style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    <strong>Attached Documents ({sellerDocs.length}):</strong>
                    {sellerDocs.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontStyle: 'italic' }}>
                        No compliance documents uploaded yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {sellerDocs.map(d => {
                          const isPlaceholder = d.is_placeholder || !d.has_file || d.file_path === 'PENDING_UPLOAD' || d.file_name === 'Pending Document File';
                          return (
                            <div
                              key={d.id}
                              onClick={() => {
                                if (!isPlaceholder) setPreviewDoc(d);
                              }}
                              style={{
                                padding: '8px 10px',
                                background: '#F8F9FA',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: !isPlaceholder ? 'pointer' : 'default',
                                transition: 'background 0.15s ease'
                              }}
                              title={!isPlaceholder ? 'Click to preview document' : 'Document awaiting upload by seller'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <FileText size={14} style={{ color: !isPlaceholder ? 'var(--maroon-primary)' : 'var(--text-muted)' }} />
                                <span style={{ fontWeight: 600, color: 'var(--maroon-primary)' }}>{d.document_type?.replace(/_/g, ' ')}</span>:
                                <span style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{d.file_name}</span>
                                {isPlaceholder ? (
                                  <span className="badge badge-warning" style={{ fontSize: '0.68rem', marginLeft: '4px' }}>
                                    FILE MISSING / PLACEHOLDER
                                  </span>
                                ) : (
                                  <span className="badge badge-success" style={{ fontSize: '0.68rem', marginLeft: '4px' }}>
                                    AVAILABLE ({((d.file_size || 0) / 1024).toFixed(1)} KB)
                                  </span>
                                )}
                              </div>
                              {!isPlaceholder ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewDoc(d);
                                  }}
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye size={12} /> View File
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Pending Upload
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Explicit reason why approval is disabled if applicable */}
                  {!canApprove && (
                    <div style={{
                      margin: '0.75rem 0',
                      padding: '0.65rem 0.85rem',
                      background: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '0.78rem',
                      color: '#92400E'
                    }}>
                      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ display: 'block', marginBottom: '2px' }}>Approval Disabled:</strong>
                        <span>{approvalBlockReason}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleReviewSubmit('APPROVED')}
                      disabled={!canApprove || isSubmittingReview}
                      className="btn btn-primary btn-sm"
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                        opacity: !canApprove ? 0.5 : 1,
                        cursor: !canApprove ? 'not-allowed' : 'pointer'
                      }}
                      title={!canApprove ? approvalBlockReason : 'Approve seller application'}
                    >
                      {isSubmittingReview ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewAction('REJECTED')}
                      disabled={isSubmittingReview}
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, justifyContent: 'center', borderColor: '#E74C3C', color: '#E74C3C' }}
                    >
                      Reject
                    </button>
                  </div>

                  {reviewAction === 'REJECTED' && (
                    <div style={{ marginTop: '0.75rem', background: '#FDEDEC', padding: '0.75rem', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#922B21', marginBottom: '4px' }}>
                        Mandatory Reason *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. FSSAI registration document unreadable..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        required
                        style={{ fontSize: '0.82rem' }}
                      />
                      <button onClick={() => handleReviewSubmit('REJECTED')} disabled={isSubmittingReview} className="btn btn-primary btn-sm" style={{ marginTop: '6px', width: '100%', background: '#C0392B', borderColor: '#C0392B', justifyContent: 'center' }}>
                        Submit Rejection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Operational Feeds */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Recent Orders Feed */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={18} />
              <span>Recent Orders Feed</span>
            </h3>

            {recentOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No orders placed yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentOrders.map((ord) => (
                  <div key={ord.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>#{ord.order_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ord.business_name} &bull; {ord.recipient_name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--maroon-primary)' }}>₹{Number(ord.total_amount).toFixed(2)}</div>
                      <span className={`badge ${ord.order_status === 'DELIVERED' ? 'badge-success' : ord.order_status === 'CANCELLED' ? 'badge-maroon' : 'badge-gold'}`} style={{ fontSize: '0.7rem' }}>
                        {ord.order_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Support Ticket Queue */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} />
                <span>Customer Support Queue</span>
              </h3>
              <Link to="/support" className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                View All
              </Link>
            </div>

            {recentTickets.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No open support tickets.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentTickets.map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.subject}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.category} &bull; {t.priority}</div>
                    </div>
                    <div>
                      <span className={`badge ${t.status === 'RESOLVED' ? 'badge-success' : t.status === 'IN_PROGRESS' ? 'badge-gold' : 'badge-maroon'}`} style={{ fontSize: '0.7rem' }}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security Boundary Statement */}
        <div style={{
          background: '#F8F9FA',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)'
        }}>
          <Shield size={20} color="var(--maroon-primary)" style={{ flexShrink: 0 }} />
          <div>
            <strong>Platform Administrator RBAC Scope:</strong> You are authenticated under the operations tier. Administrative account creation, global commission rules, and executive financial settlements are strictly reserved for Super Admin authorization.
          </div>
        </div>
      </div>

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
