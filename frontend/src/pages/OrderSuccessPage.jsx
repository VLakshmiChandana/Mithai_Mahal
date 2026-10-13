import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, MapPin, Truck, Store } from 'lucide-react';
import * as orderApi from '../api/order.api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      try {
        const res = await orderApi.getMyOrder(orderId);
        if (res.success) setOrder(res.data);
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    }
    loadOrder();
  }, [orderId]);

  if (isLoading) {
    return <LoadingSpinner text="Loading order receipt..." />;
  }

  return (
    <div style={{ padding: '4rem 1.25rem 5rem' }}>
      <div className="container" style={{ maxWidth: '640px' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-subtle)',
          padding: '2.5rem 2rem',
          textAlign: 'center'
        }}>
          {/* Success Check Icon */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--veg-green-bg)',
            color: 'var(--veg-green)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem'
          }}>
            <CheckCircle size={44} />
          </div>

          <h1 style={{ fontSize: '2rem', color: 'var(--maroon-primary)', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>
            Sweet Order Placed!
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
            Your order has been confirmed and forwarded to the sweet shop kitchen for fresh packaging.
          </p>

          {/* Receipt Card */}
          <div style={{
            background: 'var(--bg-cream)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            textAlign: 'left',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Order Number
                </span>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--maroon-primary)' }}>
                  {order?.order_number || orderId.slice(0, 12)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Payment Status
                </span>
                <p style={{ fontWeight: 700, color: 'var(--veg-green)' }}>
                  {order?.payment_status || 'PAID'}
                </p>
              </div>
            </div>

            {order?.shop?.business_name && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.6rem' }}>
                <Store size={15} color="var(--maroon-primary)" />
                <span>Sweet Shop: <strong>{order.shop.business_name}</strong></span>
              </p>
            )}

            {order?.delivery_address && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '0.6rem' }}>
                <MapPin size={15} color="var(--maroon-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Deliver to: {order.delivery_address.recipient_name}, {order.delivery_address.address_line1}, {order.delivery_address.city}</span>
              </p>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--text-primary)',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px dashed var(--border-subtle)'
            }}>
              <span>Total Amount Paid</span>
              <span>₹{Number(order?.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={`/orders/${orderId}/track`} className="btn btn-primary" style={{ flex: 1 }}>
              <Truck size={18} />
              <span>Track Live Delivery</span>
            </Link>
            <Link to="/orders" className="btn btn-outline" style={{ flex: 1 }}>
              <Package size={18} />
              <span>View All Orders</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
