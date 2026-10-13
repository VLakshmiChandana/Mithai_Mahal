import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HelpCircle, Plus, MessageSquare, ArrowRight, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import * as supportApi from '../api/support.api';
import * as orderApi from '../api/order.api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function SupportPage() {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get('orderId') || '';

  const [tickets, setTickets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // New Ticket Modal State
  const [isModalOpen, setIsModalOpen] = useState(!!preselectedOrderId);
  const [formData, setFormData] = useState({
    orderId: preselectedOrderId,
    subject: '',
    category: 'ORDER_ISSUE',
    priority: 'MEDIUM',
    initialMessage: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const { showToast } = useToast();

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      // Load support tickets as primary requirement
      const ticketsRes = await supportApi.listMyTickets();
      if (ticketsRes.success) {
        setTickets(ticketsRes.data || []);
      }

      // Load orders optionally to populate order link dropdown
      try {
        const ordersRes = await orderApi.listMyOrders({ limit: 15 });
        if (ordersRes.success) {
          setOrders(ordersRes.data || []);
        }
      } catch {
        // Not critical if orders list cannot be fetched
        setOrders([]);
      }
      if (isManualRefresh) {
        showToast('Support tickets refreshed.', 'success');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Could not load your support tickets.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.initialMessage.trim()) {
      const msg = 'Subject and message details are required.';
      setModalError(msg);
      showToast(msg, 'error');
      return;
    }

    setIsSubmitting(true);
    setModalError('');
    try {
      const cleanOrderId = formData.orderId && formData.orderId.trim() ? formData.orderId.trim() : null;
      const res = await supportApi.createTicket({
        orderId: cleanOrderId,
        subject: formData.subject.trim(),
        category: formData.category,
        priority: formData.priority,
        initialMessage: formData.initialMessage.trim()
      });

      if (res && res.success) {
        showToast('Support ticket opened! An agent will respond shortly.', 'success');
        setIsModalOpen(false);
        setModalError('');
        setFormData({
          orderId: '',
          subject: '',
          category: 'ORDER_ISSUE',
          priority: 'MEDIUM',
          initialMessage: ''
        });
        await loadData();
      } else {
        const msg = res?.message || 'Failed to submit support ticket.';
        setModalError(msg);
        showToast(msg, 'error');
      }
    } catch (err) {
      const detailsMsg = err.response?.data?.error?.details?.[0]?.message;
      const errorMsg =
        detailsMsg ||
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Failed to submit support ticket.';
      setModalError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED':
        return <span className="badge badge-success">RESOLVED</span>;
      case 'CLOSED':
        return <span className="badge" style={{ background: '#E5E7E9', color: '#5D6D7E' }}>CLOSED</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-gold">IN PROGRESS</span>;
      default:
        return <span className="badge badge-maroon">OPEN</span>;
    }
  };

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>Customer Help & Support</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Have questions about your sweet delivery, fresh quality, or payment? Open a ticket below.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || isLoading}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Tickets'}</span>
            </button>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus size={18} />
              <span>Open New Ticket</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner text="Retrieving support tickets..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : tickets.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <HelpCircle size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--maroon-primary)' }}>No support tickets filed</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Everything looks peaceful! If you ever need help with a fresh sweet box or delivery delay, open a ticket anytime.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus size={18} />
              <span>Submit a Ticket</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.map((t) => (
              <Link
                key={t.id}
                to={`/support/${t.id}`}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.2s, border-color 0.2s',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
                className="card"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                    <code style={{ fontSize: '0.82rem', color: 'var(--maroon-primary)', fontWeight: 700 }}>
                      {t.ticket_number || t.ticket_reference || t.id.slice(0, 10)}
                    </code>
                    {getStatusBadge(t.status)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Category: {t.category ? t.category.replace(/_/g, ' ') : 'General'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                    {t.subject}
                  </h3>

                  {(t.order_number || t.order_id) && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Linked to Order: #{t.order_number || t.order_id.slice(0, 8)}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {new Date(t.created_at).toLocaleDateString('en-IN')}
                  </span>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--bg-cream)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--maroon-primary)'
                  }}>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalError('');
        }}
        title="Open Support Ticket"
      >
        <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {modalError && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#FADBD8',
              color: '#922B21',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid #F5B7B1'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{modalError}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Link to Order (Optional)
            </label>
            <select
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
            >
              <option value="">-- General Inquiry (No specific order) --</option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  Order #{ord.order_number || ord.id.slice(0, 8)} &bull; ₹{Number(ord.total_amount).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Issue Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="ORDER_ISSUE">Order Issue</option>
                <option value="DELIVERY_DELAY">Delivery Delay</option>
                <option value="FOOD_QUALITY">Sweets Freshness / Quality</option>
                <option value="PAYMENT_ISSUE">Payment / Billing</option>
                <option value="OTHER">Other Inquiry</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Urgency Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent (Delayed Delivery)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Subject *
            </label>
            <input
              type="text"
              placeholder="e.g. Missing 1 box of Kaju Katli in delivered package"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Detailed Message *
            </label>
            <textarea
              rows={4}
              placeholder="Please describe what happened so our customer care team can investigate with the sweet shop vendor..."
              value={formData.initialMessage}
              onChange={(e) => setFormData({ ...formData, initialMessage: e.target.value })}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            <span>{isSubmitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </Modal>
    </div>
  );
}
