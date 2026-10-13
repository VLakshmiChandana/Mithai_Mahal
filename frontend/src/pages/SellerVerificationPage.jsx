import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as sellerApi from '../api/seller.api';
import { ShieldCheck, AlertCircle, Upload, CheckCircle2, RefreshCw, FileText, Clock, XCircle, ArrowRight, LayoutDashboard } from 'lucide-react';

export default function SellerVerificationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload Form
  const [documentType, setDocumentType] = useState('FSSAI_REGISTRATION');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, docsRes] = await Promise.all([
        sellerApi.getSellerProfile(),
        sellerApi.getSellerDocuments()
      ]);
      setProfile(profileRes.data);
      setDocuments(docsRes.data);
    } catch (err) {
      showToast('Failed to load seller verification records.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a document file to upload.', 'error');
      return;
    }

    const form = e.target;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('documentType', documentType);
      if (documentNumber.trim()) formData.append('documentNumber', documentNumber.trim());
      if (expiryDate) formData.append('expiryDate', expiryDate);
      formData.append('file', selectedFile);

      await sellerApi.uploadSellerDocument(formData);
      showToast('Document uploaded successfully!', 'success');
      setSelectedFile(null);
      setDocumentNumber('');
      setExpiryDate('');
      if (form && typeof form.reset === 'function') form.reset();
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      showToast(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      await sellerApi.resubmitSellerVerification(resubmitNotes.trim() || undefined);
      showToast('Application resubmitted for admin review!', 'success');
      setResubmitNotes('');
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Resubmission failed.';
      showToast(msg, 'error');
    } finally {
      setIsResubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading verification status...</p>
      </div>
    );
  }

  const status = profile?.verification_status || 'PENDING';
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isUnderReview = status === 'UNDER_REVIEW';

  return (
    <div className="container" style={{ maxWidth: '860px', padding: '2.5rem 1rem' }}>
      {/* Status Banner */}
      <div style={{
        background: isApproved ? '#F0FDF4' : isRejected ? '#FEF2F2' : '#FFFBEB',
        border: `1px solid ${isApproved ? '#86EFAC' : isRejected ? '#FCA5A5' : '#FDE68A'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem'
      }}>
        <div style={{
          color: isApproved ? '#16A34A' : isRejected ? '#DC2626' : '#D97706',
          marginTop: '2px'
        }}>
          {isApproved && <CheckCircle2 size={32} />}
          {isRejected && <XCircle size={32} />}
          {!isApproved && !isRejected && <Clock size={32} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: isApproved ? '#15803D' : isRejected ? '#B91C1C' : '#B45309',
              margin: 0
            }}>
              Seller Verification: {status.replace('_', ' ')}
            </h2>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-pill)',
              background: isApproved ? '#DCFCE7' : isRejected ? '#FEE2E2' : '#FEF3C7',
              color: isApproved ? '#166534' : isRejected ? '#991B1B' : '#92400E'
            }}>
              {profile?.account_status}
            </span>
          </div>

          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {isApproved && 'Your sweet shop is fully verified and active! Products can now be published and will appear on the customer storefront.'}
            {isUnderReview && 'Your documents are currently under review by our platform administration team. We will verify your FSSAI and business credentials.'}
            {status === 'PENDING' && 'Please upload your mandatory food safety (FSSAI) and business documents below to begin verification.'}
            {isRejected && 'Your verification was not approved. Please see the rejection reason below, correct your details, re-upload documents, and resubmit.'}
          </p>

          {isApproved && (
            <div style={{ marginTop: '0.85rem' }}>
              <Link
                to="/seller/dashboard"
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
              >
                <LayoutDashboard size={18} />
                <span>Go to Seller Dashboard (Manage Products)</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          )}

          {isRejected && profile?.rejection_reason && (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #FECACA',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginTop: '0.75rem'
            }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#B91C1C' }}>
                Reason for Rejection:
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem', color: '#7F1D1D' }}>
                {profile.rejection_reason}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Re-submission Form if Rejected */}
      {isRejected && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '0.75rem' }}>
            Resubmit Corrected Application
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Once you have updated your information or uploaded new documents below, click resubmit to move your application back into review.
          </p>
          <textarea
            placeholder="Add explanation or note for reviewer (e.g. Uploaded valid FSSAI certificate with updated address)..."
            value={resubmitNotes}
            onChange={(e) => setResubmitNotes(e.target.value)}
            rows={3}
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <button
            onClick={handleResubmit}
            disabled={isResubmitting}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} />
            <span>{isResubmitting ? 'Submitting...' : 'Resubmit for Review'}</span>
          </button>
        </div>
      )}

      {/* Document Upload Form */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-subtle)',
        padding: '1.75rem',
        marginBottom: '2rem'
      }}>
        <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={20} />
          <span>Upload Verification Document</span>
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Upload clear copies of your food license, business registration, or GST certificate. Allowed formats: PDF, JPEG, PNG, WEBP (Max 5MB).
        </p>

        <form onSubmit={handleUpload}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Document Type *
              </label>
              <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                <option value="FSSAI_REGISTRATION">FSSAI Registration / Certificate</option>
                <option value="GST_CERTIFICATE">GST Registration Certificate</option>
                <option value="BUSINESS_PAN">Business PAN Card</option>
                <option value="SHOP_ESTABLISHMENT">Shop & Establishment License</option>
                <option value="BANK_PROOF">Bank Cancelled Cheque / Statement</option>
                <option value="OTHER">Other Proof</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Registration / Certificate Number
              </label>
              <input
                type="text"
                placeholder="e.g. 10020000000000"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Certificate Expiry Date (if applicable)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Select Document File (PDF / Image) *
            </label>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setSelectedFile(e.target.files[0] || null)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Upload size={16} />
            <span>{isUploading ? 'Uploading Securely...' : 'Upload Document'}</span>
          </button>
        </form>
      </div>

      {/* Uploaded Documents List */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--border-subtle)',
        padding: '1.75rem'
      }}>
        <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={20} />
          <span>Uploaded Documents ({documents.length})</span>
        </h3>

        {documents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            No documents uploaded yet. Please upload your FSSAI certificate to enable shop activation.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-cream)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {doc.document_type.replace('_', ' ')}
                    </strong>
                    {doc.document_number && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ({doc.document_number})
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    File: {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB • Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                  {doc.rejection_reason && (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#DC2626' }}>
                      Rejection note: {doc.rejection_reason}
                    </p>
                  )}
                </div>

                <div>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-pill)',
                    background: doc.verification_status === 'APPROVED' ? '#DCFCE7' : doc.verification_status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                    color: doc.verification_status === 'APPROVED' ? '#166534' : doc.verification_status === 'REJECTED' ? '#991B1B' : '#92400E'
                  }}>
                    {doc.verification_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
