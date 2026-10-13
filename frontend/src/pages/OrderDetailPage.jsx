import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Store, MapPin, Truck, AlertCircle, HelpCircle, XCircle, CreditCard } from 'lucide-react';
import * as orderApi from '../api/order.api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState(null);

  const { showToast } = useToast();

  const loadOrder = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await orderApi.getMyOrder(orderId);
      if (res.success) {
        setOrder(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setIsCancelling(true);
    try {
      await orderApi.cancelMyOrder(orderId, 'Cancelled by customer before kitchen preparation');
      showToast('Order cancelled successfully. Stock restored.', 'info');
      await loadOrder();
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot cancel order once kitchen preparation has begun.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Loading order receipt..." />;
  }

  if (error || !order) {
    return <ErrorState message={error} onRetry={loadOrder} />;
  }

  const items = order.items || [];
  const canCancel = order.order_status === 'PLACED';

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link to="/orders" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--maroon-primary)',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}>
          <ArrowLeft size={16} />
          <span>Back to All Orders</span>
        </Link>

        {/* Top Header Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Order Number</span>
              <h1 style={{ fontSize: '1.8rem', color: 'var(--maroon-primary)' }}>{order.order_number}</h1>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {order.payment_status === 'PENDING' && order.order_status !== 'CANCELLED' && (
                <Link
                  to={`/orders/${order.id}/pay`}
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--maroon-primary)' }}
                >
                  <CreditCard size={16} />
                  <span>Pay Now</span>
                </Link>
              )}
              {order.order_status !== 'CANCELLED' && (
                <Link to={`/orders/${order.id}/track`} className="btn btn-primary btn-sm">
                  <Truck size={16} />
                  <span>Live Tracking</span>
                </Link>
              )}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                >
                  <XCircle size={16} />
                  <span>Cancel Order</span>
                </button>
              )}
              <Link to={`/support?orderId=${order.id}`} className="btn btn-outline btn-sm">
                <HelpCircle size={16} />
                <span>Get Help</span>
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>{' '}
              <strong style={{ color: 'var(--maroon-primary)' }}>{order.order_status}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Payment:</span>{' '}
              <strong style={{ color: order.payment_status === 'PAID' ? 'var(--veg-green)' : 'var(--warning)' }}>
                {order.payment_status}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Placed At:</span>{' '}
              <strong>{new Date(order.created_at).toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* Items Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--maroon-primary)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            Items Ordered ({items.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.92rem' }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{it.product_name || it.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                    x {it.quantity} (₹{Number(it.unit_price || it.price).toFixed(2)} each)
                  </span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{(Number(it.unit_price || it.price) * it.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Billing Breakdown Snapshot */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1.5px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.88rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span>
              <span>₹{Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Packaging Charges</span>
              <span>₹{Number(order.packaging_charge || 15).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Delivery Fee</span>
              <span>₹{Number(order.delivery_fee || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>GST (5%)</span>
              <span>₹{Number(order.gst_amount || 0).toFixed(2)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--maroon-primary)',
              marginTop: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <span>Total Paid</span>
              <span>₹{Number(order.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Address Card */}
        {order.delivery_address && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={18} />
              <span>Delivered To</span>
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              {order.delivery_address.recipient_name} ({order.delivery_address.recipient_phone})
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '2px' }}>
              {order.delivery_address.address_line1}, {order.delivery_address.city}, {order.delivery_address.state} — {order.delivery_address.pincode}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
