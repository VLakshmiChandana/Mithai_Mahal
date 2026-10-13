import apiClient from './client';

export async function listProducts(params = {}) {
  const res = await apiClient.get('/products', { params });
  return res.data;
}

export async function getProduct(productId) {
  const res = await apiClient.get(`/products/${productId}`);
  return res.data;
}

export async function listCategories(params = {}) {
  const res = await apiClient.get('/categories', { params });
  return res.data;
}
