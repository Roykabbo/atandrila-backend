const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { IMAGE } = require('../config/constants');
const { errorResponse } = require('../utils/response.utils');
const imageService = require('../services/imageService');

// Configure multer to store files in memory
const storage = multer.memoryStorage();

// File filter to validate uploads
const fileFilter = (req, file, cb) => {
  if (IMAGE.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: ${IMAGE.ALLOWED_TYPES.join(', ')}`), false);
  }
};

// Helper to check if file is a video
const isVideo = (mimetype) => IMAGE.ALLOWED_VIDEO_TYPES?.includes(mimetype);

// Helper to save video file
const saveVideoFile = async (buffer, originalname, folder = 'products') => {
  const uploadDir = path.join(process.env.UPLOAD_PATH || './uploads', folder);
  await fs.mkdir(uploadDir, { recursive: true });

  const ext = path.extname(originalname).toLowerCase();
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(uploadDir, filename);

  await fs.writeFile(filepath, buffer);

  return {
    url: `/uploads/${folder}/${filename}`,
    thumbnailUrl: null, // Videos don't have thumbnails for now
    isVideo: true
  };
};

// Create multer instance - no file size limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 10 // Maximum 10 files per request
  }
});

/**
 * Middleware to handle single product image upload
 */
const uploadProductImage = upload.single('image');

/**
 * Middleware to handle multiple product images upload
 */
const uploadProductImages = upload.array('images', 10);

/**
 * Middleware to handle category image upload
 */
const uploadCategoryImage = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]);

/**
 * Process uploaded product images/videos and attach URLs to request
 */
const processProductImages = async (req, res, next) => {
  try {
    if (!req.files && !req.file) {
      return next();
    }

    const files = req.files || [req.file];
    const processedImages = [];

    for (const file of files) {
      // Check if it's a video
      if (isVideo(file.mimetype)) {
        // Save video directly without processing
        const result = await saveVideoFile(file.buffer, file.originalname, 'products');
        processedImages.push({
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          altText: file.originalname.replace(/\.[^/.]+$/, ''),
          isVideo: true
        });
      } else {
        // Validate and process image
        const validation = await imageService.validateImage(file.buffer, file.mimetype);
        if (!validation.valid) {
          return errorResponse(res, validation.errors.join('. '), 400);
        }

        // Process and save image
        const result = await imageService.processProductImage(file.buffer, file.originalname);
        processedImages.push({
          url: result.url,
          thumbnailUrl: result.thumbnailUrl,
          altText: file.originalname.replace(/\.[^/.]+$/, ''),
          sizes: result.sizes,
          isVideo: false
        });
      }
    }

    req.processedImages = processedImages;
    next();
  } catch (error) {
    console.error('Error processing product media:', error);
    return errorResponse(res, 'Failed to process media files', 500);
  }
};

/**
 * Process uploaded category images and attach URLs to request
 */
const processCategoryImages = async (req, res, next) => {
  try {
    if (!req.files) {
      return next();
    }

    const processedImages = {};

    // Process main image
    if (req.files.image && req.files.image[0]) {
      const file = req.files.image[0];
      const validation = await imageService.validateImage(file.buffer, file.mimetype);
      if (!validation.valid) {
        return errorResponse(res, `Image: ${validation.errors.join('. ')}`, 400);
      }
      processedImages.image = await imageService.processCategoryImage(file.buffer, 'image');
    }

    // Process banner image
    if (req.files.bannerImage && req.files.bannerImage[0]) {
      const file = req.files.bannerImage[0];
      const validation = await imageService.validateImage(file.buffer, file.mimetype);
      if (!validation.valid) {
        return errorResponse(res, `Banner: ${validation.errors.join('. ')}`, 400);
      }
      processedImages.bannerImage = await imageService.processCategoryImage(file.buffer, 'banner');
    }

    req.processedImages = processedImages;
    next();
  } catch (error) {
    console.error('Error processing category images:', error);
    return errorResponse(res, 'Failed to process images', 500);
  }
};

/**
 * Error handler for multer errors
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_COUNT') {
      return errorResponse(res, 'Too many files. Maximum: 10 files per upload', 400);
    }
    return errorResponse(res, err.message, 400);
  }

  if (err) {
    return errorResponse(res, err.message, 400);
  }

  next();
};

module.exports = {
  upload,
  uploadProductImage,
  uploadProductImages,
  uploadCategoryImage,
  processProductImages,
  processCategoryImages,
  handleUploadError
};
