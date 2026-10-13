import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as shopsApi from '../api/shops.api';
import { Store, User, Mail, Lock, Phone, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AuthPage({ initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const { login, register, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  useEffect(() => {
    // Load active sweet shops for registration selection
    async function fetchShops() {
      try {
        const res = await shopsApi.listPublicShops();
        if (res.success && res.data.length > 0) {
          setShops(res.data);
          setSelectedShopId(res.data[0].id);
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchShops();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isLogin) {
      if (!email.trim() || !password) {
        setErrorMsg('Please enter both email and password.');
        return;
      }

      const res = await login({
        email: email.trim(),
        password,
        sellerId: selectedShopId || undefined
      });

      if (res.success) {
        const loggedUser = res.user;
        const role = loggedUser?.role || loggedUser?.userType;
        let destination = location.state?.from?.pathname;

        if (role === 'SELLER') {
          // If seller arrived with a generic customer path or login path, always route to seller dashboard
          if (!destination || destination === '/login' || destination === '/' || destination === '/shops' || destination === '/cart' || destination === '/orders') {
            destination = '/seller/dashboard';
          }
        } else if (role === 'SUPER_ADMIN') {
          if (!destination || destination === '/login' || destination === '/') {
            destination = '/super-admin/dashboard';
          }
        } else if (role === 'ADMIN') {
          if (!destination || destination === '/login' || destination === '/') {
            destination = '/admin/dashboard';
          }
        } else {
          if (!destination || destination === '/login' || destination === '/') {
            destination = '/shops';
          }
        }
        navigate(destination, { replace: true });
      } else {
        setErrorMsg(res.error);
      }
    } else {
      // Registration
      if (!selectedShopId) {
        setErrorMsg('Please select a sweet shop to register under.');
        return;
      }
      if (!firstName.trim()) {
        setErrorMsg('First name is required.');
        return;
      }
      if (!email.trim() || !password) {
        setErrorMsg('Email and password are required.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters.');
        return;
      }

      const res = await register({
        sellerId: selectedShopId,
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined
      });

      if (res.success) {
        const destination = location.state?.from?.pathname || '/shops';
        navigate(destination, { replace: true });
      } else {
        setErrorMsg(res.error);
      }
    }
  };

  return (
    <div style={{
      padding: '4rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '75vh'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        border: '1px solid var(--border-subtle)',
        maxWidth: '480px',
        width: '100%',
        padding: '2.5rem 2rem'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: '0.4rem' }}>🍬</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--maroon-primary)', fontFamily: 'var(--font-serif)' }}>
            {isLogin ? 'Sign in to Mithai Mahal' : 'Create Customer Account'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
            {isLogin
              ? 'Access your saved addresses, sweet cart, and orders.'
              : 'Join to order fresh handcrafted sweets from certified vendors.'}
          </p>
        </div>

        {/* Tab switch */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-cream)',
          borderRadius: 'var(--radius-pill)',
          padding: '4px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 600,
              fontSize: '0.88rem',
              background: isLogin ? '#FFFFFF' : 'transparent',
              color: isLogin ? 'var(--maroon-primary)' : 'var(--text-muted)',
              boxShadow: isLogin ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 600,
              fontSize: '0.88rem',
              background: !isLogin ? '#FFFFFF' : 'transparent',
              color: !isLogin ? 'var(--maroon-primary)' : 'var(--text-muted)',
              boxShadow: !isLogin ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            Register
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '1px solid #F5B7B1',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            lineHeight: 1.4
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Sweet Shop Selection (Required for Customer Registration) */}
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Primary Sweet Shop Vendor *
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  required
                  style={{ paddingLeft: '2.2rem' }}
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.business_name}
                    </option>
                  ))}
                </select>
                <Store size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Customer accounts are isolated to a certified sweet shop. You can browse all shops anytime.
              </p>
            </div>
          )}

          {/* First & Last Name for Registration */}
          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  placeholder="Aarav"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="Sharma"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Email Address *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '2.2rem' }}
              />
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* Phone (Registration optional) */}
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ paddingLeft: '2.2rem' }}
                />
                <Phone size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '2.2rem' }}
              />
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.5rem' }}
          >
            <span>{isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <ShieldCheck size={16} color="var(--veg-green)" />
          <span>Encrypted Authentication & Session Rotation</span>
        </div>
      </div>
    </div>
  );
}
