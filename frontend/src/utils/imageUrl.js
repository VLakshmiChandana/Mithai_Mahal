/**
 * Media URL Resolver Utility
 * Resolves static assets and uploaded media across local and deployed environments (Vercel + Render).
 */

const FALLBACK_SWEET_IMAGE = '/sweets/motichoor-laddu.svg';

export function getMediaUrl(path) {
  if (!path) return FALLBACK_SWEET_IMAGE;
  
  // Return absolute or data URLs as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  // Prepend backend host if it's an uploaded asset from the backend
  if (path.startsWith('/uploads/')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
      const origin = apiBase.replace(/\/api\/v1\/?$/, '');
      return `${origin}${path}`;
    }
    // Fallback: If deployed on Vercel, ensure it fetches from the live Render backend
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      return `https://mithai-mahal-backend.onrender.com${path}`;
    }
  }

  return path;
}

export { FALLBACK_SWEET_IMAGE };
