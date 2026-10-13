import apiClient from './client';

/**
 * Seller APIs
 */

// Public Seller Self-Registration
export async function registerSeller(data) {
  const res = await apiClient.post('/sellers/register', data);
  return res.data;
}

// Get own seller profile
export async function getSellerProfile() {
  const res = await apiClient.get('/sellers/profile');
  return res.data;
}

// Update own seller profile
export async function updateSellerProfile(data) {
  const res = await apiClient.patch('/sellers/profile', data);
  return res.data;
}

// List verification documents
export async function getSellerDocuments() {
  const res = await apiClient.get('/sellers/documents');
  return res.data;
}

// Upload verification document
export async function uploadSellerDocument(formData) {
  const res = await apiClient.post('/sellers/documents', formData);
  return res.data;
}

// Resubmit seller verification application
export async function resubmitSellerVerification(notes) {
  const res = await apiClient.post('/sellers/resubmit', { notes });
  return res.data;
}

// Upload image (product image or shop logo)
export async function uploadImage(file, type = 'product') {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('type', type);
  const res = await apiClient.post('/uploads/image', formData);
  return res.data;
}

export async function uploadShopLogo(file) {
  return uploadImage(file, 'logo');
}

// Seller Catalog & Products
export async function getSellerProducts(params = {}) {
  const res = await apiClient.get('/products', { params });
  return res.data;
}

export async function createProduct(data) {
  const res = await apiClient.post('/products', data);
  return res.data;
}

export async function updateProduct(productId, data) {
  const res = await apiClient.patch(`/products/${productId}`, data);
  return res.data;
}

export async function adjustStock(productId, data) {
  const res = await apiClient.patch(`/products/${productId}/inventory`, data);
  return res.data;
}

export async function deleteProduct(productId) {
  const res = await apiClient.delete(`/products/${productId}`);
  return res.data;
}

export async function getSellerCategories() {
  const res = await apiClient.get('/categories');
  return res.data;
}

export async function createCategory(data) {
  const res = await apiClient.post('/categories', data);
  return res.data;
}

// Admin / Super Admin Staff APIs for Seller Management
export async function listSellersForAdmin() {
  const res = await apiClient.get('/staff/sellers');
  return res.data;
}

export async function getSellerDocumentsForAdmin(sellerId) {
  const res = await apiClient.get(`/sellers/${sellerId}/documents`);
  return res.data;
}

export async function downloadSellerDocumentBlob(sellerId, documentId) {
  const res = await apiClient.get(`/sellers/${sellerId}/documents/${documentId}/file`, {
    responseType: 'blob'
  });
  return res.data;
}

export async function reviewSellerVerification(sellerId, { status, rejectionReason, reviewNotes }) {
  const res = await apiClient.patch(`/sellers/${sellerId}/review`, {
    status,
    rejectionReason,
    reviewNotes
  });
  return res.data;
}

export const reviewSellerApplication = reviewSellerVerification;

export async function updateSellerStatus(sellerId, { accountStatus, verificationStatus }) {
  const res = await apiClient.patch(`/sellers/${sellerId}/status`, {
    accountStatus,
    verificationStatus
  });
  return res.data;
}

export async function createStaffAdmin(data) {
  const res = await apiClient.post('/staff/admins', data);
  return res.data;
}
