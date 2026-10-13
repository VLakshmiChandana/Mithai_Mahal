import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, X, Lock, Smartphone, CreditCard, Building2, Wallet } from 'lucide-react';

export default function RazorpayModal({
  isOpen,
  onClose,
  amount,
  orderNumber,
  paymentReference,
  razorpayOrderId,
  keyId,
  customerName,
  customerPhone,
  onSuccess,
  isProcessing
}) {
  const [activeTab, setActiveTab] = useState('UPI'); // UPI, CARD, NETBANKING, WALLET
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
  const [vpa, setVpa] = useState(`${(customerName || 'customer').toLowerCase().replace(/\s+/g, '')}@okaxis`);
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  if (!isOpen) return null;

  const handleAuthorize = () => {
    // Generate realistic Razorpay payment identifiers
    const mockRzpPaymentId = `pay_${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6)}`;
    onSuccess({
      razorpay_payment_id: mockRzpPaymentId,
      razorpay_order_id: razorpayOrderId || paymentReference,
      isSimulator: true,
      method: activeTab
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Razorpay Dupe Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0C2340 0%, #17375E 100%)',
          color: '#FFFFFF',
          padding: '1.25rem 1.5rem',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              cursor: isProcessing ? 'not-allowed' : 'pointer'
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {/* Razorpay Brand Logo Styling */}
            <div style={{
              background: '#0D83FF',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}>
              RAZORPAY
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.5px' }}>
              TEST MODE
            </span>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0 2px' }}>
            Mithai Mahal Delivery
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#CBD5E1', margin: 0 }}>
            Order #{orderNumber} &bull; Key: <code style={{ color: '#93C5FD' }}>{keyId}</code>
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: '1.25rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)'
          }}>
            <span style={{ fontSize: '0.84rem', color: '#94A3B8' }}>Amount to Pay</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38BDF8' }}>
              ₹{Number(amount).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Methods Sidebar / Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', minHeight: '260px' }}>
          {/* Method Selector */}
          <div style={{ background: '#F8FAFC', borderRight: '1px solid #E2E8F0', padding: '0.75rem 0' }}>
            {[
              { id: 'UPI', label: 'UPI / QR', icon: <Smartphone size={16} /> },
              { id: 'CARD', label: 'Cards', icon: <CreditCard size={16} /> },
              { id: 'NETBANKING', label: 'Netbanking', icon: <Building2 size={16} /> },
              { id: 'WALLET', label: 'Wallet', icon: <Wallet size={16} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  border: 'none',
                  background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                  color: activeTab === tab.id ? '#0284C7' : '#64748B',
                  borderLeft: activeTab === tab.id ? '3px solid #0284C7' : '3px solid transparent',
                  cursor: 'pointer'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Method Content */}
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            {activeTab === 'UPI' && (
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>
                  Pay via Instant UPI ID
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  {[
                    { id: 'gpay', label: 'Google Pay' },
                    { id: 'phonepe', label: 'PhonePe' },
                    { id: 'paytm', label: 'Paytm' }
                  ].map((app) => (
                    <button
                      key={app.id}
                      onClick={() => setSelectedUpiApp(app.id)}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: selectedUpiApp === app.id ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
                        background: selectedUpiApp === app.id ? '#F0F9FF' : '#FFFFFF',
                        color: selectedUpiApp === app.id ? '#0284C7' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {app.label}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Virtual Payment Address (VPA)
                </label>
                <input
                  type="text"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            )}

            {activeTab === 'CARD' && (
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>
                  Card Details (Test Mode Demo)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>Valid Thru</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748B' }}>CVV</label>
                      <input
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'NETBANKING' && (
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>
                  Select Bank
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank'].map((b) => (
                    <div
                      key={b}
                      style={{
                        padding: '0.55rem',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#334155',
                        textAlign: 'center',
                        background: '#F8FAFC'
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'WALLET' && (
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>
                  Digital Wallets
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem', color: '#475569' }}>
                  <div>&bull; Paytm Wallet &bull; ₹2,450.00 Balance</div>
                  <div>&bull; Amazon Pay &bull; Linked</div>
                </div>
              </div>
            )}

            {/* Test Security Note */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.72rem',
              color: '#64748B',
              marginTop: '1rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #F1F5F9'
            }}>
              <Lock size={12} color="#0D83FF" />
              <span>Razorpay Secured (Sandboxed Simulation)</span>
            </div>
          </div>
        </div>

        {/* Modal Footer with Authorization CTA */}
        <div style={{
          background: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: '0.6rem 1rem',
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#475569',
              cursor: isProcessing ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleAuthorize}
            disabled={isProcessing}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0.75rem 1.25rem',
              background: isProcessing ? '#94A3B8' : '#0D83FF',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px -1px rgba(13, 131, 255, 0.3)'
            }}
          >
            <span>{isProcessing ? 'Verifying with Gateway...' : `Pay ₹${Number(amount).toFixed(2)}`}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
