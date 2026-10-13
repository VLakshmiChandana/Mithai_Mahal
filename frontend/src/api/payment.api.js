import apiClient from './client';

export async function initiatePayment(orderId) {
  const res = await apiClient.post(`/payments/orders/${orderId}/initiate`);
  return res.data;
}

// Verify client Razorpay Standard Checkout payment response with backend
export async function verifyRazorpayPayment(orderId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const res = await apiClient.post(`/payments/orders/${orderId}/verify`, {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
  });
  return res.data;
}

// Helper to trigger simulated webhook confirmation in local demo environment
export async function simulateWebhookPayment(orderId, paymentReference, providerPaymentId, amount) {
  // Uses backend mock capture endpoint which safely applies HMAC signature in dev/mock mode
  const res = await apiClient.post(`/payments/orders/${orderId}/mock-capture`);
  return res.data;
}

// Development test signature helper for Razorpay Dupe simulator
export async function generateTestSignature(orderId, { razorpayOrderId, razorpayPaymentId }) {
  const res = await apiClient.post(`/payments/orders/${orderId}/test-sign`, {
    razorpayOrderId,
    razorpayPaymentId
  });
  return res.data;
}
