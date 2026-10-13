import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, User, ShieldCheck, CheckCircle2, MessageSquare, Clock } from 'lucide-react';
import * as supportApi from '../api/support.api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [ticketData, setTicketData] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const loadTicket = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await supportApi.getMyTicket(ticketId);
      if (res.success) {
        setTicketData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load ticket details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await supportApi.addTicketMessage(ticketId, replyMessage.trim());
      if (res.success) {
        setReplyMessage('');
        showToast('Reply message sent to customer support.', 'success');
        // Refresh messages
        const refreshRes = await supportApi.getMyTicket(ticketId);
        if (refreshRes.success) setTicketData(refreshRes.data);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send reply message.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading && !ticketData) {
    return <LoadingSpinner text="Retrieving conversation history..." />;
  }

  if (error && !ticketData) {
    return <ErrorState message={error} onRetry={loadTicket} />;
  }

  const ticket = ticketData?.ticket || ticketData;
  const messages = ticketData?.messages || [];
  const isClosed = ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED';

  return (
    <div style={{ padding: '3rem 0 5rem' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        <Link to="/support" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--maroon-primary)',
          fontSize: '0.9rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}>
          <ArrowLeft size={16} />
          <span>Back to All Tickets</span>
        </Link>

        {/* Ticket Header Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--maroon-primary)' }}>
              {ticket.ticket_number || ticket.ticket_reference || ticket.id}
            </code>
            <span className="badge badge-maroon">{ticket.status}</span>
          </div>

          <h1 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {ticket.subject}
          </h1>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.84rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span>Category: {ticket.category?.replace(/_/g, ' ')}</span>
            <span>Priority: {ticket.priority}</span>
            <span>Opened: {new Date(ticket.created_at).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Conversation Message Thread */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {messages.map((msg) => {
            const isStaff = msg.sender_role === 'STAFF' || msg.sender_role === 'ADMIN' || msg.sender_role === 'CUSTOMER_CARE';
            return (
              <div
                key={msg.id}
                style={{
                  background: isStaff ? '#FFFDF8' : '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isStaff ? 'var(--gold-accent)' : 'var(--border-subtle)'}`,
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)',
                  alignSelf: isStaff ? 'flex-start' : 'stretch'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: isStaff ? 'var(--saffron-primary)' : 'var(--maroon-primary)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem'
                    }}>
                      {isStaff ? <ShieldCheck size={16} /> : <User size={16} />}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isStaff ? 'var(--maroon-primary)' : 'var(--text-primary)' }}>
                      {isStaff ? 'Sweet Shop Customer Care Support' : 'You (Customer)'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.message}
                </p>
              </div>
            );
          })}
        </div>

        {/* Reply Message Form */}
        {!isClosed ? (
          <form onSubmit={handleSendReply} style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <h4 style={{ fontSize: '1rem', color: 'var(--maroon-primary)', marginBottom: '0.75rem' }}>
              Send Message Reply
            </h4>
            <textarea
              rows={3}
              placeholder="Type your message here..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              required
              style={{ marginBottom: '0.75rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSending || !replyMessage.trim()}
                className="btn btn-primary btn-sm"
              >
                <Send size={15} />
                <span>{isSending ? 'Sending...' : 'Send Reply'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div style={{
            background: 'var(--bg-cream)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'center',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)'
          }}>
            <CheckCircle2 size={24} color="var(--veg-green)" style={{ margin: '0 auto 0.5rem' }} />
            <p><strong>This ticket has been resolved and closed.</strong></p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              If you need help with a new sweet delivery or inquiry, please open a fresh support ticket.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
