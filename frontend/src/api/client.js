/**
 * Central Axios HTTP Client
 * 
 * Features:
 * 1. Automatically attaches Bearer access token to outbound requests.
 * 2. Implements a synchronized 401 Token Refresh Queue:
 *    - Pauses concurrent requests while a single refresh rotation is in-flight.
 *    - Dispatches retries upon receiving a fresh access token.
 *    - Clears tokens and triggers logout if refresh token is rejected or revoked.
 * 3. Never logs raw tokens, credentials, or secrets to the console.
 * 4. Token storage note: Because backend returns tokens in JSON response bodies,
 *    we use sessionStorage to avoid long-term disk persistence.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// In-memory token reference for instantaneous request injection
let currentAccessToken = sessionStorage.getItem('sweet_access_token') || null;

export function getAccessToken() {
  return currentAccessToken || sessionStorage.getItem('sweet_access_token');
}

export function setClientTokens(accessToken, refreshToken) {
  currentAccessToken = accessToken;
  if (accessToken) {
    sessionStorage.setItem('sweet_access_token', accessToken);
  } else {
    sessionStorage.removeItem('sweet_access_token');
  }

  if (refreshToken) {
    sessionStorage.setItem('sweet_refresh_token', refreshToken);
  } else {
    sessionStorage.removeItem('sweet_refresh_token');
  }
}

export function getStoredRefreshToken() {
  return sessionStorage.getItem('sweet_refresh_token');
}

export function clearClientTokens() {
  currentAccessToken = null;
  sessionStorage.removeItem('sweet_access_token');
  sessionStorage.removeItem('sweet_refresh_token');
  sessionStorage.removeItem('sweet_user_info');
}

// Interceptor: Outbound Request Token Injection
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // For FormData payloads, remove preset application/json so browser / Axios generates multipart/form-data boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Queue management for transparent 401 token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor: Inbound Response & Refresh Rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip retry on login or refresh failures to prevent infinite loops
    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearClientTokens();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Call token rotation endpoint directly without interceptor recursion
      const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken
      });

      const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data.data;
      setClientTokens(newAccess, newRefresh);

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;

      processQueue(null, newAccess);
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearClientTokens();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
