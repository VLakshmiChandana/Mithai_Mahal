import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as sellerApi from '../api/seller.api';
import { ShieldCheck, UserCheck, CheckCircle2, XCircle, FileText, Search, UserPlus, Eye, AlertCircle } from 'lucide-react';
import DocumentPreviewModal from '../components/admin/DocumentPreviewModal';

export default function AdminSellersPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerDocs, setSellerDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Review modal
  const [reviewAction, setReviewAction] = useState(null); // 'APPROVE' | 'REJECT'
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Create Staff Modal (Super Admin only)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '', mobileNumber: '' });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const loadSellers = async () => {
    setIsLoading(true);
    try {
      const res = await sellerApi.listSellersForAdmin();
      setSellers(res.data || []);
    } catch (err) {
      showToast('Failed to load seller applications.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, []);

  const handleSelectSeller = async (seller) => {
    setSelectedSeller(seller);
    setIsLoadingDocs(true);
    try {
      const res = await sellerApi.getSellerDocumentsForAdmin(seller.id);
      setSellerDocs(res.data || []);
    } catch {
      setSellerDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleReviewSubmit = async (status) => {
    if (!selectedSeller) return;
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      showToast('Rejection reason is mandatory when rejecting a seller.', 'error');
      return;
    }

    setIsSubmittingReview(true);
    try {
      await sellerApi.reviewSellerVerification(selectedSeller.id, {
        status,
        rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : undefined,
        reviewNotes: reviewNotes.trim() || undefined
      });

      showToast(`Seller successfully marked as ${status}!`, 'success');
      setReviewAction(null);
      setRejectionReason('');
      setReviewNotes('');
      await loadSellers();
      // Re-fetch selected seller
      const updatedSellers = await sellerApi.listSellersForAdmin();
      const updated = (updatedSellers.data || []).find(s => s.id === selectedSeller.id);
      if (updated) setSelectedSeller(updated);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Review submission failed.';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const hasMissingDocs = !sellerDocs.length || sellerDocs.some(d => d.is_placeholder || !d.has_file || d.file_path === 'PENDING_UPLOAD');
  const hasRejectedDocs = sellerDocs.some(d => d.verification_status === 'REJECTED');
  const canApprove = !hasMissingDocs && !hasRejectedDocs && sellerDocs.length > 0;

  let approvalBlockReason = '';
  if (sellerDocs.length === 0) {
    approvalBlockReason = 'No compliance documents submitted yet.';
  } else if (hasRejectedDocs) {
    approvalBlockReason = 'One or more attached documents have been rejected.';
  } else if (hasMissingDocs) {
    approvalBlockReason = 'Mandatory compliance documents are pending upload or missing files.';
  }

  const handleCreateAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password) {
      showToast('Name, Email, and Password are required.', 'error');
      return;
    }

    setIsCreatingAdmin(true);
    try {
      await sellerApi.createStaffAdmin(adminForm);
      showToast('Admin staff account created successfully!', 'success');
      setShowCreateAdmin(false);
      setAdminForm({ name: '', email: '', password: '', mobileNumber: '' });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create Admin.';
      showToast(msg, 'error');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const isSuperAdmin = user?.userType === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '2rem 1rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-primary)', fontSize: '1.75rem', margin: 0 }}>
            Platform Seller Verification & Administration
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Review vendor onboarding applications, inspect FSSAI credentials, and activate sweet shops.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setShowCreateAdmin(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}
          >
            <UserPlus size={16} />
            <span>Create Admin Staff</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Column: Sellers List */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '1.25rem'
        }}>
          <h2 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', margin: '0 0 1rem 0' }}>
            Sweet Shops ({sellers.length})
          </h2>

          {isLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading sellers...</p>
          ) : sellers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No seller records found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '600px', overflowY: 'auto' }}>
              {sellers.map(s => {
                const isSelected = selectedSeller?.id === s.id;
                const statusColor = s.verification_status === 'APPROVED' ? '#166534' : s.verification_status === 'REJECTED' ? '#991B1B' : '#92400E';
                const statusBg = s.verification_status === 'APPROVED' ? '#DCFCE7' : s.verification_status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7';

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSeller(s)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--maroon-subtle)' : 'var(--bg-cream)',
                      border: `1px solid ${isSelected ? 'var(--maroon-primary)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {s.business_name}
                      </strong>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-pill)',
                        background: statusBg,
                        color: statusColor
                      }}>
                        {s.verification_status}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {s.owner_name ? `Owner: ${s.owner_name} • ` : ''}{s.email}
                    </p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      City: {s.city || 'N/A'} • Status: {s.account_status}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Seller Details & Documents Review */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem'
        }}>
          {!selectedSeller ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={48} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p>Select a sweet shop from the list to review documents, verification status, and approve or reject.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', color: 'var(--maroon-primary)', margin: 0 }}>
                    {selectedSeller.business_name}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
                    Legal Name: <strong>{selectedSeller.legal_name || selectedSeller.business_name}</strong> • Type: {selectedSeller.business_type}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setReviewAction('APPROVE')}
                    disabled={!canApprove}
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.85rem',
                      padding: '0.45rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      opacity: !canApprove ? 0.5 : 1,
                      cursor: !canApprove ? 'not-allowed' : 'pointer'
                    }}
                    title={!canApprove ? approvalBlockReason : 'Approve Sweet Shop'}
                  >
                    <CheckCircle2 size={16} />
                    <span>Approve Shop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('REJECT')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626' }}
                  >
                    <XCircle size={16} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {!canApprove && (
                <div style={{
                  marginBottom: '1.25rem',
                  padding: '0.75rem 1rem',
                  background: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.84rem',
                  color: '#92400E'
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px' }}>Approval Disabled:</strong>
                    <span>{approvalBlockReason}</span>
                  </div>
                </div>
              )}

              {/* Profile Details Grid */}
              <div style={{
                background: 'var(--bg-cream)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                border: '1px solid var(--border-subtle)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Email & Phone:</span>
                  <strong>{selectedSeller.email} / {selectedSeller.phone}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>GSTIN:</span>
                  <strong>{selectedSeller.gstin || 'Not Provided'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Address:</span>
                  <strong>{selectedSeller.shop_address || selectedSeller.city || 'Not Provided'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Verification Status:</span>
                  <strong style={{
                    color: selectedSeller.verification_status === 'APPROVED' ? '#16A34A' : selectedSeller.verification_status === 'REJECTED' ? '#DC2626' : '#D97706'
                  }}>
                    {selectedSeller.verification_status} ({selectedSeller.account_status})
                  </strong>
                </div>
              </div>

              {selectedSeller.rejection_reason && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.88rem',
                  color: '#991B1B'
                }}>
                  <strong>Current Rejection Reason:</strong> {selectedSeller.rejection_reason}
                </div>
              )}

              {/* Verification Documents List */}
              <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <FileText size={18} />
                <span>Submitted Documents ({sellerDocs.length})</span>
              </h3>

              {isLoadingDocs ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Loading documents...</p>
              ) : sellerDocs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', fontStyle: 'italic' }}>
                  No documents have been uploaded by this seller yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {sellerDocs.map(doc => {
                    const isPlaceholder = doc.is_placeholder || !doc.has_file || doc.file_path === 'PENDING_UPLOAD' || doc.file_size === 0;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => {
                          if (!isPlaceholder) setPreviewDoc(doc);
                        }}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: '#FFFFFF',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          cursor: !isPlaceholder ? 'pointer' : 'default',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isPlaceholder) e.currentTarget.style.background = '#F8FAFC'; }}
                        onMouseLeave={(e) => { if (!isPlaceholder) e.currentTarget.style.background = '#FFFFFF'; }}
                        title={!isPlaceholder ? 'Click to inspect document' : 'Document awaiting upload'}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong>{doc.document_type.replace(/_/g, ' ')}</strong>
                            {isPlaceholder ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                                FILE MISSING / PLACEHOLDER
                              </span>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                                AVAILABLE
                              </span>
                            )}
                          </div>
                          {doc.document_number && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>#{doc.document_number}</span>}
                          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            File: {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB • Type: {doc.mime_type}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {!isPlaceholder ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewDoc(doc);
                              }}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Pending Upload
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-pill)',
                            background: doc.verification_status === 'APPROVED' ? '#DCFCE7' : doc.verification_status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                            color: doc.verification_status === 'APPROVED' ? '#166534' : doc.verification_status === 'REJECTED' ? '#991B1B' : '#92400E'
                          }}>
                            {doc.verification_status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* APPROVAL / REJECTION CONFIRMATION MODAL */}
      {reviewAction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              color: reviewAction === 'APPROVE' ? '#15803D' : '#B91C1C',
              marginBottom: '0.5rem'
            }}>
              {reviewAction === 'APPROVE' ? 'Approve Sweet Shop' : 'Reject Seller Verification'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {reviewAction === 'APPROVE'
                ? `Approving "${selectedSeller?.business_name}" will mark their account as ACTIVE. The seller can now publish sweet products and accept customer orders.`
                : `Please provide a clear reason why "${selectedSeller?.business_name}" is rejected. The seller will see this note and be allowed to resubmit.`}
            </p>

            {reviewAction === 'REJECT' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. FSSAI registration certificate expired. Please upload valid current license."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Internal Review Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="Verified against food safety portal"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setReviewAction(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview || (reviewAction === 'APPROVE' && !canApprove)}
                onClick={() => handleReviewSubmit(reviewAction === 'APPROVE' ? 'APPROVED' : 'REJECTED')}
                className="btn btn-primary"
                style={{
                  background: reviewAction === 'APPROVE' ? '#16A34A' : '#DC2626',
                  borderColor: reviewAction === 'APPROVE' ? '#16A34A' : '#DC2626',
                  opacity: (reviewAction === 'APPROVE' && !canApprove) ? 0.5 : 1,
                  cursor: (reviewAction === 'APPROVE' && !canApprove) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmittingReview ? 'Processing...' : reviewAction === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ADMIN MODAL (SUPER ADMIN ONLY) */}
      {showCreateAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem' }}>
              Create Admin Account
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              As Super Admin, you can provision Admin staff. Admins can review sellers but cannot create Super Admins.
            </p>

            <form onSubmit={handleCreateAdminSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Admin"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="admin@mithaimahal.com"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Password *
                </label>
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={adminForm.mobileNumber}
                  onChange={(e) => setAdminForm({ ...adminForm, mobileNumber: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateAdmin(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAdmin}
                  className="btn btn-primary"
                >
                  {isCreatingAdmin ? 'Creating...' : 'Create Admin Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
