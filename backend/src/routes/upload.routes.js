/**
 * Public Assets Upload Routes (/api/v1/uploads)
 * Allows authenticated sellers and staff to upload shop logos and sweet product images.
 * Files are stored safely in public/uploads with unique generated filenames.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const { requireRoles } = require('../middleware/authorize');
const { ValidationError, ForbiddenError } = require('../middleware/errorHandler');

const router = express.Router();

// Supported MIME types and max size (5 MB)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const PUBLIC_UPLOADS_DIR = path.resolve(__dirname, '../../public/uploads');

// Ensure upload subdirectories exist
['products', 'logos'].forEach((sub) => {
  const dir = path.join(PUBLIC_UPLOADS_DIR, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const uploadFields = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]);

router.use(authenticate);

/**
 * POST /api/v1/uploads/image
 * Body (multipart): image or file, type ('product' | 'logo')
 */
router.post('/image', uploadFields, async (req, res, next) => {
  try {
    const userRole = req.user.role || req.user.userType;
    if (!['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      throw new ForbiddenError('Only sellers or platform administrators can upload images.');
    }

    const uploadedFile = req.files?.image?.[0] || req.files?.file?.[0] || req.file;
    if (!uploadedFile) {
      throw new ValidationError('Image file is required for upload.');
    }

    const { mimetype, buffer, originalname, size } = uploadedFile;

    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
      throw new ValidationError(`Unsupported image type "${mimetype}". Only JPEG, PNG, WEBP, and SVG are permitted.`);
    }

    // Determine target subfolder based on image category
    const type = (req.body.type || 'product').toLowerCase();
    const folder = type === 'logo' ? 'logos' : 'products';

    // Generate safe unique filename
    const ext = path.extname(originalname).toLowerCase() || (mimetype === 'image/png' ? '.png' : mimetype === 'image/webp' ? '.webp' : mimetype === 'image/svg+xml' ? '.svg' : '.jpg');
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext) ? ext : '.jpg';
    const uniqueName = `${folder}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    const targetPath = path.join(PUBLIC_UPLOADS_DIR, folder, uniqueName);

    fs.writeFileSync(targetPath, buffer);

    const baseUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    const publicUrl = baseUrl ? `${baseUrl}/uploads/${folder}/${uniqueName}` : `/uploads/${folder}/${uniqueName}`;

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully.',
      data: {
        url: publicUrl,
        imageUrl: publicUrl,
        fileName: uniqueName,
        mimeType: mimetype,
        size
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
