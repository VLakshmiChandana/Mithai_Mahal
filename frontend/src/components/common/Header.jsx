import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Store, Search, HelpCircle, Package, Menu, X, Shield, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount, cart } = useCart();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shops?search=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <header style={{
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.9rem 1.25rem',
        gap: '1.5rem'
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--maroon-primary) 0%, var(--saffron-primary) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '1.4rem',
            boxShadow: '0 2px 8px rgba(122, 28, 28, 0.2)'
          }}>
            🍬
          </div>
          <div>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.45rem',
              fontWeight: 800,
              color: 'var(--maroon-primary)',
              letterSpacing: '-0.3px',
              display: 'block',
              lineHeight: 1.1
            }}>
              Mithai Mahal
            </span>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--saffron-primary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.8px'
            }}>
              Fresh Sweet Delivery
            </span>
          </div>
        </Link>

        {/* Global Search Bar */}
        <form onSubmit={handleSearch} style={{
          flex: 1,
          maxWidth: '460px',
          position: 'relative',
          display: 'none' // Handled via CSS media query below
        }} className="desktop-search">
          <input
            type="text"
            placeholder="Search sweets (e.g. Kaju Katli, Rasgulla, Motichoor)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '2.5rem',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-cream)',
              borderColor: 'var(--border-subtle)'
            }}
          />
          <Search size={18} color="var(--text-muted)" style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)'
          }} />
        </form>

        {/* Desktop Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }} className="desktop-nav">
          <Link to="/shops" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            color: 'var(--text-secondary)'
          }}>
            <Store size={18} color="var(--maroon-primary)" />
            <span>Sweet Shops</span>
          </Link>

          {isAuthenticated && (
            <>
              <Link to="/orders" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                fontSize: '0.92rem',
                color: 'var(--text-secondary)'
              }}>
                <Package size={18} color="var(--maroon-primary)" />
                <span>My Orders</span>
              </Link>
              <Link to="/support" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                fontSize: '0.92rem',
                color: 'var(--text-secondary)'
              }}>
                <HelpCircle size={18} color="var(--maroon-primary)" />
                <span>Support</span>
              </Link>

              {(user?.role === 'SELLER' || user?.userType === 'SELLER') && (
                <Link to="/seller/dashboard" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--maroon-primary)'
                }}>
                  <LayoutDashboard size={18} color="var(--maroon-primary)" />
                  <span>Seller Portal</span>
                </Link>
              )}

              {(user?.role === 'SUPER_ADMIN' || user?.userType === 'SUPER_ADMIN') && (
                <Link to="/super-admin/dashboard" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--maroon-primary)'
                }}>
                  <ShieldCheck size={18} color="var(--maroon-primary)" />
                  <span>Control Center</span>
                </Link>
              )}

              {(user?.role === 'ADMIN' || user?.userType === 'ADMIN') && (
                <Link to="/admin/dashboard" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  color: 'var(--maroon-primary)'
                }}>
                  <Shield size={18} color="var(--maroon-primary)" />
                  <span>Operations</span>
                </Link>
              )}
            </>
          )}

          {/* Cart Pill */}
          <Link to="/cart" className="btn btn-outline btn-sm" style={{
            position: 'relative',
            borderRadius: 'var(--radius-pill)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderColor: itemCount > 0 ? 'var(--maroon-primary)' : 'var(--border-subtle)',
            background: itemCount > 0 ? 'var(--maroon-subtle)' : 'transparent'
          }}>
            <ShoppingBag size={18} color="var(--maroon-primary)" />
            <span style={{ fontWeight: 600 }}>Cart</span>
            {itemCount > 0 && (
              <span style={{
                background: 'var(--maroon-primary)',
                color: '#FFFFFF',
                borderRadius: '50%',
                padding: '2px 7px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                {itemCount}
              </span>
            )}
          </Link>

          {/* Authentication State Buttons */}
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-cream)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: 'var(--maroon-primary)'
                }}
              >
                <User size={16} />
                <span>{user?.name || user?.businessName || user?.firstName || user?.email?.split('@')[0]}</span>
              </button>

              {profileDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  border: '1px solid var(--border-subtle)',
                  minWidth: '200px',
                  padding: '0.5rem 0',
                  zIndex: 200
                }}>
                  <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>
                      {user?.name || user?.businessName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>{user?.email}</p>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      marginTop: '0.35rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--bg-cream)',
                      color: 'var(--maroon-primary)'
                    }}>
                      Role: {user?.role || user?.userType}
                    </span>
                  </div>
                  <Link
                    to="/addresses"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: 'block',
                      padding: '0.6rem 1rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Saved Addresses
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: 'block',
                      padding: '0.6rem 1rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    My Orders
                  </Link>
                  <Link
                    to="/support"
                    onClick={() => setProfileDropdownOpen(false)}
                    style={{
                      display: 'block',
                      padding: '0.6rem 1rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Help & Support
                  </Link>
                  {/* Role-specific links */}
                  {(user?.userType === 'SELLER' || user?.role === 'SELLER') && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.3rem 0' }}></div>
                      <Link
                        to="/seller/dashboard"
                        onClick={() => setProfileDropdownOpen(false)}
                        style={{
                          display: 'block',
                          padding: '0.6rem 1rem',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: 'var(--maroon-primary)'
                        }}
                      >
                        Seller Dashboard
                      </Link>
                      <Link
                        to="/seller/verification"
                        onClick={() => setProfileDropdownOpen(false)}
                        style={{
                          display: 'block',
                          padding: '0.6rem 1rem',
                          fontSize: '0.88rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        Verification & Documents
                      </Link>
                    </>
                  )}

                  {(user?.userType === 'SUPER_ADMIN' || user?.userType === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.3rem 0' }}></div>
                      {(user?.userType === 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN') ? (
                        <>
                          <Link
                            to="/super-admin/dashboard"
                            onClick={() => setProfileDropdownOpen(false)}
                            style={{
                              display: 'block',
                              padding: '0.6rem 1rem',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              color: 'var(--maroon-primary)'
                            }}
                          >
                            Super Admin Control Center
                          </Link>
                          <Link
                            to="/admin/dashboard"
                            onClick={() => setProfileDropdownOpen(false)}
                            style={{
                              display: 'block',
                              padding: '0.6rem 1rem',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: 'var(--text-secondary)'
                            }}
                          >
                            Operations Dashboard
                          </Link>
                        </>
                      ) : (
                        <Link
                          to="/admin/dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          style={{
                            display: 'block',
                            padding: '0.6rem 1rem',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: 'var(--maroon-primary)'
                          }}
                        >
                          Operations Dashboard
                        </Link>
                      )}
                      <Link
                        to="/admin/sellers"
                        onClick={() => setProfileDropdownOpen(false)}
                        style={{
                          display: 'block',
                          padding: '0.6rem 1rem',
                          fontSize: '0.88rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        Seller Compliance & KYC
                      </Link>
                    </>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.3rem 0' }}></div>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.6rem 1rem',
                      fontSize: '0.88rem',
                      color: 'var(--danger)',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Link to="/seller/register" style={{ fontSize: '0.85rem', color: 'var(--maroon-primary)', fontWeight: 600, marginRight: '0.25rem' }}>
                Partner With Us
              </Link>
              <Link to="/login" className="btn btn-outline btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ display: 'none', color: 'var(--maroon-primary)' }}
          className="mobile-toggle"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      <style>{`
        @media (min-width: 769px) {
          .desktop-search { display: block !important; }
          .desktop-nav { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-search { display: none !important; }
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
      `}</style>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          background: '#FFFFFF',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <form onSubmit={handleSearch} style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search sweets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '2.5rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-cream)'
              }}
            />
            <Search size={18} color="var(--text-muted)" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)'
            }} />
          </form>

          <Link to="/shops" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
            <Store size={18} color="var(--maroon-primary)" />
            <span>Browse Sweet Shops</span>
          </Link>
          <Link to="/cart" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
            <ShoppingBag size={18} color="var(--maroon-primary)" />
            <span>Shopping Cart ({itemCount})</span>
          </Link>

          {isAuthenticated ? (
            <>
              {(user?.role === 'SELLER' || user?.userType === 'SELLER') && (
                <Link to="/seller/dashboard" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: 'var(--maroon-primary)' }}>
                  <LayoutDashboard size={18} color="var(--maroon-primary)" />
                  <span>Seller Portal (Manage Sweets)</span>
                </Link>
              )}
              <Link to="/orders" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                <Package size={18} color="var(--maroon-primary)" />
                <span>My Orders</span>
              </Link>
              <Link to="/addresses" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                <User size={18} color="var(--maroon-primary)" />
                <span>Saved Addresses</span>
              </Link>
              <Link to="/support" onClick={() => setMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                <HelpCircle size={18} color="var(--maroon-primary)" />
                <span>Help & Support</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  color: 'var(--danger)',
                  fontWeight: 600,
                  padding: '0.5rem 0'
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Sign In
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ flex: 1 }}>
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
