import React from 'react';

export default function LoadingSpinner({ text = 'Preparing sweet delights...', fullScreen = false }) {
  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '3rem 1.5rem',
      gap: '1.2rem',
      color: 'var(--maroon-primary)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: '3.5px solid var(--maroon-subtle)',
        borderTopColor: 'var(--maroon-primary)',
        animation: 'spin 0.9s linear infinite'
      }} />
      {text && (
        <p style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: 'var(--text-secondary)'
        }}>
          {text}
        </p>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(253, 251, 247, 0.9)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {content}
      </div>
    );
  }

  return content;
}
