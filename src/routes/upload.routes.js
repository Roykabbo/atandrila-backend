const express = require('express');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const {
  uploadProductImages,
  uploadCategoryImage,
  processProductImages,
  processCategoryImages,
  handleUploadError
} = require('../middleware/upload.middleware');
const { successResponse, errorResponse } = require('../utils/response.utils');
const imageService = require('../services/imageService');

const router = express.Router();

/**
 * Upload product images
 * POST /api/upload/products
 */
router.post(
  '/products',
  authenticateAdmin,
  uploadProductImages,
  handleUploadError,
  processProductImages,
  (req, res) => {
    if (!req.processedImages || req.processedImages.length === 0) {
      return errorResponse(res, 'No images uploaded', 400);
    }

    return successResponse(res, {
      images: req.processedImages
    }, 'Images uploaded successfully', 201);
  }
);

/**
 * Upload category images
 * POST /api/upload/categories
 */
router.post(
  '/categories',
  authenticateAdmin,
  uploadCategoryImage,
  handleUploadError,
  processCategoryImages,
  (req, res) => {
    if (!req.processedImages || Object.keys(req.processedImages).length === 0) {
      return errorResponse(res, 'No images uploaded', 400);
    }

    return successResponse(res, req.processedImages, 'Images uploaded successfully', 201);
  }
);

/**
 * Delete an image
 * DELETE /api/upload
 */
router.delete(
  '/',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { url, type } = req.body;

      if (!url) {
        return errorResponse(res, 'Image URL is required', 400);
      }

      if (type === 'product') {
        await imageService.deleteProductImages(url);
      } else {
        await imageService.deleteImage(url);
      }

      return successResponse(res, null, 'Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      return errorResponse(res, 'Failed to delete image', 500);
    }
  }
);

module.exports = router;
