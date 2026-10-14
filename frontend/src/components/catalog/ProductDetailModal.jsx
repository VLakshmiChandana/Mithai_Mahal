import React, { useState } from 'react';
import Modal from '../common/Modal';
import { Plus, Minus, ShoppingBag, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getMediaUrl, FALLBACK_SWEET_IMAGE } from '../../utils/imageUrl';

export default function ProductDetailModal({ product, onClose }) {
  const { addToCart, isLoading } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const isAvailable = product.availability_status === 'AVAILABLE' && product.stock_quantity > 0;
  const imageSrc = getMediaUrl(product.image_url);
  const priceFormatted = Number(product.price).toFixed(2);

  const handleAdd = () => {
    if (!isAvailable) return;
    addToCart(product.id, quantity);
    onClose();
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} title={product.name} maxWidth="600px">
      <div>
        <div style={{
          position: 'relative',
          height: '240px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: '1.25rem'
        }}>
          <img
            src={imageSrc}
            alt={product.name}
            onError={(e) => { e.target.src = FALLBACK_SWEET_IMAGE; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--veg-green)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={16} />
            <span>100% PURE VEGETARIAN</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₹{priceFormatted}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
              inclusive of GST
            </span>
          </div>

          <div>
            {isAvailable ? (
              <span className="badge badge-success">
                IN STOCK ({product.stock_quantity} left)
              </span>
            ) : (
              <span className="badge badge-warning">
                TEMPORARILY OUT OF STOCK
              </span>
            )}
          </div>
        </div>

        {product.seller_business_name && (
          <p style={{ fontSize: '0.88rem', color: 'var(--maroon-primary)', fontWeight: 600, marginBottom: '0.75rem' }}>
            Prepared fresh by: {product.seller_business_name}
          </p>
        )}

        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {product.description || 'Authentic traditional recipe made with premium natural ingredients and pure cow ghee.'}
        </p>

        {/* Quality Guarantees */}
        <div style={{
          background: 'var(--bg-cream)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--saffron-primary)" />
            <span>Pure Cow Desi Ghee</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="var(--veg-green)" />
            <span>Hygienic Sealed Box</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAvailable ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-cream-alt)',
                borderRadius: 'var(--radius-pill)',
                padding: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ padding: '8px 14px', color: 'var(--maroon-primary)' }}
                >
                  <Minus size={18} />
                </button>
                <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: 700, fontSize: '1.05rem' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  style={{ padding: '8px 14px', color: 'var(--maroon-primary)' }}
                >
                  <Plus size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={isLoading}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.85rem' }}
              >
                <ShoppingBag size={18} />
                <span>Add {quantity} to Cart (₹{(product.price * quantity).toFixed(2)})</span>
              </button>
            </>
          ) : (
            <button disabled className="btn btn-primary" style={{ width: '100%', opacity: 0.6 }}>
              Item Currently Unavailable
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
