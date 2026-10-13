import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart, Sparkles, MapPin, Phone, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--maroon-dark)',
      color: '#FDFBF7',
      padding: '3.5rem 0 1.5rem',
      marginTop: 'auto',
      borderTop: '3px solid var(--saffron-primary)'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '2.5rem',
          marginBottom: '2.5rem'
        }}>
          {/* Brand & Guarantee */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🍬</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', fontWeight: 700, color: '#FFFFFF' }}>
                Mithai Mahal
              </span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#E4D5CA', lineHeight: 1.6, marginBottom: '1.2rem' }}>
              Handcrafted traditional Indian sweets sourced directly from certified heritage sweet shops. 
              Pure desi ghee, no preservatives, delivered fresh in temperature-controlled packaging.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--saffron-light)' }}>
              <ShieldCheck size={18} color="var(--saffron-gold)" />
              <span>100% Certified Sweet Shops & FSSAI Standards</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{ color: 'var(--saffron-light)', fontSize: '1.05rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>
              Explore Sweets
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
              <li><Link to="/shops" style={{ color: '#E4D5CA' }}>All Sweet Shops</Link></li>
              <li><Link to="/shops?category=laddus" style={{ color: '#E4D5CA' }}>Laddus & Pedas</Link></li>
              <li><Link to="/shops?category=katlis" style={{ color: '#E4D5CA' }}>Kaju Katlis & Barfis</Link></li>
              <li><Link to="/shops?category=bengali" style={{ color: '#E4D5CA' }}>Bengali Sweets (Rasgulla, Cham Cham)</Link></li>
              <li><Link to="/shops?category=ghee" style={{ color: '#E4D5CA' }}>Pure Ghee Delicacies</Link></li>
            </ul>
          </div>

          {/* Customer Support & Policies */}
          <div>
            <h4 style={{ color: 'var(--saffron-light)', fontSize: '1.05rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>
              Customer Care
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
              <li><Link to="/support" style={{ color: '#E4D5CA' }}>Open Support Ticket</Link></li>
              <li><Link to="/orders" style={{ color: '#E4D5CA' }}>Order Tracking & History</Link></li>
              <li><Link to="/addresses" style={{ color: '#E4D5CA' }}>Delivery Addresses</Link></li>
              <li style={{ color: '#C8B5A7', fontSize: '0.84rem', marginTop: '0.5rem' }}>
                Single Sweet Shop Delivery Rule: To guarantee maximum freshness and single-point dispatch, each order is fulfilled from one sweet vendor.
              </li>
            </ul>
          </div>

          {/* Platform Environment Notice */}
          <div>
            <h4 style={{ color: 'var(--saffron-light)', fontSize: '1.05rem', marginBottom: '1rem', fontFamily: 'var(--font-serif)' }}>
              Platform Status
            </h4>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <p style={{ fontSize: '0.82rem', color: '#E4D5CA', marginBottom: '0.5rem' }}>
                <strong style={{ color: '#FFFFFF' }}>Dev / Demo Mode:</strong> Connected to local Express backend on port 5000.
              </p>
              <p style={{ fontSize: '0.78rem', color: '#C8B5A7' }}>
                Payment processing runs via a documented mock provider gateway. GPS location breadcrumbs are simulated.
              </p>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          paddingTop: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          color: '#C8B5A7',
          gap: '1rem'
        }}>
          <div>
            &copy; {new Date().getFullYear()} Mithai Mahal. Developed for the Sweet Shop Delivery Platform.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Crafted with</span>
            <Heart size={14} color="var(--saffron-primary)" fill="var(--saffron-primary)" />
            <span>for authentic Indian sweet lovers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
