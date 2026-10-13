import apiClient, { getStoredRefreshToken } from './client';

export async function login({ email, password, sellerId }) {
  const payload = { email, password };
  if (sellerId) payload.sellerId = sellerId;
  const res = await apiClient.post('/auth/login', payload);
  return res.data;
}

export async function register({ sellerId, email, password, firstName, lastName, phone }) {
  const payload = { sellerId, email, password, firstName };
  if (lastName) payload.lastName = lastName;
  if (phone) payload.phone = phone;
  const res = await apiClient.post('/customers/register', payload);
  return res.data;
}

export async function getMe() {
  const res = await apiClient.get('/auth/me');
  return res.data;
}

export async function getCustomerProfile() {
  const res = await apiClient.get('/customers/profile');
  return res.data;
}

export async function logout() {
  const refreshToken = getStoredRefreshToken();
  try {
    await apiClient.post('/auth/logout', { refreshToken });
  } catch {
    // If logout fails remotely (e.g. expired), client cleanup still proceeds
  }
}
