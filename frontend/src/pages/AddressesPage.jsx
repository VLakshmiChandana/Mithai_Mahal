import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, CheckCircle2, Home, Briefcase, Phone, User } from 'lucide-react';
import * as addressApi from '../api/address.api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [formData, setFormData] = useState({
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    addressType: 'HOME',
    isDefault: false
  });

  const { showToast } = useToast();

  const loadAddresses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await addressApi.listAddresses();
      if (res.success) {
        setAddresses(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load saved delivery addresses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormData({
      recipientName: '',
      recipientPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      addressType: 'HOME',
      isDefault: addresses.length === 0
    });
    setIsModalOpen(true);
  };

  const openEditModal = (addr) => {
    setEditingAddress(addr);
    setFormData({
      recipientName: addr.recipient_name || '',
      recipientPhone: addr.recipient_phone || '',
      addressLine1: addr.address_line1 || '',
      addressLine2: addr.address_line2 || '',
      city: addr.city || 'Mumbai',
      state: addr.state || 'Maharashtra',
      pincode: addr.pincode || '',
      addressType: addr.address_type || 'HOME',
      isDefault: !!addr.is_default
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.addressLine1.trim() || !formData.city.trim() || !formData.pincode.trim()) {
      showToast('Please fill all required address fields.', 'error');
      return;
    }

    try {
      if (editingAddress) {
        await addressApi.updateAddress(editingAddress.id, formData);
        showToast('Address updated successfully.', 'success');
      } else {
        await addressApi.createAddress(formData);
        showToast('New address saved.', 'success');
      }
      setIsModalOpen(false);
      await loadAddresses();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save address.', 'error');
    }
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) return;
    try {
      await addressApi.deleteAddress(addressId);
      showToast('Address removed.', 'info');
      await loadAddresses();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete address.', 'error');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await addressApi.setDefaultAddress(addressId);
      showToast('Default delivery address updated.', 'success');
      await loadAddresses();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to set default address.', 'error');
    }
  };

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>Saved Delivery Addresses</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Manage addresses for fast doorstep delivery of your sweet orders.
            </p>
          </div>

          <button onClick={openAddModal} className="btn btn-primary">
            <Plus size={18} />
            <span>Add New Address</span>
          </button>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Retrieving saved addresses..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadAddresses} />
        ) : addresses.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <MapPin size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--maroon-primary)' }}>No addresses saved yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Add your home, office, or gift recipient address to proceed with checkout.
            </p>
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus size={18} />
              <span>Add Your First Address</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${addr.is_default ? 'var(--maroon-primary)' : 'var(--border-subtle)'}`,
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {addr.is_default ? (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--maroon-primary)',
                    background: 'var(--maroon-subtle)',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-pill)'
                  }}>
                    <CheckCircle2 size={13} />
                    <span>DEFAULT</span>
                  </div>
                ) : null}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {addr.address_type === 'WORK' ? (
                    <Briefcase size={18} color="var(--maroon-primary)" />
                  ) : (
                    <Home size={18} color="var(--maroon-primary)" />
                  )}
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', textTransform: 'capitalize' }}>
                    {addr.address_type || 'HOME'}
                  </span>
                </div>

                {addr.recipient_name && (
                  <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {addr.recipient_name}
                  </p>
                )}

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                  {addr.address_line1}
                  {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                </p>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {addr.city}, {addr.state} — {addr.pincode}
                </p>

                {addr.recipient_phone && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1.25rem' }}>
                    <Phone size={14} />
                    <span>{addr.recipient_phone}</span>
                  </p>
                )}

                <div style={{
                  marginTop: 'auto',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      style={{ fontSize: '0.82rem', color: 'var(--maroon-primary)', fontWeight: 600 }}
                    >
                      Make Default
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                    <button
                      onClick={() => openEditModal(addr)}
                      style={{ padding: '6px', color: 'var(--text-secondary)' }}
                      title="Edit address"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      style={{ padding: '6px', color: 'var(--danger)' }}
                      title="Delete address"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Address Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Recipient Name
              </label>
              <input
                type="text"
                placeholder="Aarav Sharma"
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+919876543210"
                value={formData.recipientPhone}
                onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Address Line 1 (Flat, House No, Building) *
            </label>
            <input
              type="text"
              placeholder="Flat 402, Lotus Residency"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Address Line 2 (Street, Landmark)
            </label>
            <input
              type="text"
              placeholder="Near City Sweet Center"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Pincode *
              </label>
              <input
                type="text"
                placeholder="400001"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            {['HOME', 'WORK', 'OTHER'].map((type) => (
              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="addressType"
                  value={type}
                  checked={formData.addressType === type}
                  onChange={() => setFormData({ ...formData, addressType: type })}
                  style={{ width: 'auto' }}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginTop: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span>Set as primary default delivery address</span>
          </label>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            {editingAddress ? 'Update Address' : 'Save Delivery Address'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
