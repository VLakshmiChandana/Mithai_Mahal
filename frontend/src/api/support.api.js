import apiClient from './client';

export async function createTicket({ orderId = null, subject, category = 'ORDER_ISSUE', priority = 'MEDIUM', initialMessage }) {
  const payload = { subject, category, priority, initialMessage };
  const cleanOrderId = typeof orderId === 'string' ? orderId.trim() : orderId;
  if (cleanOrderId) {
    payload.orderId = cleanOrderId;
  }
  const res = await apiClient.post('/support/tickets', payload);
  return res.data;
}

export async function listMyTickets(params = {}) {
  const res = await apiClient.get('/support/my-tickets', { params });
  return res.data;
}

export async function getMyTicket(ticketId) {
  const res = await apiClient.get(`/support/my-tickets/${ticketId}`);
  return res.data;
}

export async function addTicketMessage(ticketId, message) {
  const res = await apiClient.post(`/support/tickets/${ticketId}/messages`, { message });
  return res.data;
}
