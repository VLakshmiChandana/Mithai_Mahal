import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', durationMs = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        maxWidth: '420px',
        width: 'calc(100% - 48px)'
      }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: toast.type === 'error' ? '#FDEDEC' : toast.type === 'success' ? '#E8F8F0' : '#FFFDF9',
              border: `1px solid ${toast.type === 'error' ? '#C0392B' : toast.type === 'success' ? '#1E824C' : '#D4AF37'}`,
              color: toast.type === 'error' ? '#C0392B' : toast.type === 'success' ? '#1E824C' : '#521212',
              padding: '12px 16px',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.92rem',
              fontWeight: 500,
              animation: 'slideUp 0.3s ease'
            }}
          >
            {toast.type === 'success' && <CheckCircle size={20} color="#1E824C" />}
            {toast.type === 'error' && <AlertCircle size={20} color="#C0392B" />}
            {toast.type === 'info' && <Info size={20} color="#D4AF37" />}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ padding: '2px', color: 'inherit', opacity: 0.7 }}
              aria-label="Close notification"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
