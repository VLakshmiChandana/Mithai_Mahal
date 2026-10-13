import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Store, Search, Filter, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as shopsApi from '../api/shops.api';
import ShopCard from '../components/catalog/ShopCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function ShopListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('search') || '';

  const [shops, setShops] = useState([]);
  const [filterQuery, setFilterQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadShops = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await shopsApi.listPublicShops();
      if (res.success) {
        // Ensure unique shop entries by ID
        const uniqueShops = [];
        const seenIds = new Set();
        for (const s of (res.data || [])) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            uniqueShops.push(s);
          }
        }
        setShops(uniqueShops);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load sweet shops list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  const filteredShops = shops.filter((s) =>
    (s.business_name || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container">
        {(user?.role === 'SELLER' || user?.userType === 'SELLER') && (
          <div style={{
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#166534' }}>
              <LayoutDashboard size={20} />
              <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                Logged in as Sweet Shop Vendor ({user?.name || user?.businessName || 'Seller'}). Manage your products and inventory here:
              </span>
            </div>
            <Link
              to="/seller/dashboard"
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}
            >
              Open Seller Dashboard
            </Link>
          </div>
        )}

        {/* Title Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>
              Sweet Shops & Vendors
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Select a sweet shop to browse their fresh kitchen menu and place your order.
            </p>
          </div>

          {/* Search filter input */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <input
              type="text"
              placeholder="Search by shop name..."
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setSearchParams(e.target.value ? { search: e.target.value } : {});
              }}
              style={{
                paddingLeft: '2.4rem',
                borderRadius: 'var(--radius-pill)',
                background: '#FFFFFF'
              }}
            />
            <Search size={18} color="var(--text-muted)" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)'
            }} />
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Loading sweet shops..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadShops} />
        ) : filteredShops.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Store size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--maroon-primary)' }}>No sweet shops found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              We couldn't find any sweet shops matching "{filterQuery}".
            </p>
            <button onClick={() => setFilterQuery('')} className="btn btn-outline btn-sm">
              Clear Search Filter
            </button>
          </div>
        ) : (
          <div className="grid-shops">
            {filteredShops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
