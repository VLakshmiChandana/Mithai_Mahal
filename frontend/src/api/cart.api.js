import apiClient from './client';

export async function getCart() {
  const res = await apiClient.get('/cart');
  return res.data;
}

export async function addItem({ productId, quantity = 1, clearAndReplace = false }) {
  const res = await apiClient.post('/cart/items', {
    productId,
    quantity,
    clearAndReplace
  });
  return res.data;
}

export async function updateItem(itemId, quantity) {
  const res = await apiClient.patch(`/cart/items/${itemId}`, { quantity });
  return res.data;
}

export async function removeItem(itemId) {
  const res = await apiClient.delete(`/cart/items/${itemId}`);
  return res.data;
}

export async function clearCart() {
  const res = await apiClient.delete('/cart');
  return res.data;
}

export async function validateCheckout(deliveryAddressId = null) {
  const payload = {};
  if (deliveryAddressId) payload.deliveryAddressId = deliveryAddressId;
  const res = await apiClient.post('/cart/validate-checkout', payload);
  return res.data;
}
