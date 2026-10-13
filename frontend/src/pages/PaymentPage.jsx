import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, AlertTriangle, ShieldCheck, ArrowRight, ExternalLink, Zap } from 'lucide-react';
import * as orderApi from '../api/order.api';
import * as paymentApi from '../api/payment.api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import RazorpayModal from '../components/common/RazorpayModal';

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initPayment() {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Fetch current order details
        const orderRes = await orderApi.getMyOrder(orderId);
        if (!orderRes.success) throw new Error('Order not found');
        setOrder(orderRes.data);

        // If order is already paid, redirect straight to success
        if (orderRes.data.payment_status === 'PAID') {
          navigate(`/orders/${orderId}/success`, { replace: true });
          return;
        }

        // 2. Initiate payment session via backend provider abstraction
        const payRes = await paymentApi.initiatePayment(orderId);
        if (payRes.success) {
          setPaymentSession(payRes.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Payment initiation failed.');
      } finally {
        setIsLoading(false);
      }
    }

    initPayment();
  }, [orderId, navigate]);

  const isMockProvider = paymentSession?.checkout?.provider === 'razorpay_mock' || paymentSession?.checkout?.provider === 'mock';

  const handleRazorpaySuccess = async (rzpResponse) => {
    setIsProcessing(true);
    try {
      const { payment, checkout } = paymentSession || {};
      const ref = payment?.payment_reference || payment?.paymentReference;
      const orderRzpId = rzpResponse?.razorpay_order_id || checkout?.razorpayOrderId || checkout?.providerPaymentId || ref;
      const paymentRzpId = rzpResponse?.razorpay_payment_id || `pay_${Date.now()}`;

      let signature = rzpResponse?.razorpay_signature;

      // If simulated authorization from Dupe modal without client-side secret, retrieve test signature from server
      if (!signature && (isMockProvider || rzpResponse?.isSimulator)) {
        try {
          const signRes = await paymentApi.generateTestSignature(orderId, {
            razorpayOrderId: orderRzpId,
            razorpayPaymentId: paymentRzpId
          });
          signature = signRes?.data?.razorpaySignature;
        } catch (signErr) {
          console.warn('Could not retrieve simulated signature, attempting fallback mock capture:', signErr);
        }
      }

      if (signature) {
        // Authenticated server-side cryptographic HMAC-SHA256 signature verification
        await paymentApi.verifyRazorpayPayment(orderId, {
          razorpayOrderId: orderRzpId,
          razorpayPaymentId: paymentRzpId,
          razorpaySignature: signature
        });
        showToast('Payment verified successfully via Razorpay signature!', 'success');
      } else if (isMockProvider) {
        // Fallback for mock provider mode
        await paymentApi.simulateWebhookPayment(
          orderId,
          ref,
          paymentRzpId,
          payment?.amount || order?.total_amount
        );
        showToast('Test payment captured via development mock gateway.', 'success');
      } else {
        throw new Error('Payment signature is missing. Verification could not proceed.');
      }

      setIsRazorpayOpen(false);
      navigate(`/orders/${orderId}/success`, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Payment verification failed.';
      showToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLaunchRazorpay = () => {
    const { checkout, payment } = paymentSession || {};
    const keyId = checkout?.keyId || paymentSession?.checkout?.razorpayKeyId || 'rzp_test_Tmz9SmPPkoO88p';
    const amountInPaise = Math.round(Number(order?.total_amount || payment?.amount || 0) * 100);

    // Filter order_id: pass only if authentic Razorpay server order ID (starts with order_ and not order_rzp_)
    const validOrderId = checkout?.razorpayOrderId && !checkout.razorpayOrderId.startsWith('order_rzp_')
      ? checkout.razorpayOrderId
      : undefined;

    // If official Razorpay checkout.js script is loaded, launch the official Standard Checkout modal
    if (typeof window.Razorpay === 'function') {
      const options = {
        key: keyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'Mithai Mahal Sweets',
        description: `Order #${order?.order_number || orderId.slice(0, 8)}`,
        image: '/sweets/shop-storefront.svg',
        order_id: validOrderId,
        prefill: {
          name: order?.recipient_name || '',
          contact: order?.recipient_phone || ''
        },
        theme: {
          color: '#7A1C1C'
        },
        handler: function (response) {
          handleRazorpaySuccess(response);
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          }
        }
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          setIsProcessing(false);
          const errMsg = response.error?.description || response.error?.reason || 'Razorpay payment attempt failed.';
          showToast(errMsg, 'error');
        });
        rzp.open();
        return;
      } catch (err) {
        console.warn('Official Razorpay SDK initialization error, falling back to simulator:', err);
      }
    }

    // Fallback: Open internal Razorpay test simulator modal if external script is blocked/offline
    setIsRazorpayOpen(true);
  };

  const handleQuickMockPayment = async () => {
    if (!paymentSession) return;
    if (!isMockProvider) {
      showToast('Mock instant settlement is disabled when active provider is Razorpay.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const { payment, checkout } = paymentSession;
      const ref = payment.payment_reference || payment.paymentReference;
      await paymentApi.simulateWebhookPayment(
        orderId,
        ref,
        checkout.providerPaymentId,
        payment.amount
      );

      showToast('Development mock payment captured successfully!', 'success');
      navigate(`/orders/${orderId}/success`, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Payment simulation failed.';
      showToast(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner text="Initiating secure payment gateway..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  const amountFormatted = Number(order?.total_amount || paymentSession?.payment?.amount || 0).toFixed(2);
  const razorpayKey = paymentSession?.checkout?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_Tmz9SmPPkoO88p';

  return (
    <div style={{ padding: '3.5rem 1.25rem 5rem' }}>
      <div className="container" style={{ maxWidth: '620px' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-subtle)',
          padding: '2.5rem 2rem'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--maroon-subtle)',
              color: 'var(--maroon-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <CreditCard size={32} />
            </div>
            <h1 style={{ fontSize: '1.8rem', color: 'var(--maroon-primary)', fontFamily: 'var(--font-serif)' }}>
              Complete Sweet Order Payment
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
              Order #{order?.order_number || orderId.slice(0, 8)}
            </p>
          </div>

          {/* Amount Badge */}
          <div style={{
            background: 'var(--bg-cream)',
            border: '1.5px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'center',
            marginBottom: '1.75rem'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Payable Amount
            </span>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--maroon-primary)', marginTop: '0.2rem' }}>
              ₹{amountFormatted}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
              Reference: <code style={{ color: 'var(--text-primary)' }}>{paymentSession?.payment?.payment_reference || paymentSession?.payment?.paymentReference}</code>
            </p>
          </div>

          {/* Razorpay Gateway Dupe Section */}
          <div style={{
            background: 'linear-gradient(135deg, #0C2340 0%, #17375E 100%)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 8px 16px rgba(12, 35, 64, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: '#0D83FF',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.5px'
                }}>
                  RAZORPAY
                </div>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#E2E8F0' }}>
                  Standard Checkout
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.15)', padding: '2px 8px', borderRadius: '4px', color: '#93C5FD', fontWeight: 600 }}>
                Sandbox Test
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.5, marginBottom: '1rem' }}>
              Active Key: <code style={{ color: '#67E8F9', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>{razorpayKey}</code>
              <br />
              Supports Instant UPI (GPay, PhonePe, Paytm), Netbanking, and Cards.
            </p>

            <button
              onClick={handleLaunchRazorpay}
              disabled={isProcessing}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0.85rem',
                background: '#0D83FF',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(13, 131, 255, 0.4)'
              }}
            >
              <Zap size={18} />
              <span>Pay with Razorpay Standard Checkout (₹{amountFormatted})</span>
            </button>

            {/* Direct Razorpay Dupe Modal Button */}
            <button
              type="button"
              onClick={() => setIsRazorpayOpen(true)}
              disabled={isProcessing}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '0.75rem',
                marginTop: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1.5px solid #38BDF8',
                borderRadius: '8px',
                color: '#E0F2FE',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <CreditCard size={17} />
              <span>Open Razorpay Dupe (Interactive Test Mode)</span>
            </button>
          </div>

          {/* Development-Only Mock Settlement Option (Displayed strictly in mock provider mode) */}
          {isMockProvider && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#B45309', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={18} />
                <span>Development-Only Mock Gateway</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.9rem' }}>
                Simulates offline developer webhook settlement without opening third-party gateway popups.
              </p>

              <button
                onClick={handleQuickMockPayment}
                disabled={isProcessing}
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>{isProcessing ? 'Processing Transaction...' : 'Simulate Offline Test Settlement'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <ShieldCheck size={16} color="var(--veg-green)" />
            <span>Razorpay-Compatible HMAC-SHA256 Idempotent Webhook Verification</span>
          </div>
        </div>
      </div>

      {/* Razorpay Dupe Checkout Modal */}
      <RazorpayModal
        isOpen={isRazorpayOpen}
        onClose={() => setIsRazorpayOpen(false)}
        amount={amountFormatted}
        orderNumber={order?.order_number || orderId.slice(0, 8)}
        paymentReference={paymentSession?.payment?.payment_reference || paymentSession?.payment?.paymentReference}
        razorpayOrderId={paymentSession?.checkout?.razorpayOrderId}
        keyId={razorpayKey}
        customerName={order?.recipient_name}
        customerPhone={order?.recipient_phone}
        onSuccess={handleRazorpaySuccess}
        isProcessing={isProcessing}
      />
    </div>
  );
}
