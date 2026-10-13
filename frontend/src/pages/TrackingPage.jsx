import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, MapPin, Phone, Clock, ArrowLeft, RefreshCw, AlertTriangle, User, Navigation, Compass } from 'lucide-react';
import * as deliveryApi from '../api/delivery.api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import DeliveryRouteTracker from '../components/delivery/DeliveryRouteTracker';

export default function TrackingPage() {
  const { orderId } = useParams();
  const [trackingData, setTrackingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const loadTracking = async (isBackground = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!isBackground) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const res = await deliveryApi.getLiveTracking(orderId);
      if (res.success) {
        setTrackingData(res.data);
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.response?.data?.message || 'Could not load delivery tracking information.');
      }
    } finally {
      inFlightRef.current = false;
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  const handleRefreshTelemetry = async () => {
    setIsRefreshing(true);
    try {
      await loadTracking(true);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  useEffect(() => {
    loadTracking();

    // Auto-refresh periodically while page is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadTracking(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [orderId]);

  if (isLoading && !trackingData) {
    return <LoadingSpinner text="Connecting to rider delivery telemetry..." />;
  }

  if (error && !trackingData) {
    return <ErrorState message={error} onRetry={() => loadTracking()} />;
  }

  const deliveryStatus = trackingData?.delivery?.status || trackingData?.orderStatus || 'ASSIGNED';
  const partner = trackingData?.delivery?.assignedPartner || trackingData?.partner;
  const tracking = trackingData?.delivery?.trackingCoordinates || trackingData?.tracking;
  const auditTrail = trackingData?.delivery?.auditLogs || trackingData?.auditTrail || [];

  const paymentStatus = trackingData?.paymentStatus || 'PENDING';
  const isPaid = paymentStatus === 'PAID';
  const totalAmount = trackingData?.totalAmount || '0.00';
  const serverSimulationStartedAt = trackingData?.simulation?.startedAt || trackingData?.delivery?.simulationStartedAt;

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Link to={`/orders/${orderId}`} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--maroon-primary)',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            <ArrowLeft size={16} />
            <span>Back to Order Invoice</span>
          </Link>

          <button 
            onClick={handleRefreshTelemetry} 
            disabled={isRefreshing}
            className="btn btn-outline btn-sm"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px',
              cursor: isRefreshing ? 'wait' : 'pointer'
            }}
          >
            <RefreshCw 
              size={14} 
              style={{
                transition: 'transform 0.5s ease',
                transform: isRefreshing ? 'rotate(360deg)' : 'none'
              }} 
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-subtle)',
          padding: '2.5rem 2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Delivery Telemetry
            </span>
            <h1 style={{ fontSize: '2rem', color: 'var(--maroon-primary)', fontFamily: 'var(--font-serif)', marginTop: '0.2rem' }}>
              Order #{orderId.slice(0, 8)}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '0.4rem' }}>
              Status:{' '}
              <strong style={{ color: deliveryStatus === 'DELIVERED' ? 'var(--veg-green)' : 'var(--saffron-primary)' }}>
                {deliveryStatus.replace(/_/g, ' ')}
              </strong>
              {' '}&bull;{' '}
              Payment:{' '}
              <strong style={{ color: isPaid ? 'var(--veg-green)' : 'var(--warning)' }}>
                {isPaid ? 'PAID' : 'PAYMENT PENDING'}
              </strong>
            </p>
          </div>

          {/* Animated Delivery Stepper with Moving Scooter across all 4 points */}
          <DeliveryRouteTracker 
            orderId={orderId}
            isPaid={isPaid}
            totalAmount={totalAmount}
            actualStatus={deliveryStatus}
            serverSimulationStartedAt={serverSimulationStartedAt}
            onTelemetryChange={setLiveTelemetry}
            onPaymentSuccess={() => loadTracking()}
            onSimulationReset={() => loadTracking(true)}
          />

          {/* Delivery Partner Details Card */}
          {partner && (
            <div style={{
              background: 'var(--bg-cream)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              padding: '1.25rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'var(--maroon-primary)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--maroon-primary)', marginBottom: '2px' }}>
                    {partner.name}
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Delivery Rider &bull; {partner.vehicle || partner.vehicleType}
                  </p>
                </div>
              </div>

              {partner.phone && (
                <a
                  href={`tel:${partner.phone}`}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Phone size={14} />
                  <span>{partner.phone}</span>
                </a>
              )}
            </div>
          )}

          {/* Simulated GPS Telemetry Card with Live Animated Coordinates */}
          <div style={{
            background: '#F9FBFD',
            border: '1px solid #D4E6F1',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.75rem'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.4rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1B4F72', fontWeight: 700, fontSize: '0.92rem' }}>
                <MapPin size={18} />
                <span>Simulated GPS Location Telemetry</span>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.75rem',
                color: isPaid ? '#1E824C' : '#D35400',
                fontWeight: 600,
                background: isPaid ? '#E8F8F0' : '#FEF5E7',
                padding: '2px 8px',
                borderRadius: '999px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPaid ? '#2ECC71' : '#E67E22' }} />
                <span>{isPaid ? 'Live Telemetry Stream' : 'Awaiting Merchant Payment'}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.85rem' }}>
              Coordinates are calculated from live delivery breadcrumbs and authoritative 5-minute simulation milestones.
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '0.85rem', 
              fontSize: '0.85rem',
              padding: '0.75rem 1rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #E8F0F8'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block' }}>Current Latitude</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#1B4F72' }}>
                  {liveTelemetry?.latitude || tracking?.latitude || '19.07600000'}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block' }}>Current Longitude</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: '#1B4F72' }}>
                  {liveTelemetry?.longitude || tracking?.longitude || '72.87770000'}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block' }}>Telemetry Waypoint</span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {liveTelemetry?.currentWaypoint || 'Mithai Mahal Central Sweet Hub'}
                </strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block' }}>Rider Speed & ETA</span>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  {liveTelemetry?.speed || '28 km/h'} &bull; {liveTelemetry?.eta || '5m 00s remaining'}
                </strong>
              </div>
            </div>

            {liveTelemetry?.locationName && (
              <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: '#546E7A', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Navigation size={13} color="#1B4F72" />
                <span><strong>Active Corridor:</strong> {liveTelemetry.locationName}</span>
              </div>
            )}
          </div>

          {/* Audit Trail Breadcrumb Log */}
          {auditTrail.length > 0 && (
            <div>
              <h4 style={{ fontSize: '1rem', color: 'var(--maroon-primary)', marginBottom: '0.75rem' }}>
                Delivery Log History
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                {auditTrail.map((log, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    background: 'var(--bg-cream)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <span>{log.notes || `Transitioned to ${log.status_to || log.status}`}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.created_at || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
