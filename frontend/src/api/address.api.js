import apiClient from './client';

export async function listAddresses() {
  const res = await apiClient.get('/addresses');
  return res.data;
}

export async function createAddress(addressData) {
  const res = await apiClient.post('/addresses', addressData);
  return res.data;
}

export async function updateAddress(addressId, addressData) {
  const res = await apiClient.patch(`/addresses/${addressId}`, addressData);
  return res.data;
}

export async function deleteAddress(addressId) {
  const res = await apiClient.delete(`/addresses/${addressId}`);
  return res.data;
}

export async function setDefaultAddress(addressId) {
  const res = await apiClient.post(`/addresses/${addressId}/default`);
  return res.data;
}
