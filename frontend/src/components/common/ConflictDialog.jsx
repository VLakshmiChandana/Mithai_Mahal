import React from 'react';
import Modal from './Modal';
import { useCart } from '../../context/CartContext';
import { AlertTriangle, Trash2, ArrowRight } from 'lucide-react';

export default function ConflictDialog() {
  const { pendingConflict, resolveConflict } = useCart();

  if (!pendingConflict) return null;

  return (
    <Modal
      isOpen={!!pendingConflict}
      onClose={() => resolveConflict(false)}
      title="Single Sweet Shop Rule"
    >
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          <AlertTriangle size={30} />
        </div>

        <p style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.75rem' }}>
          Replace items currently in your cart?
        </p>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          To guarantee fresh dispatch and direct delivery, each sweet order must come from a single sweet shop. 
          Your cart currently holds sweets from another shop.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => resolveConflict(false)}
            className="btn btn-outline"
            style={{ flex: 1 }}
          >
            Keep Current Cart
          </button>
          <button
            onClick={() => resolveConflict(true)}
            className="btn btn-primary"
            style={{ flex: 1, background: 'var(--danger)' }}
          >
            <Trash2 size={16} />
            <span>Clear & Add New</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
