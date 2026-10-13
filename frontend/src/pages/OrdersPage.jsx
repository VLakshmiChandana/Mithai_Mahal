import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  Store, 
  Calendar, 
  ArrowRight, 
  Eye, 
  CreditCard, 
  RefreshCw,
  Clock,
  Compass,
  Navigation
} from 'lucide-react';
import * as orderApi from '../api/order.api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import './OrdersPage.css';

/**
 * Compact Delivery Progress Component for Active Customer Order Cards
 */
function CompactDeliveryProgress({ order }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (order.delivery?.simulationElapsedSeconds !== undefined) {
      return order.delivery.simulationElapsedSeconds;
    }
    const startedAt = order.delivery?.simulationStartedAt || order.created_at;
    if (!startedAt) return 0;
    return Math.min(300, Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
  });

  const startedAt = order.delivery?.simulationStartedAt || order.created_at;

  useEffect(() => {
    if (!startedAt || order.payment_status !== 'PAID' || order.order_status === 'CANCELLED') {
      return;
    }

    const startEpoch = new Date(startedAt).getTime();
    const computeElapsed = () => {
      const now = Date.now();
      const el = Math.floor((now - startEpoch) / 1000);
      return Math.min(300, Math.max(0, el));
    };

    setElapsedSeconds(computeElapsed());

    const timer = setInterval(() => {
      const cur = computeElapsed();
      setElapsedSeconds(cur);
      if (cur >= 300) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt, order.payment_status, order.order_status]);

  const isDelivered = order.order_status === 'DELIVERED' || elapsedSeconds >= 300;
  const isMoving = !isDelivered && elapsedSeconds > 0;
  const progressPercent = isDelivered ? 100 : Math.min(100, Math.max(0, (elapsedSeconds / 300) * 100));

  const remainingSec = Math.max(0, 300 - elapsedSeconds);
  const remMin = Math.floor(remainingSec / 60);
  const remSec = remainingSec % 60;
  const countdownText = isDelivered ? 'Delivered' : `${remMin}m ${String(remSec).padStart(2, '0')}s left`;

  const getWpState = (idx) => {
    if (idx === 0) return elapsedSeconds >= 100 ? 'completed' : 'active';
    if (idx === 1) return elapsedSeconds >= 200 ? 'completed' : elapsedSeconds >= 100 ? 'active' : 'upcoming';
    if (idx === 2) return isDelivered ? 'completed' : elapsedSeconds >= 200 ? 'active' : 'upcoming';
    if (idx === 3) return isDelivered ? 'completed' : 'upcoming';
    return 'upcoming';
  };

  const partnerName = order.delivery?.partnerName || 'Ramesh Kumar (Mithai Express)';
  const vehicle = order.delivery?.vehicleNumber ? `${order.delivery.vehicleType} (${order.delivery.vehicleNumber})` : 'Delivery Scooter';

  return (
    <div className="compact-delivery-section">
      <div className="compact-delivery-header">
        <div className="compact-delivery-title">
          <Navigation size={14} color="#7A1C1C" />
          <span>Live 5-Min Delivery Tracking</span>
        </div>
        <div className="compact-delivery-badge">
          <Clock size={11} />
          <span>{countdownText}</span>
        </div>
      </div>

      {/* Mini Road Track */}
      <div className="compact-road-container">
        <div className="compact-road-track">
          <div 
            className="compact-road-progress" 
            style={{ width: `${progressPercent}%` }} 
          />

          {/* Mini Scooter Marker */}
          <div 
            className={`compact-scooter-marker ${isMoving ? 'bouncing' : ''}`}
            style={{ left: `${progressPercent}%` }}
          >
            {/* 30px Mini Indian Sweet Delivery Scooter */}
            <svg width="32" height="22" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Sweet Box */}
              <rect x="2" y="8" width="13" height="11" rx="2" fill="#D4AF37" stroke="#7A1C1C" strokeWidth="1" />
              <path d="M2 13.5 H15" stroke="#7A1C1C" strokeWidth="1" />
              <path d="M8.5 8 V19" stroke="#7A1C1C" strokeWidth="1" />
              {/* Seat & Chassis */}
              <path d="M14 15 C14 13 18 12 24 12 L28 17 H18 Z" fill="#2C221E" />
              <path d="M18 17 L25 18 L30 24 H20 Z" fill="#7A1C1C" stroke="#D4AF37" strokeWidth="0.8" />
              {/* Front Apron */}
              <path d="M28 24 L34 13 L38 14 L33 24 Z" fill="#7A1C1C" stroke="#D4AF37" strokeWidth="0.8" />
              {/* Windshield */}
              <path d="M34 13 L38 8 L40 10 L37 14 Z" fill="#D4E6F1" opacity="0.9" />
              {/* Headlamp */}
              <circle cx="38" cy="14" r="1.8" fill="#FAD7A0" />
              {/* Rear Wheel */}
              <circle cx="10" cy="25" r="4.5" fill="#2C221E" stroke="#D4AF37" strokeWidth="0.8" />
              <circle cx="10" cy="25" r="1.5" fill="#7A1C1C" />
              {/* Front Wheel */}
              <circle cx="36" cy="25" r="4.5" fill="#2C221E" stroke="#D4AF37" strokeWidth="0.8" />
              <circle cx="36" cy="25" r="1.5" fill="#7A1C1C" />
            </svg>
          </div>
        </div>

        {/* 4 Waypoints Labels */}
        <div className="compact-waypoints-row">
          {[
            { label: 'Assigned', idx: 0 },
            { label: 'Picked Up', idx: 1 },
            { label: 'Out for Delivery', idx: 2 },
            { label: 'Delivered', idx: 3 }
          ].map((wp) => {
            const state = getWpState(wp.idx);
            return (
              <div key={wp.idx} className="compact-waypoint-col">
                <div className={`compact-waypoint-dot ${state}`} />
                <span className={`compact-waypoint-text ${state}`}>{wp.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="compact-rider-info">
        <span>Rider: <strong>{partnerName}</strong> &bull; {vehicle}</span>
        <Link 
          to={`/orders/${order.id}/track`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--maroon-primary)',
            fontWeight: 700,
            textDecoration: 'none'
          }}
        >
          <span>Track Live GPS</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  const inFlightRef = useRef(false);

  const loadOrders = async (isBackground = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!isBackground) {
      setIsRefreshing(true);
      setError(null);
    }
    try {
      const normalizedStatus = statusFilter === 'OUT FOR DELIVERY' ? 'OUT_FOR_DELIVERY' : statusFilter;
      const params = normalizedStatus !== 'ALL' ? { status: normalizedStatus } : {};
      const res = await orderApi.listMyOrders(params);
      if (res.success) {
        setOrders(res.data);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.response?.data?.message || 'Could not load your orders.');
      }
    } finally {
      inFlightRef.current = false;
      if (!isBackground) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // Initial load & on filter change
  useEffect(() => {
    setIsLoading(true);
    loadOrders(false);
  }, [statusFilter]);

  // Visibility-aware background polling every 4 seconds
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadOrders(true);
      }
    }, 4000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollingInterval);
    };
  }, [statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="badge badge-success">DELIVERED</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="badge badge-gold">OUT FOR DELIVERY</span>;
      case 'PREPARING':
        return <span className="badge badge-warning">PREPARING</span>;
      case 'CONFIRMED':
        return <span className="badge badge-gold">CONFIRMED</span>;
      case 'CANCELLED':
        return <span className="badge" style={{ background: '#FADBD8', color: '#922B21' }}>CANCELLED</span>;
      default:
        return <span className="badge badge-maroon">{status}</span>;
    }
  };

  const filterOptions = [
    'ALL', 
    'PLACED', 
    'CONFIRMED', 
    'PREPARING', 
    'OUT FOR DELIVERY', 
    'DELIVERED', 
    'CANCELLED'
  ];

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
              <h1 style={{ fontSize: '2.2rem', margin: 0 }}>My Sweet Orders</h1>
              <div className="orders-live-pill" title="Live background order updates active">
                <span className="orders-live-dot" />
                <span>Live Orders Stream &bull; Auto-syncing</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Track order fulfillment, 5-minute live delivery journeys, and past order receipts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => loadOrders(false)}
              disabled={isRefreshing}
              className="btn btn-outline btn-sm"
              style={{
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.75 : 1
              }}
            >
              <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Orders'}</span>
            </button>
            <Link to="/shops" className="btn btn-outline btn-sm">
              <span>Order More Sweets</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Status Filters */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '2rem',
          scrollbarWidth: 'none'
        }}>
          {filterOptions.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === st ? 'var(--maroon-primary)' : 'var(--border-subtle)',
                background: statusFilter === st ? 'var(--maroon-primary)' : '#FFFFFF',
                color: statusFilter === st ? '#FFFFFF' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingSpinner text="Retrieving orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadOrders(false)} />
        ) : orders.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Package size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--maroon-primary)' }}>No orders found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              {statusFilter !== 'ALL'
                ? `You have no sweet orders with status "${statusFilter}".`
                : 'You have not placed any sweet orders yet.'}
            </p>
            <Link to="/shops" className="btn btn-primary">
              <span>Explore Sweet Shops</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {orders.map((order) => {
              const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Check if order is eligible for the live delivery tracking progress indicator
              const isTrackingEligible = order.payment_status === 'PAID' && 
                order.order_status !== 'CANCELLED' && 
                ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.order_status);

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    padding: '1.5rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Order ID
                      </span>
                      <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--maroon-primary)' }}>
                        {order.order_number}
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} />
                        <span>{orderDate}</span>
                      </span>
                      {getStatusBadge(order.order_status)}
                    </div>
                  </div>

                  {/* Compact Delivery Progress Tracker */}
                  {isTrackingEligible && (
                    <CompactDeliveryProgress order={order} />
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}>
                    <div>
                      {order.shop_name && (
                        <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem' }}>
                          <Store size={16} color="var(--maroon-primary)" />
                          <span>Sweet Shop: <strong>{order.shop_name}</strong></span>
                        </p>
                      )}
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        Payment: <strong style={{ color: order.payment_status === 'PAID' ? 'var(--veg-green)' : 'var(--warning)' }}>{order.payment_status}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</span>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ₹{Number(order.total_amount).toFixed(2)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {order.payment_status === 'PENDING' && order.order_status !== 'CANCELLED' && (
                          <Link
                            to={`/orders/${order.id}/pay`}
                            className="btn btn-primary btn-sm"
                            style={{ background: 'var(--maroon-primary)' }}
                          >
                            <CreditCard size={15} />
                            <span>Pay Now</span>
                          </Link>
                        )}
                        <Link to={`/orders/${order.id}`} className="btn btn-outline btn-sm">
                          <Eye size={15} />
                          <span>Details</span>
                        </Link>
                        {order.order_status !== 'CANCELLED' && (
                          <Link to={`/orders/${order.id}/track`} className="btn btn-primary btn-sm">
                            <Truck size={15} />
                            <span>Track</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
