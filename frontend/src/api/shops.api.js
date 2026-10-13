import apiClient from './client';

export async function listPublicShops() {
  const res = await apiClient.get('/sellers/public');
  return res.data;
}

export async function getPublicShop(sellerId) {
  const res = await apiClient.get(`/sellers/public/${sellerId}`);
  return res.data;
}
