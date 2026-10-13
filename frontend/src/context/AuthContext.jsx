import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setClientTokens, clearClientTokens } from '../api/client';
import * as authApi from '../api/auth.api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('sweet_user_info');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const handleLogout = useCallback(async (isSessionExpired = false) => {
    try {
      await authApi.logout();
    } catch {
      // Proceed with local clearance
    } finally {
      clearClientTokens();
      setUser(null);
      if (isSessionExpired) {
        showToast('Your session has expired. Please sign in again.', 'info');
      }
    }
  }, [showToast]);

  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      const token = sessionStorage.getItem('sweet_access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const meRes = await authApi.getMe();
        if (meRes.success && meRes.data.user) {
          setUser(meRes.data.user);
          sessionStorage.setItem('sweet_user_info', JSON.stringify(meRes.data.user));
        }
      } catch {
        // If initial token validation fails, clear stale session
        clearClientTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();

    // Listen for refresh failure / token expiry dispatched from Axios client
    const onAuthExpired = () => {
      handleLogout(true);
    };

    window.addEventListener('auth:expired', onAuthExpired);
    return () => window.removeEventListener('auth:expired', onAuthExpired);
  }, [handleLogout]);

  const login = async ({ email, password, sellerId }) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password, sellerId });
      const { accessToken, refreshToken, user: userData } = res.data;

      setClientTokens(accessToken, refreshToken);
      setUser(userData);
      sessionStorage.setItem('sweet_user_info', JSON.stringify(userData));

      showToast(`Welcome back, ${userData.name || userData.businessName || userData.firstName || userData.email}!`, 'success');
      return { success: true, user: userData };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed. Please check credentials.';
      showToast(message, 'error');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async ({ sellerId, email, password, firstName, lastName, phone }) => {
    setIsLoading(true);
    try {
      const res = await authApi.register({ sellerId, email, password, firstName, lastName, phone });
      showToast('Registration successful! Signing you in...', 'success');

      // Automatically sign in the freshly registered customer
      return await login({ email, password, sellerId });
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Registration failed.';
      showToast(message, 'error');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await handleLogout(false);
    showToast('You have been safely signed out.', 'info');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
