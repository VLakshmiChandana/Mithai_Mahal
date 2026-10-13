import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, MapPin, CheckCircle, ArrowRight, Store, AlertCircle, Plus } from 'lucide-react';
import { useCart } from '../context/CartContext';
import * as addressApi from '../api/address.api';
import * as cartApi from '../api/cart.api';
import * as orderApi from '../api/order.api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function CheckoutPage() {
  const { cart, refreshCart } = useCart();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  useEffect(() => {
    async function initCheckout() {
      setIsLoading(true);
      try {
        const addrRes = await addressApi.listAddresses();
        if (addrRes.success) {
          setAddresses(addrRes.data);
          const defaultAddr = addrRes.data.find((a) => a.is_default) || addrRes.data[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          }
        }
      } catch (err) {
        showToast('Could not load delivery addresses.', 'error');
      } finally {
        setIsLoading(false);
      }
    }

    initCheckout();
  }, [showToast]);

  // Revalidate checkout whenever selected address changes
  useEffect(() => {
    async function runCheckoutValidation() {
      if (!cart?.items?.length) return;
      try {
        const valRes = await cartApi.validateCheckout(selectedAddressId);
        if (valRes.success) {
          setValidationResult(valRes.data);
          setCheckoutError(null);
        }
      } catch (err) {
        setCheckoutError(err.response?.data?.message || 'Checkout validation failed.');
      }
    }

    runCheckoutValidation();
  }, [selectedAddressId, cart]);

  if (isLoading) {
    return <LoadingSpinner text="Preparing secure checkout..." />;
  }

  const items = cart?.items || [];
  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const shopName = validationResult?.shop?.businessName || cart?.shop?.business_name || cart?.sellerName || 'your chosen sweet vendor';

  // Compute calculated values as fallback if validationResult is pending
  const fallbackSubtotal = items.reduce((acc, item) => {
    const rawPrice = item.unit_price ?? item.price;
    const p = Number(rawPrice);
    const q = Number(item.quantity) || 1;
    return isNaN(p) ? acc : acc + (p * q);
  }, 0);
  const serverSubtotal = cart?.subtotal ? Number(cart.subtotal) : fallbackSubtotal;
  const fallbackPackaging = 15.00;
  const fallbackDelivery = serverSubtotal > 500 ? 0.00 : 40.00;
  const fallbackGst = Number((serverSubtotal * 0.05).toFixed(2));
  const fallbackGrandTotal = Number((serverSubtotal + fallbackPackaging + fallbackDelivery + fallbackGst).toFixed(2));

  const billing = validationResult?.billing ? {
    subtotal: Number(validationResult.billing.subtotal).toFixed(2),
    packagingCharge: Number(validationResult.billing.packagingCharge).toFixed(2),
    deliveryFee: Number(validationResult.billing.deliveryFee).toFixed(2),
    gstAmount: Number(validationResult.billing.gst).toFixed(2),
    grandTotal: Number(validationResult.billing.grandTotal).toFixed(2)
  } : {
    subtotal: serverSubtotal.toFixed(2),
    packagingCharge: fallbackPackaging.toFixed(2),
    deliveryFee: fallbackDelivery.toFixed(2),
    gstAmount: fallbackGst.toFixed(2),
    grandTotal: fallbackGrandTotal.toFixed(2)
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      showToast('Please select or add a delivery address to place your order.', 'error');
      return;
    }

    if (isPlacingOrder) return;
    setIsPlacingOrder(true);
    setCheckoutError(null);

    try {
      const orderRes = await orderApi.placeOrder(selectedAddressId);
      if (orderRes.success && orderRes.data?.id) {
        showToast(`Order ${orderRes.data.order_number || ''} placed successfully!`, 'success');
        await refreshCart();
        navigate(`/orders/${orderRes.data.id}/pay`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Order placement failed. Please verify stock availability.';
      setCheckoutError(msg);
      showToast(msg, 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: '1040px' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>Review & Place Sweet Order</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2.5rem' }}>
          Verify your delivery address, kitchen items, and server-calculated totals.
        </p>

        {checkoutError && (
          <div style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid #F5B7B1',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={20} />
            <span>{checkoutError}</span>
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem'
        }} className="checkout-grid">
          {/* Left Column: Address Selection & Item Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. Delivery Address Section */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={20} color="var(--maroon-primary)" />
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)' }}>1. Delivery Address</h3>
                </div>
                <Link to="/addresses" style={{ fontSize: '0.82rem', color: 'var(--maroon-primary)', fontWeight: 600 }}>
                  Manage Addresses
                </Link>
              </div>

              {addresses.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--bg-cream)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    You have not saved any delivery address yet.
                  </p>
                  <Link to="/addresses" className="btn btn-primary btn-sm">
                    <Plus size={16} />
                    <span>Add Delivery Address</span>
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <label
                        key={addr.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.85rem',
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `1.5px solid ${isSelected ? 'var(--maroon-primary)' : 'var(--border-subtle)'}`,
                          background: isSelected ? 'var(--maroon-subtle)' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <input
                          type="radio"
                          name="checkoutAddress"
                          checked={isSelected}
                          onChange={() => setSelectedAddressId(addr.id)}
                          style={{ marginTop: '3px', width: 'auto' }}
                        />
                        <div style={{ flex: 1, fontSize: '0.88rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{addr.address_type || 'HOME'}</strong>
                            {addr.recipient_name && <span>({addr.recipient_name})</span>}
                          </div>
                          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {addr.address_line1}, {addr.city}, {addr.state} — {addr.pincode}
                          </p>
                          {addr.recipient_phone && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                              Phone: {addr.recipient_phone}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Sweet Items Preview */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Store size={20} color="var(--maroon-primary)" />
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--maroon-primary)' }}>
                    2. Sweet Shop Items ({items.length})
                  </h3>
                </div>
                {shopName && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {shopName}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((item) => {
                  const itemId = item.item_id || item.id;
                  const itemName = item.product_name || item.name || 'Sweet Product';
                  const unitPrice = Number(item.unit_price ?? item.price);
                  const isPriceValid = !isNaN(unitPrice) && unitPrice > 0;
                  const itemTotal = isPriceValid ? (unitPrice * item.quantity).toFixed(2) : 'Error';

                  return (
                    <div
                      key={itemId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.9rem',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{itemName}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>x {item.quantity}</span>
                        {isPriceValid && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '6px' }}>
                            (₹{unitPrice.toFixed(2)} each)
                          </span>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, color: isPriceValid ? 'var(--text-primary)' : 'var(--danger)' }}>
                        {isPriceValid ? `₹${itemTotal}` : 'Price Error'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Billing Breakdown & Place Order CTA */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            height: 'fit-content',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              Final Payable Bill
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Sweets Subtotal</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{Number(billing.subtotal || 0).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Packaging Charges</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{Number(billing.packagingCharge || 15).toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Delivery Fee</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {Number(billing.deliveryFee) === 0 ? 'FREE' : `₹${Number(billing.deliveryFee).toFixed(2)}`}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>GST (5%)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{Number(billing.gstAmount || 0).toFixed(2)}
                </span>
              </div>

              <div style={{
                borderTop: '1.5px dashed var(--border-subtle)',
                paddingTop: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--maroon-primary)'
              }}>
                <span>Total Payable</span>
                <span>
                  ₹{Number(billing.grandTotal || billing.total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isPlacingOrder || !selectedAddressId || !!checkoutError}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>{isPlacingOrder ? 'Confirming Order with Kitchen...' : 'Place Order Now'}</span>
              <ArrowRight size={18} />
            </button>

            <div style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4
            }}>
              <ShieldCheck size={16} color="var(--veg-green)" style={{ flexShrink: 0 }} />
              <span>Prices and stock validated atomically by server transaction.</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .checkout-grid {
            grid-template-columns: 1.6fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
