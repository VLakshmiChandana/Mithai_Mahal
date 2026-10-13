import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import * as sellerApi from '../../api/seller.api';

export default function DocumentPreviewModal({ sellerId, doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    async function fetchDoc() {
      if (!sellerId || !doc?.id) return;
      setIsLoading(true);
      setError(null);

      try {
        const blob = await sellerApi.downloadSellerDocumentBlob(sellerId, doc.id);
        if (!active) return;

        const isDocPdf = doc.mime_type === 'application/pdf' || (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'));
        const isDocImg = doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|svg)$/i.test(doc.file_name || '');
        const targetMime = doc.mime_type || (isDocPdf ? 'application/pdf' : isDocImg ? 'image/jpeg' : 'application/octet-stream');
        const typedBlob = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: targetMime });

        createdUrl = URL.createObjectURL(typedBlob);
        setBlobUrl(createdUrl);
      } catch (err) {
        if (!active) return;
        let msg = 'Failed to retrieve secure document.';
        if (err.response?.data instanceof Blob) {
          try {
            const rawText = await err.response.data.text();
            const parsed = JSON.parse(rawText);
            msg = parsed.error?.message || parsed.message || msg;
          } catch {
            msg = err.message || msg;
          }
        } else if (err.response?.data?.error?.message) {
          msg = err.response.data.error.message;
        } else if (err.response?.data?.message) {
          msg = err.response.data.message;
        } else if (err.message) {
          msg = err.message;
        }
        setError(msg);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchDoc();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [sellerId, doc?.id]);

  if (!doc) return null;

  const isPdf = doc.mime_type === 'application/pdf' || (doc.file_name && doc.file_name.toLowerCase().endsWith('.pdf'));
  const isImage = doc.mime_type?.startsWith('image/') || /\.(jpe?g|png|webp|svg)$/i.test(doc.file_name || '');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(12, 35, 64, 0.75)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.2rem 1.5rem',
          background: 'var(--bg-cream)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--maroon-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} />
              <span>{doc.document_type?.replace(/_/g, ' ') || 'KYC Document'}: {doc.file_name}</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Encrypted Private Storage &bull; Authenticated Stream &bull; {(doc.file_size / 1024).toFixed(1)} KB
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {blobUrl && (
              <>
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Open in new browser tab"
                >
                  <ExternalLink size={15} />
                  <span>Open Tab</span>
                </a>
                <a
                  href={blobUrl}
                  download={doc.file_name || 'document.pdf'}
                  className="btn btn-outline btn-sm"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Download copy"
                >
                  <Download size={15} />
                  <span>Download</span>
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="btn btn-outline btn-sm"
              style={{ padding: '0.4rem 0.6rem' }}
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F9FA',
          minHeight: '450px'
        }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--maroon-primary)' }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Streaming encrypted document...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', maxWidth: '400px', color: '#991B1B' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 0.75rem' }} />
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Failed to Load Document</h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={blobUrl}
              title={doc.file_name}
              style={{
                width: '100%',
                height: '650px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)'
              }}
            />
          ) : isImage ? (
            <img
              src={blobUrl}
              alt={doc.file_name}
              style={{
                maxWidth: '100%',
                maxHeight: '650px',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <FileText size={48} color="var(--maroon-primary)" style={{ margin: '0 auto 1rem' }} />
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Preview not available for this file type</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                You can download the file directly to view it on your device.
              </p>
              <a
                href={blobUrl}
                download={doc.file_name}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={16} />
                <span>Download {doc.file_name}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
