import React, { useState } from 'react';
import { Plus, Minus, ShoppingBag, Eye } from 'lucide-react';
import { useCart } from '../../context/CartContext';

const FALLBACK_SWEET_IMAGE = '/sweets/motichoor-laddu.svg';

export default function ProductCard({ product, onViewDetails }) {
  const { addToCart, isLoading } = useCart();
  const [quantity, setQuantity] = useState(1);

  const isAvailable = product.availability_status === 'AVAILABLE' && product.stock_quantity > 0;
  const imageSrc = product.image_url || FALLBACK_SWEET_IMAGE;
  const priceFormatted = Number(product.price).toFixed(2);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!isAvailable) return;
    addToCart(product.id, quantity);
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative'
      }}
      onClick={() => onViewDetails && onViewDetails(product)}
    >
      {/* Product Image */}
      <div style={{ position: 'relative', height: '170px', overflow: 'hidden' }}>
        <img
          src={imageSrc}
          alt={product.name}
          onError={(e) => { e.target.src = FALLBACK_SWEET_IMAGE; }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease',
            filter: !isAvailable ? 'grayscale(70%) opacity(0.8)' : 'none'
          }}
          onMouseEnter={(e) => { if (isAvailable) e.target.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
        />

        {/* Veg Badge Icon */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }} title="100% Vegetarian Sweets">
          <div style={{
            width: '14px',
            height: '14px',
            border: '2px solid var(--veg-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--veg-green)'
            }} />
          </div>
        </div>

        {/* Stock / Availability Status */}
        {!isAvailable ? (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(192, 57, 43, 0.95)',
            color: '#FFFFFF',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            letterSpacing: '0.5px'
          }}>
            OUT OF STOCK
          </div>
        ) : product.stock_quantity <= 5 ? (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(230, 126, 34, 0.95)',
            color: '#FFFFFF',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)'
          }}>
            ONLY {product.stock_quantity} LEFT
          </div>
        ) : null}
      </div>

      {/* Body Information */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {product.category_name && (
          <span style={{
            fontSize: '0.76rem',
            color: 'var(--saffron-primary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            marginBottom: '0.2rem'
          }}>
            {product.category_name}
          </span>
        )}

        <h4 style={{
          fontSize: '1.05rem',
          color: 'var(--maroon-primary)',
          marginBottom: '0.4rem',
          lineHeight: 1.3
        }}>
          {product.name}
        </h4>

        {product.description && (
          <p style={{
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.8rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4
          }}>
            {product.description}
          </p>
        )}

        {/* Price and Cart Action */}
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          <div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ₹{priceFormatted}
            </span>
          </div>

          {isAvailable ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
              {/* Simple Quantity Adjuster */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-cream)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-subtle)',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  style={{ padding: '4px 8px', color: 'var(--maroon-primary)' }}
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                  style={{ padding: '4px 8px', color: 'var(--maroon-primary)' }}
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={isLoading}
                className="btn btn-primary btn-sm"
                style={{ padding: '0.45rem 0.85rem' }}
                title="Add to cart"
              >
                <ShoppingBag size={15} />
                <span>Add</span>
              </button>
            </div>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
