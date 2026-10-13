import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Navigation, 
  Package, 
  UserCheck, 
  CreditCard,
  AlertTriangle,
  Zap,
  Lock,
  RotateCcw,
  Clock,
  Compass
} from 'lucide-react';
import * as paymentApi from '../../api/payment.api';
import * as deliveryApi from '../../api/delivery.api';
import { useToast } from '../../context/ToastContext';
import './DeliveryRouteTracker.css';

/**
 * 4 Authoritative Delivery Waypoints along the Route
 */
export const DELIVERY_WAYPOINTS = [
  {
    key: 'ASSIGNED',
    label: 'Rider Assigned',
    milestoneSecond: 0,
    locationName: 'Mithai Mahal Central Sweet Hub',
    lat: 19.07600000,
    lng: 72.87770000,
    icon: UserCheck
  },
  {
    key: 'PICKED_UP',
    label: 'Order Picked Up',
    milestoneSecond: 100,
    locationName: 'Storefront Dispatch Bay',
    lat: 19.08320000,
    lng: 72.88540000,
    icon: Package
  },
  {
    key: 'IN_TRANSIT',
    label: 'Out for Delivery',
    milestoneSecond: 200,
    locationName: 'City Highway Express Corridor',
    lat: 19.09540000,
    lng: 72.89880000,
    icon: Navigation
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    milestoneSecond: 300,
    locationName: 'Customer Doorstep Residence',
    lat: 19.10820000,
    lng: 72.91250000,
    icon: CheckCircle2
  }
];

// Exact 5-minute journey duration in seconds (5 minutes = 300 seconds)
export const FIVE_MINUTES_SECONDS = 300;

export default function DeliveryRouteTracker({ 
  orderId = '',
  isPaid = false,
  totalAmount = '0.00',
  actualStatus = 'ASSIGNED',
  serverSimulationStartedAt = null,
  onTelemetryChange,
  onPaymentSuccess,
  onSimulationReset
}) {
  const { showToast } = useToast();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  // Authoritative start timestamp: prioritizes server simulation timestamp
  const effectiveStartEpochRef = useRef(null);

  // Compute elapsed time strictly based on authoritative timestamp
  useEffect(() => {
    if (!orderId || !isPaid) {
      setElapsedSeconds(0);
      effectiveStartEpochRef.current = null;
      if (onTelemetryChange) {
        onTelemetryChange(calculateTelemetry(0, false));
      }
      return;
    }

    // Determine start epoch: Server is single source of truth
    let startEpoch;
    if (serverSimulationStartedAt) {
      startEpoch = new Date(serverSimulationStartedAt).getTime();
      // Keep session storage in sync for instant cache hit
      sessionStorage.setItem(`journey_server_start_${orderId}`, startEpoch.toString());
    } else {
      // Fallback: check session storage or initialize
      const cached = sessionStorage.getItem(`journey_server_start_${orderId}`);
      if (cached) {
        startEpoch = parseInt(cached, 10);
      } else {
        startEpoch = Date.now();
        sessionStorage.setItem(`journey_server_start_${orderId}`, startEpoch.toString());
      }
    }
    effectiveStartEpochRef.current = startEpoch;

    const computeCurrentElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - effectiveStartEpochRef.current) / 1000);
      return Math.min(FIVE_MINUTES_SECONDS, Math.max(0, elapsed));
    };

    const initialElapsed = computeCurrentElapsed();
    setElapsedSeconds(initialElapsed);
    if (onTelemetryChange) {
      onTelemetryChange(calculateTelemetry(initialElapsed, true));
    }

    // Update elapsed seconds smoothly every second
    const timer = setInterval(() => {
      const curElapsed = computeCurrentElapsed();
      setElapsedSeconds(curElapsed);
      if (onTelemetryChange) {
        onTelemetryChange(calculateTelemetry(curElapsed, true));
      }

      if (curElapsed >= FIVE_MINUTES_SECONDS) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [orderId, isPaid, serverSimulationStartedAt]);

  const isDelivered = isPaid && (elapsedSeconds >= FIVE_MINUTES_SECONDS || actualStatus === 'DELIVERED');
  const isMoving = isPaid && elapsedSeconds > 0 && elapsedSeconds < FIVE_MINUTES_SECONDS;
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / FIVE_MINUTES_SECONDS) * 100));

  // Time remaining formatted (MM:SS)
  const remainingSec = Math.max(0, FIVE_MINUTES_SECONDS - elapsedSeconds);
  const remMinutes = Math.floor(remainingSec / 60);
  const remSeconds = remainingSec % 60;
  const formattedCountdown = `${remMinutes}m ${String(remSeconds).padStart(2, '0')}s`;

  // Dynamic Floating status pill message on vehicle
  let statusMessage = '📋 Rider Assigned: Preparing Fresh Sweets...';
  if (!isPaid) {
    statusMessage = '🔒 Payment Pending: Awaiting Merchant';
  } else if (isDelivered) {
    statusMessage = '🎉 Order Delivered Successfully!';
  } else if (elapsedSeconds >= 200) {
    statusMessage = '🛵 Out for Delivery: Nearing Your Doorstep...';
  } else if (elapsedSeconds >= 100) {
    statusMessage = '📦 Sweets Picked Up: En Route to Destination...';
  }

  // Edge safety class to prevent status pill clipping
  let edgeClass = '';
  if (progressPercent < 15) {
    edgeClass = 'near-start';
  } else if (progressPercent > 85) {
    edgeClass = 'near-end';
  }

  // Checkpoint milestone status
  const getCheckpointState = (wpIndex) => {
    if (!isPaid) return wpIndex === 0 ? 'active' : 'upcoming';
    
    if (wpIndex === 0) {
      return elapsedSeconds >= 100 ? 'completed' : 'active';
    }
    if (wpIndex === 1) {
      if (elapsedSeconds >= 200) return 'completed';
      if (elapsedSeconds >= 100) return 'active';
      return 'upcoming';
    }
    if (wpIndex === 2) {
      if (elapsedSeconds >= FIVE_MINUTES_SECONDS || isDelivered) return 'completed';
      if (elapsedSeconds >= 200) return 'active';
      return 'upcoming';
    }
    if (wpIndex === 3) {
      if (elapsedSeconds >= FIVE_MINUTES_SECONDS || isDelivered) return 'completed';
      if (elapsedSeconds >= 290) return 'active';
      return 'upcoming';
    }
    return 'upcoming';
  };

  // Replay / Reset 5-minute journey via backend API
  const handleReplaySimulation = async () => {
    if (!orderId) return;
    setIsResetting(true);
    try {
      const now = Date.now();
      sessionStorage.setItem(`journey_server_start_${orderId}`, now.toString());
      effectiveStartEpochRef.current = now;
      setElapsedSeconds(0);

      await deliveryApi.resetDeliverySimulation(orderId);
      showToast('Delivery simulation restarted from beginning (5 minutes).', 'success');
      if (onSimulationReset) {
        onSimulationReset();
      }
    } catch (err) {
      // In case offline, reset locally
      setElapsedSeconds(0);
      showToast('Restarted 5-minute journey locally.', 'info');
      if (onSimulationReset) {
        onSimulationReset();
      }
    } finally {
      setIsResetting(false);
    }
  };

  // Instant Test Payment verification helper for test mode
  const handleVerifyTestPayment = async () => {
    setIsSimulatingPayment(true);
    try {
      await paymentApi.simulateWebhookPayment(orderId);
      showToast('Payment accepted! Starting 5-minute delivery route.', 'success');
      const now = Date.now();
      sessionStorage.setItem(`journey_server_start_${orderId}`, now.toString());
      effectiveStartEpochRef.current = now;
      setElapsedSeconds(0);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err) {
      showToast('Redirecting to payment checkout...', 'info');
      window.location.href = `/orders/${orderId}/pay`;
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  return (
    <div className="delivery-tracker-wrapper">
      {/* 1. PAYMENT GATE BANNER - Appears strictly when payment is pending */}
      {!isPaid && (
        <div className="payment-gate-banner">
          <div className="payment-gate-info">
            <AlertTriangle size={24} color="#D35400" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4>Merchant Payment Required for Delivery Dispatch</h4>
              <p>
                Live delivery scooter transit and real-time tracking will activate once the merchant 
                payment of <strong>₹{totalAmount || '0.00'}</strong> is verified.
              </p>
            </div>
          </div>

          <div className="payment-gate-actions">
            <Link to={`/orders/${orderId}/pay`} className="btn btn-primary btn-sm">
              <CreditCard size={15} />
              <span>Pay Now (₹{totalAmount || '0.00'})</span>
            </Link>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleVerifyTestPayment}
              disabled={isSimulatingPayment}
              title="Verify payment instantly in development / test mode"
            >
              <Zap size={14} />
              <span>{isSimulatingPayment ? 'Verifying...' : 'Verify Test Payment'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. LIVE SIMULATION STATUS HEADER BAR */}
      {isPaid && (
        <div className="simulation-live-meta-bar">
          <div className="sim-meta-badge">
            <Compass size={14} className="sim-spin-icon" />
            <span className="badge-text">DEMO DELIVERY &bull; 5 MINUTES</span>
          </div>

          <div className="sim-meta-stats">
            <span className="sim-progress-indicator">
              <strong>{progressPercent.toFixed(0)}%</strong> Completed
            </span>
            <span className="sim-divider">&bull;</span>
            <span className="sim-countdown-badge">
              <Clock size={13} />
              <span>{isDelivered ? 'Delivered' : formattedCountdown}</span>
            </span>
          </div>

          {isDelivered && (
            <button
              type="button"
              onClick={handleReplaySimulation}
              disabled={isResetting}
              className="btn btn-outline btn-sm sim-replay-btn"
              title="Restart the 5-minute delivery simulation"
            >
              <RotateCcw size={13} className={isResetting ? 'spin-anim' : ''} />
              <span>{isResetting ? 'Restarting...' : 'Replay Demo Delivery'}</span>
            </button>
          )}
        </div>
      )}

      {/* 3. MAIN DELIVERY STEPPER & ROAD TRACK */}
      <div className="delivery-stepper-row">
        {/* Asphalt Road Track */}
        <div className="delivery-road-track">
          {/* Dashed Center Road Stripe */}
          <div className="delivery-road-dashes" />

          {/* Active Gradient Filled Progress */}
          <div 
            className="delivery-road-progress"
            style={{
              width: !isPaid ? '0%' : isDelivered ? '100%' : `${progressPercent}%`,
              transition: isMoving ? 'width 1s linear' : 'none'
            }}
          >
            {isMoving && <div className="delivery-road-glow" />}
          </div>

          {/* ANIMATED INDIAN SWEETS DELIVERY SCOOTER */}
          <div 
            className={`delivery-truck-vehicle ${edgeClass}`}
            style={{
              left: !isPaid ? '0%' : isDelivered ? '100%' : `${progressPercent}%`,
              transition: isMoving ? 'left 1s linear' : 'none'
            }}
          >
            {/* Floating Live Status Tooltip */}
            <div className="truck-floating-pill">
              {isPaid ? (
                <>
                  <span className={`status-beacon-dot ${isMoving ? '' : 'orange'}`} />
                  <span>{statusMessage}</span>
                </>
              ) : (
                <>
                  <Lock size={12} color="#F39C12" />
                  <span>Payment Pending: Awaiting Merchant</span>
                </>
              )}
            </div>

            {/* Authentic Indian Mithai Delivery Scooter SVG */}
            <div className={`scooter-chassis ${isMoving ? 'moving' : ''}`}>
              <svg 
                width="64" 
                height="42" 
                viewBox="0 0 64 42" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Golden Headlamp Beam Projection */}
                  <linearGradient id="scooterHeadlightBeam" x1="52" y1="18" x2="64" y2="18" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FAD7A0" stopOpacity={isPaid ? '0.9' : '0.2'} />
                    <stop offset="100%" stopColor="#FAD7A0" stopOpacity="0" />
                  </linearGradient>
                  {/* Royal Maroon Body Gradient */}
                  <linearGradient id="scooterBodyGrad" x1="10" y1="12" x2="45" y2="30" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#8A2238" />
                    <stop offset="100%" stopColor="#5E121E" />
                  </linearGradient>
                  {/* Insulated Mithai Sweet Box Gradient */}
                  <linearGradient id="mithaiBoxGrad" x1="4" y1="8" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#E5B942" />
                    <stop offset="100%" stopColor="#B38600" />
                  </linearGradient>
                </defs>

                {/* Headlight Forward Beam Cone (Active when paid) */}
                {isPaid && (
                  <polygon
                    className="headlight-cone"
                    points="52,19 64,12 64,28"
                    fill="url(#scooterHeadlightBeam)"
                  />
                )}

                {/* REAR INSULATED MITHAI SWEET BOX (Mounted on rear rack) */}
                <rect 
                  x="4" 
                  y="9" 
                  width="18" 
                  height="16" 
                  rx="3" 
                  fill="url(#mithaiBoxGrad)" 
                  stroke="#8A2238" 
                  strokeWidth="1.2" 
                />
                {/* Mithai Box Decorative Maroon Ribbon Cross */}
                <path d="M4 17 H22" stroke="#8A2238" strokeWidth="1.8" />
                <path d="M13 9 V25" stroke="#8A2238" strokeWidth="1.8" />
                {/* Gold Sweet Emblem Badge */}
                <circle cx="13" cy="17" r="2.5" fill="#FFEAA7" stroke="#8A2238" strokeWidth="0.8" />

                {/* Rear Rack / Carrier Mount */}
                <path d="M6 25 L18 25 L16 30" stroke="#4A4A4A" strokeWidth="1.6" strokeLinecap="round" />

                {/* Scooter Cushioned Seat */}
                <path 
                  d="M20 19 C20 17 23 15 28 15 C33 15 35 17 35 20 L22 21 Z" 
                  fill="#2C221E" 
                  stroke="#1A110E" 
                  strokeWidth="0.8" 
                />

                {/* Scooter Main Chassis & Side Panels (Burgundy + Gold Pinstripe) */}
                <path 
                  d="M17 22 C17 20 22 21 28 22 L36 23 L41 30 H26 L20 28 Z" 
                  fill="url(#scooterBodyGrad)" 
                  stroke="#D4AF37" 
                  strokeWidth="0.8" 
                />

                {/* Low Footboard / Floorboard */}
                <path d="M34 29 H43 L41 33 H33 Z" fill="#2C221E" stroke="#555" strokeWidth="0.8" />

                {/* Front Apron & Cowl Rising to Steering */}
                <path 
                  d="M41 31 L47 18 C48 16 50 15 52 16 L53 19 L46 32 Z" 
                  fill="url(#scooterBodyGrad)" 
                  stroke="#D4AF37" 
                  strokeWidth="0.8" 
                />

                {/* Handlebar Column & Grips */}
                <path d="M48 16 L50 12 L53 13" stroke="#2C221E" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="53.5" cy="12.5" r="1.4" fill="#D4AF37" />

                {/* Front Windshield / Aerodynamic Visor */}
                <path 
                  d="M48 14 C48 10 51 8 53 8 C54 8 55 9 55 12 L50 15 Z" 
                  fill="#D4E6F1" 
                  opacity="0.85" 
                  stroke="#A9CCE3" 
                  strokeWidth="0.6" 
                />

                {/* Golden Projector Headlamp */}
                <circle cx="52" cy="19" r="2.2" fill={isPaid ? '#FAD7A0' : '#888888'} stroke="#D4AF37" strokeWidth="0.8" />

                {/* Rear Mudguard / Fender */}
                <path d="M8 32 C8 26 18 26 20 32" stroke="#8A2238" strokeWidth="2.2" fill="none" />

                {/* Front Mudguard / Fender */}
                <path d="M44 32 C44 26 54 26 56 32" stroke="#8A2238" strokeWidth="2.2" fill="none" />

                {/* ROTATING REAR WHEEL */}
                <g 
                  className={isMoving ? 'wheel-rotating' : ''} 
                  style={{ transformOrigin: '14px 33px' }}
                >
                  <circle cx="14" cy="33" r="6" fill="#2C221E" />
                  <circle cx="14" cy="33" r="4.2" fill="#D4AF37" />
                  <circle cx="14" cy="33" r="2.2" fill="#7A1C1C" />
                  <circle cx="14" cy="33" r="1" fill="#FFFFFF" />
                  {/* Spokes */}
                  <line x1="14" y1="29" x2="14" y2="37" stroke="#2C221E" strokeWidth="0.7" />
                  <line x1="10" y1="33" x2="18" y2="33" stroke="#2C221E" strokeWidth="0.7" />
                </g>

                {/* ROTATING FRONT WHEEL */}
                <g 
                  className={isMoving ? 'wheel-rotating' : ''} 
                  style={{ transformOrigin: '50px 33px' }}
                >
                  <circle cx="50" cy="33" r="6" fill="#2C221E" />
                  <circle cx="50" cy="33" r="4.2" fill="#D4AF37" />
                  <circle cx="50" cy="33" r="2.2" fill="#7A1C1C" />
                  <circle cx="50" cy="33" r="1" fill="#FFFFFF" />
                  {/* Spokes */}
                  <line x1="50" y1="29" x2="50" y2="37" stroke="#2C221E" strokeWidth="0.7" />
                  <line x1="46" y1="33" x2="54" y2="33" stroke="#2C221E" strokeWidth="0.7" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* 4 DELIVERY CHECKPOINT MILESTONES */}
        {DELIVERY_WAYPOINTS.map((wp, idx) => {
          const state = getCheckpointState(idx);
          const IconComponent = wp.icon;
          const isCompleted = state === 'completed';
          const isActive = state === 'active';

          return (
            <div key={wp.key} className="checkpoint-node-wrapper">
              <div className={`checkpoint-circle ${isCompleted ? 'completed' : isActive ? 'active' : ''}`}>
                {isCompleted ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <IconComponent size={18} />
                )}
              </div>

              <span className={`checkpoint-label ${isActive ? 'active' : isCompleted ? 'completed' : ''}`}>
                {wp.label}
              </span>
              <span className="checkpoint-timestamp">
                {idx === 0 ? '0:00' : idx === 1 ? '1:40' : idx === 2 ? '3:20' : '5:00'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Interpolates GPS Coordinates and Telemetry attributes along the 5-minute route
 */
export function calculateTelemetry(elapsedSeconds, isPaid) {
  const wps = DELIVERY_WAYPOINTS;

  if (!isPaid) {
    return {
      latitude: wps[0].lat.toFixed(8),
      longitude: wps[0].lng.toFixed(8),
      speed: '0 km/h (Awaiting Payment)',
      locationName: 'Mithai Mahal Central Sweet Hub (Stationary)',
      currentWaypoint: 'Rider Assigned (Payment Pending)',
      eta: 'Awaiting Merchant Payment',
      progressPercent: 0,
      elapsedSeconds: 0,
      remainingSeconds: FIVE_MINUTES_SECONDS
    };
  }

  if (elapsedSeconds >= FIVE_MINUTES_SECONDS) {
    return {
      latitude: wps[3].lat.toFixed(8),
      longitude: wps[3].lng.toFixed(8),
      speed: '0 km/h (Delivered)',
      locationName: wps[3].locationName,
      currentWaypoint: wps[3].label,
      eta: 'Delivered!',
      progressPercent: 100,
      elapsedSeconds: FIVE_MINUTES_SECONDS,
      remainingSeconds: 0
    };
  }

  let segmentIndex = 0;
  let fractionInSegment = 0;

  if (elapsedSeconds >= 200) {
    // Segment 2: Out for Delivery -> Delivered (200s to 300s = 100s duration)
    segmentIndex = 2;
    fractionInSegment = Math.max(0, Math.min(1, (elapsedSeconds - 200) / 100));
  } else if (elapsedSeconds >= 100) {
    // Segment 1: Picked Up -> Out for Delivery (100s to 200s = 100s duration)
    segmentIndex = 1;
    fractionInSegment = Math.max(0, Math.min(1, (elapsedSeconds - 100) / 100));
  } else {
    // Segment 0: Assigned -> Picked Up (0s to 100s = 100s duration)
    segmentIndex = 0;
    fractionInSegment = Math.max(0, Math.min(1, elapsedSeconds / 100));
  }

  const startWp = wps[segmentIndex];
  const endWp = wps[segmentIndex + 1];

  const lat = startWp.lat + (endWp.lat - startWp.lat) * fractionInSegment;
  const lng = startWp.lng + (endWp.lng - startWp.lng) * fractionInSegment;

  const speed = 28 + Math.round((elapsedSeconds % 60) / 10);
  const locationName = fractionInSegment < 0.25 
    ? startWp.locationName 
    : fractionInSegment > 0.75 
      ? endWp.locationName 
      : `En route: ${startWp.locationName} → ${endWp.locationName}`;

  const remainingSec = Math.max(0, FIVE_MINUTES_SECONDS - elapsedSeconds);
  const remM = Math.floor(remainingSec / 60);
  const remS = remainingSec % 60;
  const eta = `${remM}m ${remS}s remaining`;
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / FIVE_MINUTES_SECONDS) * 100));

  return {
    latitude: lat.toFixed(8),
    longitude: lng.toFixed(8),
    speed: `${speed} km/h`,
    locationName,
    currentWaypoint: fractionInSegment > 0.5 ? endWp.label : startWp.label,
    eta,
    progressPercent,
    elapsedSeconds,
    remainingSeconds: remainingSec
  };
}
