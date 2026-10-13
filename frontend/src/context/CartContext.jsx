import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as cartApi from '../api/cart.api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [cart, setCart] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConflict, setPendingConflict] = useState(null);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }

    try {
      setIsLoading(true);
      const res = await cartApi.getCart();
      if (res.success) {
        setCart(res.data);
      }
    } catch {
      // Cart might be empty or user not registered
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId, quantity = 1, clearAndReplace = false) => {
    if (!isAuthenticated) {
      showToast('Please sign in to add items to your sweet cart.', 'info');
      return { requiresAuth: true };
    }

    try {
      setIsLoading(true);
      const res = await cartApi.addItem({ productId, quantity, clearAndReplace });
      if (res.success) {
        await fetchCart();
        showToast('Fresh sweet added to your cart!', 'success');
        setPendingConflict(null);
        return { success: true };
      }
    } catch (err) {
      // Check for single sweet shop conflict (409 Conflict)
      if (err.response?.status === 409) {
        const errorData = err.response.data;
        setPendingConflict({
          productId,
          quantity,
          message: errorData.message || 'Your cart contains items from another sweet shop.',
          currentShop: errorData.data?.currentShop || null
        });
        return { conflict: true, data: errorData };
      }

      const msg = err.response?.data?.message || err.message || 'Could not add sweet to cart.';
      showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  };

  const resolveConflict = async (shouldClearAndReplace) => {
    if (!pendingConflict) return;
    if (shouldClearAndReplace) {
      const { productId, quantity } = pendingConflict;
      await addToCart(productId, quantity, true);
    } else {
      setPendingConflict(null);
      showToast('Existing sweet cart preserved.', 'info');
    }
  };

  const updateQuantity = async (itemId, quantity) => {
    try {
      setIsLoading(true);
      if (quantity <= 0) {
        await cartApi.removeItem(itemId);
      } else {
        await cartApi.updateItem(itemId, quantity);
      }
      await fetchCart();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update item quantity.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromCart = async (itemId) => {
    try {
      setIsLoading(true);
      await cartApi.removeItem(itemId);
      await fetchCart();
      showToast('Item removed from cart.', 'info');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to remove item.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setIsLoading(true);
      await cartApi.clearCart();
      await fetchCart();
      showToast('Cart cleared.', 'info');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to clear cart.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const itemCount = cart?.items?.reduce((total, item) => total + item.quantity, 0) || 0;

  const value = {
    cart,
    itemCount,
    isLoading,
    pendingConflict,
    resolveConflict,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart: fetchCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
