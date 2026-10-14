import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, CheckCircle, ArrowRight, Phone } from 'lucide-react';
import { getMediaUrl } from '../../utils/imageUrl';

const FALLBACK_SHOP_IMAGE = '/sweets/shop-storefront.svg';

export default function ShopCard({ shop }) {
  const { id, business_name, phone, logo, profile_photo } = shop;
  const initialImage = getMediaUrl(logo || profile_photo) || FALLBACK_SHOP_IMAGE;
  const [imgSrc, setImgSrc] = useState(initialImage);
  const [imgFailed, setImgFailed] = useState(false);

  const handleImageError = () => {
    if (imgSrc !== FALLBACK_SHOP_IMAGE) {
      setImgSrc(FALLBACK_SHOP_IMAGE);
    } else {
      setImgFailed(true);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'relative',
        height: '180px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #7A1C1C 0%, #4A0012 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!imgFailed ? (
          <img
            src={imgSrc}
            alt={business_name}
            onError={handleImageError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease'
            }}
            onMouseEnter={(e) => { e.target.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.target.style.transform = 'scale(1)'; }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--saffron-light)',
            gap: '8px'
          }}>
            <Store size={44} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF', letterSpacing: '0.5px' }}>
              Mithai Mahal Vendor
            </span>
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-pill)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.74rem',
          fontWeight: 700,
          color: 'var(--maroon-primary)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}>
          <CheckCircle size={14} color="var(--veg-green)" />
          <span>DEMO SWEET SHOP</span>
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{
          fontSize: '1.25rem',
          marginBottom: '0.4rem',
          color: 'var(--maroon-primary)'
        }}>
          {business_name}
        </h3>

        {shop.city && (
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: '0.5rem',
            fontWeight: 500
          }}>
            📍 {shop.city}{shop.state ? `, ${shop.state}` : ''}
          </p>
        )}

        {phone && (
          <p style={{
            fontSize: '0.84rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '1rem'
          }}>
            <Phone size={14} />
            <span>{phone}</span>
          </p>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '0.8rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Link
            to={`/shops/${id}`}
            className="btn btn-outline btn-sm"
            style={{ width: '100%', justifyContent: 'space-between' }}
          >
            <span>View Sweets Menu</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
