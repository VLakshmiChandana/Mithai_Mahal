import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as sellerApi from '../api/seller.api';
import ErrorState from '../components/common/ErrorState';
import { getMediaUrl, FALLBACK_SWEET_IMAGE } from '../utils/imageUrl';
import {
  Package, Plus, Edit2, AlertTriangle, CheckCircle,
  Archive, ShieldAlert, TrendingDown, Layers, ArrowUpDown,
  Image, Upload, Camera, Store, RefreshCw
} from 'lucide-react';

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'inventory' | 'add_product'
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Logo & Product Image Upload States
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingProductImg, setIsUploadingProductImg] = useState(false);

  // Add / Edit Product State
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    categoryId: '',
    price: '',
    stockQuantity: '',
    sku: '',
    weightPackSize: '',
    lowStockThreshold: '5',
    imageUrl: '',
    description: '',
    availabilityStatus: 'AVAILABLE'
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustStockForm, setAdjustStockForm] = useState({
    newQuantity: '',
    reason: 'MANUAL_CORRECTION',
    notes: ''
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [profileRes, productsRes, catsRes] = await Promise.all([
        sellerApi.getSellerProfile(),
        sellerApi.getSellerProducts({ limit: 100 }),
        sellerApi.getSellerCategories()
      ]);
      setProfile(profileRes.data);
      setProducts(productsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to load seller catalog.';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEditClick = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      categoryId: prod.category_id || '',
      price: prod.price,
      stockQuantity: prod.stock_quantity,
      sku: prod.sku || '',
      weightPackSize: prod.weight_pack_size || '',
      lowStockThreshold: prod.low_stock_threshold || '5',
      imageUrl: prod.image_url || '',
      description: prod.description || '',
      availabilityStatus: prod.availability_status || 'AVAILABLE'
    });
    setActiveTab('add_product');
  };

  const handleResetForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      categoryId: '',
      price: '',
      stockQuantity: '',
      sku: '',
      weightPackSize: '',
      lowStockThreshold: '5',
      imageUrl: '',
      description: '',
      availabilityStatus: 'AVAILABLE'
    });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, WebP, SVG).', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB.', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploadingLogo(true);
    try {
      const res = await sellerApi.uploadShopLogo(file);
      if (res.success && res.data?.url) {
        await sellerApi.updateSellerProfile({ logo: res.data.url });
        showToast('Shop storefront logo updated successfully!', 'success');
        await loadData();
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to upload shop logo.';
      showToast(msg, 'error');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, WebP, SVG).', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB.', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploadingProductImg(true);
    try {
      const res = await sellerApi.uploadImage(file, 'product');
      if (res.success && res.data?.url) {
        setProductForm(prev => ({ ...prev, imageUrl: res.data.url }));
        showToast('Product photo uploaded successfully!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to upload product photo.';
      showToast(msg, 'error');
    } finally {
      setIsUploadingProductImg(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price) {
      showToast('Product name and price are required.', 'error');
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        categoryId: productForm.categoryId || undefined,
        price: parseFloat(productForm.price),
        stockQuantity: parseInt(productForm.stockQuantity, 10) || 0,
        sku: productForm.sku.trim() || undefined,
        weightPackSize: productForm.weightPackSize.trim() || undefined,
        lowStockThreshold: parseInt(productForm.lowStockThreshold, 10) || 5,
        imageUrl: productForm.imageUrl.trim() || undefined,
        description: productForm.description.trim() || undefined,
        availabilityStatus: productForm.availabilityStatus
      };

      if (editingProduct) {
        await sellerApi.updateProduct(editingProduct.id, payload);
        showToast('Product updated successfully!', 'success');
      } else {
        await sellerApi.createProduct(payload);
        showToast('Sweet product created and added to catalog!', 'success');
      }

      handleResetForm();
      setActiveTab('products');
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Operation failed.';
      showToast(msg, 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleStockAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    setIsAdjusting(true);
    try {
      await sellerApi.adjustStock(adjustingProduct.id, {
        newQuantity: parseInt(adjustStockForm.newQuantity, 10),
        reason: adjustStockForm.reason,
        notes: adjustStockForm.notes.trim() || undefined
      });

      showToast(`Stock for ${adjustingProduct.name} updated!`, 'success');
      setAdjustingProduct(null);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Stock update failed.';
      showToast(msg, 'error');
    } finally {
      setIsAdjusting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading seller dashboard...</p>
      </div>
    );
  }

  if (loadError && !profile) {
    return (
      <div className="container" style={{ maxWidth: '1100px', padding: '3rem 1rem' }}>
        <ErrorState
          title="Failed to Load Seller Dashboard"
          message={loadError}
          onRetry={loadData}
        />
      </div>
    );
  }

  const isVerified = profile?.verification_status === 'APPROVED';

  return (
    <div className="container" style={{ maxWidth: '1100px', padding: '2rem 1rem' }}>
      {loadError && (
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#991B1B'
        }}>
          <span>{loadError}</span>
          <button onClick={loadData} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', borderColor: '#F87171', color: '#991B1B' }}>
            <RefreshCw size={13} style={{ marginRight: '4px' }} />
            Retry
          </button>
        </div>
      )}

      {/* Header Profile / Verification Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            {profile?.logo ? (
              <img
                src={getMediaUrl(profile.logo)}
                alt={profile.business_name}
                onError={(e) => { e.target.style.display = 'none'; }}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '2px solid var(--border-subtle)',
                  background: 'var(--bg-cream)'
                }}
              />
            ) : (
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                background: 'var(--bg-cream)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--maroon-primary)',
                border: '2px dashed var(--border-subtle)'
              }}>
                <Store size={28} />
              </div>
            )}
            <label
              htmlFor="shop-logo-upload"
              title="Upload / Change Shop Logo"
              style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                background: 'var(--maroon-primary)',
                color: '#FFFFFF',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isUploadingLogo ? 'wait' : 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
              }}
            >
              <Camera size={14} />
              <input
                id="shop-logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
              />
            </label>
          </div>

          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-primary)', fontSize: '1.65rem', margin: 0 }}>
              {profile?.business_name || 'Sweet Shop Vendor'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              {profile?.owner_name ? `Owner: ${profile.owner_name} • ` : ''}
              {profile?.city ? `${profile.city}, ${profile.state || ''} • ` : ''}
              {profile?.email}
            </p>
            {isUploadingLogo && (
              <span style={{ fontSize: '0.75rem', color: 'var(--maroon-primary)', fontWeight: 600 }}>
                Uploading storefront logo...
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            background: isVerified ? '#DCFCE7' : '#FEF3C7',
            color: isVerified ? '#166534' : '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            {isVerified ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>Status: {profile?.verification_status}</span>
          </span>

          {profile?.id && (
            <Link
              to={`/shops/${profile.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Store size={15} />
              <span>View Public Storefront</span>
            </Link>
          )}

          <Link to="/seller/verification" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}>
            Verification Center
          </Link>
        </div>
      </div>

      {!isVerified && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#92400E' }}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>
                Account Awaiting Verification ({profile?.verification_status || 'PENDING'})
              </span>
              <span style={{ fontSize: '0.85rem', color: '#78350F' }}>
                Product publishing is locked until approved. Upload your FSSAI/GST compliance documents to get platform approval.
              </span>
            </div>
          </div>
          <Link to="/seller/verification" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.45rem 0.95rem' }}>
            Verification Center
          </Link>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid var(--border-subtle)',
        marginBottom: '1.75rem',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => { setActiveTab('products'); handleResetForm(); }}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'products' ? '3px solid var(--maroon-primary)' : '3px solid transparent',
            color: activeTab === 'products' ? 'var(--maroon-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'products' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          Sweets Catalog ({products.length})
        </button>

        <button
          onClick={() => { setActiveTab('inventory'); handleResetForm(); }}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '3px solid var(--maroon-primary)' : '3px solid transparent',
            color: activeTab === 'inventory' ? 'var(--maroon-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'inventory' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          Inventory & Stock Adjustments
        </button>

        <button
          onClick={() => {
            if (!isVerified) return;
            setActiveTab('add_product');
            handleResetForm();
          }}
          disabled={!isVerified}
          title={!isVerified ? 'Verification required to add sweets' : ''}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'add_product' ? '3px solid var(--maroon-primary)' : '3px solid transparent',
            color: !isVerified ? 'var(--text-muted)' : (activeTab === 'add_product' ? 'var(--maroon-primary)' : 'var(--text-secondary)'),
            fontWeight: activeTab === 'add_product' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: !isVerified ? 'not-allowed' : 'pointer',
            opacity: !isVerified ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Plus size={16} />
          <span>{editingProduct ? 'Edit Sweet' : 'Add New Sweet'}{!isVerified ? ' (Locked)' : ''}</span>
        </button>
      </div>

      {/* TAB 1: PRODUCTS LIST */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', margin: 0 }}>
              All Products
            </h2>
            <button
              onClick={() => { handleResetForm(); setActiveTab('add_product'); }}
              disabled={!isVerified}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
            >
              <Plus size={16} />
              <span>Add Sweet</span>
            </button>
          </div>

          {products.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '3rem 1rem',
              textAlign: 'center',
              border: '1px solid var(--border-subtle)'
            }}>
              <p style={{ color: 'var(--text-muted)' }}>No products in your catalog yet.</p>
              {isVerified && (
                <button onClick={() => setActiveTab('add_product')} className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                  Add First Sweet Product
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {products.map(prod => {
                const isLowStock = prod.stock_quantity <= (prod.low_stock_threshold || 5);
                return (
                  <div key={prod.id} style={{
                    background: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{ height: '160px', width: '100%', background: 'var(--bg-cream)', overflow: 'hidden' }}>
                      <img
                        src={getMediaUrl(prod.image_url)}
                        alt={prod.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.src = FALLBACK_SWEET_IMAGE; }}
                      />
                    </div>
                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {prod.name}
                        </h3>
                        <span style={{ fontWeight: 700, color: 'var(--maroon-primary)', fontSize: '1rem' }}>
                          ₹{parseFloat(prod.price).toFixed(2)}
                        </span>
                      </div>

                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 0.75rem 0', flex: 1 }}>
                        {prod.description || 'Delicious traditional delicacy made fresh.'}
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {prod.weight_pack_size && (
                          <span style={{ fontSize: '0.75rem', background: 'var(--bg-cream)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            {prod.weight_pack_size}
                          </span>
                        )}
                        {prod.sku && (
                          <span style={{ fontSize: '0.75rem', background: 'var(--bg-cream)', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            SKU: {prod.sku}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: isLowStock ? '#FEE2E2' : '#DCFCE7',
                          color: isLowStock ? '#991B1B' : '#166534'
                        }}>
                          Stock: {prod.stock_quantity} {isLowStock ? '(Low Stock)' : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: prod.availability_status === 'AVAILABLE' ? '#16a34a' : '#dc2626'
                        }}>
                          {prod.availability_status}
                        </span>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEditClick(prod)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVENTORY & STOCK TABLE */}
      {activeTab === 'inventory' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          overflowX: 'auto'
        }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--maroon-primary)', marginBottom: '1rem' }}>
            Stock & Inventory Control
          </h2>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Product Name</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>SKU</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Price</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Current Stock</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Low Stock Alert</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {products.map(prod => {
                const isLowStock = prod.stock_quantity <= (prod.low_stock_threshold || 5);
                return (
                  <tr key={prod.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 600 }}>{prod.name}</td>
                    <td style={{ padding: '0.85rem 0.5rem', color: 'var(--text-muted)' }}>{prod.sku || '-'}</td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>₹{parseFloat(prod.price).toFixed(2)}</td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <span style={{
                        fontWeight: 700,
                        color: isLowStock ? '#DC2626' : 'var(--text-primary)'
                      }}>
                        {prod.stock_quantity}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      {isLowStock ? (
                        <span style={{ fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}>
                          Threshold: {prod.low_stock_threshold || 5}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Threshold: {prod.low_stock_threshold || 5}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: prod.stock_quantity === 0 ? '#DC2626' : '#16A34A'
                      }}>
                        {prod.stock_quantity === 0 ? 'OUT_OF_STOCK' : prod.availability_status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <button
                        onClick={() => {
                          setAdjustingProduct(prod);
                          setAdjustStockForm({
                            newQuantity: prod.stock_quantity,
                            reason: 'MANUAL_CORRECTION',
                            notes: ''
                          });
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <ArrowUpDown size={14} />
                        <span>Adjust Stock</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: ADD / EDIT PRODUCT FORM */}
      {activeTab === 'add_product' && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-subtle)',
          padding: '2rem',
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          {!isVerified ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#FEF3C7',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}>
                <AlertTriangle size={32} />
              </div>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem' }}>
                Product Publishing Locked
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                Your sweet shop account verification status is <strong>{profile?.verification_status || 'PENDING'}</strong>. You must submit your FSSAI/GST compliance documents and receive platform Admin approval before publishing sweets to the catalog.
              </p>
              <Link to="/seller/verification" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}>
                Go to Verification Center
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem' }}>
                {editingProduct ? `Edit "${editingProduct.name}"` : 'Add New Sweet Product'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                Provide complete details, weight, pricing, and high-quality photography.
              </p>

              <form onSubmit={handleProductSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Sweet Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kaju Katli (Diamond Cut)"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Category
                </label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 450.00"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25"
                  value={productForm.stockQuantity}
                  onChange={(e) => setProductForm({ ...productForm, stockQuantity: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  SKU (Item Code)
                </label>
                <input
                  type="text"
                  placeholder="e.g. KK-500G"
                  value={productForm.sku}
                  onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Pack Size / Weight
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500g, 1 kg, Box of 12"
                  value={productForm.weightPackSize}
                  onChange={(e) => setProductForm({ ...productForm, weightPackSize: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={productForm.lowStockThreshold}
                  onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Availability Status
                </label>
                <select
                  value={productForm.availabilityStatus}
                  onChange={(e) => setProductForm({ ...productForm, availabilityStatus: e.target.value })}
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="OUT_OF_STOCK">OUT_OF_STOCK</option>
                  <option value="DISCONTINUED">DISCONTINUED</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Product Photography
              </label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-cream)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {productForm.imageUrl ? (
                    <img
                      src={getMediaUrl(productForm.imageUrl)}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = FALLBACK_SWEET_IMAGE; }}
                    />
                  ) : (
                    <Image size={32} color="var(--text-muted)" />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label
                      className="btn btn-secondary"
                      style={{
                        cursor: isUploadingProductImg ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        padding: '0.45rem 0.85rem'
                      }}
                    >
                      <Upload size={14} />
                      <span>{isUploadingProductImg ? 'Uploading...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        style={{ display: 'none' }}
                        onChange={handleProductImageUpload}
                        disabled={isUploadingProductImg}
                      />
                    </label>
                    {productForm.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setProductForm(prev => ({ ...prev, imageUrl: '' }))}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Or enter image URL (/uploads/products/... or https://...)"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    style={{ fontSize: '0.85rem', width: '100%' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    Supports JPEG, PNG, WebP, SVG up to 5MB.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Product Description & Ingredients
              </label>
              <textarea
                rows={3}
                placeholder="Made with premium cashews, pure cow ghee, and silver vark..."
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { handleResetForm(); setActiveTab('products'); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingProduct || (!isVerified && !editingProduct)}
                className="btn btn-primary"
              >
                {isSavingProduct ? 'Saving...' : editingProduct ? 'Update Product' : 'Create & Publish'}
              </button>
            </div>
          </form>
          </>
          )}
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {adjustingProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--maroon-primary)', marginBottom: '0.5rem' }}>
              Adjust Stock: {adjustingProduct.name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Current Authoritative Stock: <strong>{adjustingProduct.stock_quantity}</strong>
            </p>

            <form onSubmit={handleStockAdjustmentSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  New Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustStockForm.newQuantity}
                  onChange={(e) => setAdjustStockForm({ ...adjustStockForm, newQuantity: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Reason for Adjustment
                </label>
                <select
                  value={adjustStockForm.reason}
                  onChange={(e) => setAdjustStockForm({ ...adjustStockForm, reason: e.target.value })}
                >
                  <option value="RESTOCK">Fresh Batch / Restock</option>
                  <option value="MANUAL_CORRECTION">Manual Inventory Audit Correction</option>
                  <option value="DAMAGE">Damaged / Expired Wastage</option>
                  <option value="RETURN">Order Return</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Notes / Batch Info
                </label>
                <input
                  type="text"
                  placeholder="e.g. Batch #104 morning preparation"
                  value={adjustStockForm.notes}
                  onChange={(e) => setAdjustStockForm({ ...adjustStockForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="btn btn-primary"
                >
                  {isAdjusting ? 'Updating...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
