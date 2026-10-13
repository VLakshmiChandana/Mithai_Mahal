import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Sparkles, ArrowRight, ShieldCheck, Clock, Award, ShoppingBag } from 'lucide-react';
import * as shopsApi from '../api/shops.api';
import * as catalogApi from '../api/catalog.api';
import ShopCard from '../components/catalog/ShopCard';
import ProductCard from '../components/catalog/ProductCard';
import ProductDetailModal from '../components/catalog/ProductDetailModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function HomePage() {
  const [shops, setShops] = useState([]);
  const [popularSweets, setPopularSweets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [shopsRes, prodsRes] = await Promise.all([
        shopsApi.listPublicShops(),
        catalogApi.listProducts({ limit: 8, sortBy: 'name', sortOrder: 'asc' })
      ]);

      if (shopsRes.success) {
        const uniqueShops = [];
        const seenIds = new Set();
        for (const s of (shopsRes.data || [])) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            uniqueShops.push(s);
          }
        }
        setShops(uniqueShops);
      }
      if (prodsRes.success) setPopularSweets(prodsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load sweets catalog.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return <LoadingSpinner text="Fetching fresh sweet shops & sweets..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div>
      {/* Hero Heritage Banner */}
      <section style={{
        background: 'linear-gradient(135deg, #7A1C1C 0%, #4A0E0E 100%)',
        color: '#FFFFFF',
        padding: '4.5rem 0 4rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative motif overlay */}
        <div style={{
          position: 'absolute',
          right: '-50px',
          top: '-50px',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '680px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(212, 175, 55, 0.2)',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              color: 'var(--saffron-light)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '1.25rem'
            }}>
              <Sparkles size={16} />
              <span>Pure Desi Ghee & Handcrafted Sweets</span>
            </div>

            <h1 style={{
              fontSize: '2.8rem',
              color: '#FFFFFF',
              marginBottom: '1.2rem',
              lineHeight: 1.15
            }}>
              Authentic Indian Sweets Delivered Fresh To Your Doorstep.
            </h1>

            <p style={{
              fontSize: '1.1rem',
              color: '#F4ECE1',
              lineHeight: 1.6,
              marginBottom: '2rem'
            }}>
              Explore India's finest sweet shops in one place. Fresh Motichoor Laddus, melt-in-mouth Kaju Katli, 
              soft spongy Rasgullas, and royal Mysore Pak crafted by traditional halwais.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/shops" className="btn btn-secondary btn-lg" style={{ background: 'var(--saffron-primary)', color: '#FFFFFF' }}>
                <Store size={20} />
                <span>Explore Sweet Shops</span>
              </Link>
              <Link to="/shops" className="btn btn-outline btn-lg" style={{ borderColor: '#FFFFFF', color: '#FFFFFF' }}>
                <span>Browse All Sweets</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Quality Pillars */}
      <section style={{
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '2rem 0'
      }}>
        <div className="container">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ padding: '0.75rem' }}>
              <ShieldCheck size={32} color="var(--maroon-primary)" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>Curated Sweet Shops</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Selected artisanal sweet vendors with pure ingredients</p>
            </div>
            <div style={{ padding: '0.75rem' }}>
              <Clock size={32} color="var(--maroon-primary)" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>Fresh Daily Dispatch</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Prepared fresh daily & securely packaged</p>
            </div>
            <div style={{ padding: '0.75rem' }}>
              <Award size={32} color="var(--maroon-primary)" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>Single Shop Assurance</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Each order sourced from one shop for uncompromised taste</p>
            </div>
            <div style={{ padding: '0.75rem' }}>
              <Sparkles size={32} color="var(--maroon-primary)" style={{ margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>Pure Cow Desi Ghee</h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Authentic time-honored traditional recipes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Sweet Shops */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span style={{
                color: 'var(--saffron-primary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Curated Vendors
              </span>
              <h2 style={{ fontSize: '2.1rem', marginTop: '0.2rem' }}>
                Featured Sweet Shops
              </h2>
            </div>
            <Link to="/shops" className="btn btn-outline btn-sm">
              <span>View All Shops ({shops.length})</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {shops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#FFFFFF', borderRadius: 'var(--radius-md)' }}>
              <p style={{ color: 'var(--text-muted)' }}>No active sweet shops available right now.</p>
            </div>
          ) : (
            <div className="grid-shops">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Delicacies Grid */}
      <section style={{ padding: '0 0 5rem' }}>
        <div className="container">
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span style={{
                color: 'var(--saffron-primary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Handcrafted Favorites
              </span>
              <h2 style={{ fontSize: '2.1rem', marginTop: '0.2rem' }}>
                Popular Sweets
              </h2>
            </div>
          </div>

          <div className="grid-products">
            {popularSweets.map((sweet) => (
              <ProductCard
                key={sweet.id}
                product={sweet}
                onViewDetails={(prod) => setSelectedProduct(prod)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Sweet Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
