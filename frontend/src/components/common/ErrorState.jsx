import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1.5rem',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'var(--danger-bg)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1rem',
        color: 'var(--danger)'
      }}>
        <AlertCircle size={32} />
      </div>
      <h3 style={{ marginBottom: '0.5rem', color: 'var(--maroon-primary)' }}>{title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        {message || 'Unable to retrieve information from the sweets server. Please check your network connection.'}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline btn-sm">
          <RefreshCw size={16} />
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
}
