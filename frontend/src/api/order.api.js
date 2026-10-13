import apiClient from './client';

export async function placeOrder(deliveryAddressId) {
  const res = await apiClient.post('/orders', { deliveryAddressId });
  return res.data;
}

export async function listMyOrders(params = {}) {
  const res = await apiClient.get('/orders/my-orders', { params });
  return res.data;
}

export async function getMyOrder(orderId) {
  const res = await apiClient.get(`/orders/my-orders/${orderId}`);
  return res.data;
}

export async function cancelMyOrder(orderId, reason = 'Cancelled by customer') {
  const res = await apiClient.post(`/orders/my-orders/${orderId}/cancel`, { reason });
  return res.data;
}
