import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, Phone, CheckCircle, Search, ArrowLeft, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as shopsApi from '../api/shops.api';
import * as catalogApi from '../api/catalog.api';
import ProductCard from '../components/catalog/ProductCard';
import ProductDetailModal from '../components/catalog/ProductDetailModal';
import CategoryPills from '../components/catalog/CategoryPills';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

const FALLBACK_BANNER = '/sweets/shop-storefront.svg';

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const { user } = useAuth();

  const [shop, setShop] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadShopData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [shopRes, catsRes, prodsRes] = await Promise.all([
        shopsApi.getPublicShop(shopId),
        catalogApi.listCategories({ sellerId: shopId }),
        catalogApi.listProducts({
          sellerId: shopId,
          categoryId: selectedCategory || undefined,
          search: searchQuery.trim() || undefined
        })
      ]);

      if (shopRes.success) setShop(shopRes.data);
      if (catsRes.success) {
        const catList = Array.isArray(catsRes.data) ? catsRes.data : (catsRes.data?.items || []);
        setCategories(catList);
      }
      if (prodsRes.success) {
        const prodList = Array.isArray(prodsRes.data) ? prodsRes.data : (prodsRes.data?.items || []);
        setProducts(prodList);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load sweet shop details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShopData();
  }, [shopId, selectedCategory]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await catalogApi.listProducts({
        sellerId: shopId,
        categoryId: selectedCategory || undefined,
        search: searchQuery.trim() || undefined
      });
      if (res.success) {
        const prodList = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setProducts(prodList);
      }
    } catch (err) {
      setError('Search query failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !shop) {
    return <LoadingSpinner text="Loading sweet shop menu..." />;
  }

  if (error && !shop) {
    return <ErrorState message={error} onRetry={loadShopData} />;
  }

  return (
    <div style={{ paddingBottom: '5rem' }}>
      {/* Shop Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--maroon-primary) 0%, var(--maroon-dark) 100%)',
        color: '#FFFFFF',
        padding: '3rem 0 2.5rem'
      }}>
        <div className="container">
          <Link to="/shops" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--saffron-light)',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '1.25rem'
          }}>
            <ArrowLeft size={16} />
            <span>Back to All Shops</span>
          </Link>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              {shop?.logo ? (
                <img
                  src={shop.logo}
                  alt={shop.business_name}
                  onError={(e) => { e.target.style.display = 'none'; }}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.4)',
                    background: '#FFFFFF',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                />
              ) : (
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--saffron-light)',
                  border: '1px solid rgba(255,255,255,0.25)'
                }}>
                  <Store size={36} />
                </div>
              )}
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.15)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--saffron-light)',
                  marginBottom: '0.5rem'
                }}>
                  <CheckCircle size={14} />
                  <span>DEMO SWEET VENDOR</span>
                </div>
                <h1 style={{ fontSize: '2.4rem', color: '#FFFFFF', margin: '0 0 0.5rem 0' }}>
                  {shop?.business_name}
                </h1>
                {shop?.phone && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#E4D5CA', fontSize: '0.9rem', margin: 0 }}>
                    <Phone size={15} />
                    <span>{shop.phone}</span>
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
              {(user?.role === 'SELLER' || user?.userType === 'SELLER') && (user?.id === shopId || user?.sellerId === shopId) && (
                <Link
                  to="/seller/dashboard"
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    padding: '0.55rem 1rem',
                    background: '#FFFFFF',
                    color: 'var(--maroon-primary)'
                  }}
                >
                  <Settings size={16} />
                  <span>Manage Shop & Add Sweets</span>
                </Link>
              )}

              <div style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                maxWidth: '300px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--saffron-light)', marginBottom: '0.3rem', fontSize: '0.88rem', fontWeight: 600 }}>
                  <ShieldCheck size={18} />
                  <span>Single-Shop Freshness</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#F4ECE1', lineHeight: 1.4, margin: 0 }}>
                  Sweets are prepared and dispatched directly from this shop counter.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Section */}
      <div className="container" style={{ marginTop: '2.5rem' }}>
        {/* Search & Category Filter Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <h2 style={{ fontSize: '1.6rem', color: 'var(--maroon-primary)' }}>
            Fresh Sweets Menu ({products.length})
          </h2>

          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <input
              type="text"
              placeholder="Search in this menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          </form>
        </div>

        {/* Categories Horizontal Pills */}
        <CategoryPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => setSelectedCategory(catId)}
        />

        {/* Products Grid */}
        {products.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1rem' }}>
              No sweet products match your category or search filter in this shop.
            </p>
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery('');
                loadShopData();
              }}
              className="btn btn-outline btn-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid-products">
            {products.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onViewDetails={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
