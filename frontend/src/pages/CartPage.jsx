import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Store, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { getMediaUrl, FALLBACK_SWEET_IMAGE } from '../utils/imageUrl';

export default function CartPage() {
  const { cart, isLoading, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  if (isLoading && !cart) {
    return <LoadingSpinner text="Retrieving sweet cart..." />;
  }

  const items = cart?.items || [];
  const shopName = cart?.shop?.business_name || cart?.sellerName || 'your chosen vendor';

  // Server-authoritative subtotal and tax calculation
  const calculatedSubtotal = items.reduce((acc, item) => {
    const rawPrice = item.unit_price ?? item.price;
    const priceNum = Number(rawPrice);
    const qty = Number(item.quantity) || 1;
    return isNaN(priceNum) ? acc : acc + (priceNum * qty);
  }, 0);

  const serverSubtotal = cart?.subtotal ? Number(cart.subtotal) : calculatedSubtotal;
  const packagingCharge = 15.00;
  const deliveryFee = serverSubtotal > 500 ? 0.00 : 40.00;
  const gstAmount = Number((serverSubtotal * 0.05).toFixed(2));
  const grandTotal = Number((serverSubtotal + packagingCharge + deliveryFee + gstAmount).toFixed(2));

  // Check if any cart item has an invalid/missing price
  const hasInvalidPriceItem = items.some((item) => {
    const p = Number(item.unit_price ?? item.price);
    return isNaN(p) || p <= 0;
  });

  if (items.length === 0) {
    return (
      <div style={{ padding: '5rem 1.25rem', textAlign: 'center', minHeight: '60vh' }}>
        <div className="container" style={{ maxWidth: '480px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--maroon-subtle)',
            color: 'var(--maroon-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            <ShoppingBag size={40} />
          </div>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--maroon-primary)', marginBottom: '0.6rem' }}>
            Your Sweet Cart is Empty
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
            Explore our curated sweet shops to add fresh Motichoor Laddus, Kaju Katlis, and authentic Indian mithai!
          </p>
          <Link to="/shops" className="btn btn-primary btn-lg">
            <span>Browse Sweet Shops</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container">
        {hasInvalidPriceItem && (
          <div style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid #F5B7B1',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.92rem'
          }}>
            <AlertCircle size={20} />
            <span>Pricing discrepancy detected on one or more items. Please refresh your cart or contact support.</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.3rem' }}>Your Shopping Cart</h1>
            {shopName && (
              <p style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.92rem',
                color: 'var(--maroon-primary)',
                fontWeight: 600
              }}>
                <Store size={16} />
                <span>Ordering from: {shopName}</span>
              </p>
            )}
          </div>

          <button
            onClick={clearCart}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--danger)',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <Trash2 size={16} />
            <span>Clear Cart</span>
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem'
        }} className="cart-grid">
          {/* Cart Line Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((item) => {
              const itemId = item.item_id || item.id;
              const itemName = item.product_name || item.name || 'Sweet Product';
              const rawPrice = item.unit_price ?? item.price;
              const unitPriceNum = Number(rawPrice);
              const isPriceValid = !isNaN(unitPriceNum) && unitPriceNum > 0;
              const itemTotal = isPriceValid ? (unitPriceNum * item.quantity).toFixed(2) : 'Error';

              return (
                <div
                  key={itemId}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <img
                    src={getMediaUrl(item.image_url)}
                    alt={itemName}
                    onError={(e) => { e.target.src = FALLBACK_SWEET_IMAGE; }}
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover'
                    }}
                  />

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <h4 style={{ fontSize: '1.05rem', color: 'var(--maroon-primary)', marginBottom: '0.2rem' }}>
                      {itemName}
                    </h4>
                    {isPriceValid ? (
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        ₹{unitPriceNum.toFixed(2)} each
                      </p>
                    ) : (
                      <p style={{ fontSize: '0.84rem', color: 'var(--danger)', fontWeight: 600 }}>
                        Price unavailable — please remove or re-add
                      </p>
                    )}
                  </div>

                  {/* Quantity Selector */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-cream)',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <button
                      onClick={() => updateQuantity(itemId, item.quantity - 1)}
                      style={{ padding: '6px 10px', color: 'var(--maroon-primary)' }}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={15} />
                    </button>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: '24px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(itemId, item.quantity + 1)}
                      style={{ padding: '6px 10px', color: 'var(--maroon-primary)' }}
                      aria-label="Increase quantity"
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  {/* Line Item Total */}
                  <div style={{ minWidth: '90px', textAlign: 'right' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: isPriceValid ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {isPriceValid ? `₹${itemTotal}` : 'Price Error'}
                    </span>
                  </div>

                  {/* Delete Item */}
                  <button
                    onClick={() => removeFromCart(itemId)}
                    style={{ color: 'var(--text-muted)', padding: '6px' }}
                    aria-label="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}

            {/* Single Shop Rule Banner */}
            <div style={{
              background: 'var(--bg-cream-warm)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.9rem 1.25rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <ShieldCheck size={20} color="var(--saffron-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Single Sweet Shop Guarantee:</strong> All items in this order are fulfilled directly by{' '}
                <strong>{shopName}</strong> to ensure fresh kitchen dispatch and authentic taste.
              </div>
            </div>
          </div>

          {/* Billing Breakdown Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            height: 'fit-content',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              Order Bill Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Item Subtotal ({items.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} items)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{serverSubtotal.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Hygienic Sweet Packaging</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{packagingCharge.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Delivery Fee {serverSubtotal > 500 ? '(Free above ₹500)' : ''}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>GST (5% Confectionery)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{gstAmount.toFixed(2)}
                </span>
              </div>

              <div style={{
                borderTop: '1.5px dashed var(--border-subtle)',
                paddingTop: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--maroon-primary)'
              }}>
                <span>Grand Total</span>
                <span>
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              disabled={hasInvalidPriceItem}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .cart-grid {
            grid-template-columns: 1.6fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
