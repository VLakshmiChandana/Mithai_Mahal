import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as sellerApi from '../api/seller.api';
import { useToast } from '../context/ToastContext';
import { Store, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function SellerRegisterPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    businessName: '',
    legalName: '',
    businessType: 'PROPRIETORSHIP',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    shopAddress: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    fssaiNumber: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.businessName.trim()) {
      setErrorMsg('Sweet Shop / Business Name is required.');
      return;
    }
    if (!formData.email.trim() || !formData.password) {
      setErrorMsg('Email and Password are required.');
      return;
    }
    if (formData.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg('Phone number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        businessName: formData.businessName.trim(),
        legalName: formData.legalName.trim() || formData.businessName.trim(),
        businessType: formData.businessType,
        ownerName: formData.ownerName.trim() || undefined,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        shopAddress: formData.shopAddress.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        pincode: formData.pincode.trim() || undefined,
        gstin: formData.gstin.trim() ? formData.gstin.trim().toUpperCase() : undefined,
        fssaiNumber: formData.fssaiNumber.trim() || undefined
      };

      const res = await sellerApi.registerSeller(payload);
      setSuccessData(res.data);
      showToast('Sweet shop registered! Your application is in pending review.', 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successData) {
    return (
      <div className="container" style={{ maxWidth: '640px', padding: '3rem 1rem' }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '2.5rem',
          textAlign: 'center',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#16a34a'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-primary)', marginBottom: '0.75rem' }}>
            Application Submitted!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Welcome, <strong>{successData.business_name}</strong>! Your sweet shop vendor registration has been safely received.
            Your verification status is currently <strong>PENDING</strong>.
          </p>

          <div style={{
            background: 'var(--bg-cream)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'left',
            marginBottom: '2rem',
            border: '1px solid var(--border-subtle)'
          }}>
            <p style={{ fontSize: '0.88rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              <strong>Next Steps:</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <li>Sign in using your seller email and password.</li>
              <li>Upload your FSSAI certificate, GST document, and business proof in your Seller Portal.</li>
              <li>Once our platform Admin reviews and approves your documents, your shop will go live and start accepting orders!</li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '780px', padding: '2.5rem 1rem' }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: '2.5rem',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            background: 'var(--maroon-subtle)',
            color: 'var(--maroon-primary)',
            padding: '0.6rem',
            borderRadius: 'var(--radius-md)'
          }}>
            <Store size={26} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-primary)', fontSize: '1.75rem', margin: 0 }}>
              Partner With Mithai Mahal
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
              Register your sweet shop to reach thousands of dessert lovers
            </p>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '1.5rem 0' }} />

        {errorMsg && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            color: '#B91C1C',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', marginBottom: '1rem' }}>
            1. Sweet Shop & Owner Details
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Sweet Shop / Brand Name *
              </label>
              <input
                type="text"
                name="businessName"
                placeholder="e.g. Royal Sweets & Mithai"
                value={formData.businessName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Owner Full Name
              </label>
              <input
                type="text"
                name="ownerName"
                placeholder="e.g. Rajesh Kumar"
                value={formData.ownerName}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Email Address (Login) *
              </label>
              <input
                type="email"
                name="email"
                placeholder="owner@sweets.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Contact Phone / WhatsApp *
              </label>
              <input
                type="tel"
                name="phone"
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Account Password *
              </label>
              <input
                type="password"
                name="password"
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Business Entity Type
              </label>
              <select name="businessType" value={formData.businessType} onChange={handleChange}>
                <option value="PROPRIETORSHIP">Proprietorship</option>
                <option value="PARTNERSHIP">Partnership</option>
                <option value="PVT_LTD">Private Limited</option>
                <option value="LLP">LLP</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', margin: '1.5rem 0 1rem 0' }}>
            2. Shop Address & Location
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Shop Street Address
              </label>
              <input
                type="text"
                name="shopAddress"
                placeholder="Shop 12, Main Bazaar Road"
                value={formData.shopAddress}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                City
              </label>
              <input
                type="text"
                name="city"
                placeholder="e.g. Mumbai, Delhi, Jaipur"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                State
              </label>
              <input
                type="text"
                name="state"
                placeholder="e.g. Maharashtra"
                value={formData.state}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                PIN Code (6 digits)
              </label>
              <input
                type="text"
                name="pincode"
                maxLength={6}
                placeholder="400001"
                value={formData.pincode}
                onChange={handleChange}
              />
            </div>
          </div>

          <h3 style={{ fontSize: '1.1rem', color: 'var(--maroon-primary)', margin: '1.5rem 0 1rem 0' }}>
            3. Regulatory & Food Safety Numbers
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                FSSAI License / Registration No. (14 digits)
              </label>
              <input
                type="text"
                name="fssaiNumber"
                maxLength={14}
                placeholder="10020000000000"
                value={formData.fssaiNumber}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                GSTIN (15 characters)
              </label>
              <input
                type="text"
                name="gstin"
                maxLength={15}
                placeholder="27ABCDE1234F1Z5"
                value={formData.gstin}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>{isSubmitting ? 'Submitting Registration...' : 'Submit Sweet Shop Registration'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Already registered as a sweet vendor?{' '}
          <Link to="/login" style={{ color: 'var(--maroon-primary)', fontWeight: 600 }}>
            Sign In to Seller Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
