import apiClient from './client';

export async function getLiveTracking(orderId) {
  const res = await apiClient.get(`/deliveries/orders/${orderId}/tracking`);
  return res.data;
}

export async function resetDeliverySimulation(orderId) {
  const res = await apiClient.post(`/deliveries/orders/${orderId}/simulation/reset`);
  return res.data;
}
