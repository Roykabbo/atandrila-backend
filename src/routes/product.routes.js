const express = require('express');
const { body, query, param } = require('express-validator');
const productController = require('../controllers/productController');
const { authenticate, authenticateAdmin, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// Validation schemas
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 255 }),
  body('categoryId').notEmpty().withMessage('Category is required').isUUID(),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ max: 50 }),
  body('basePrice').notEmpty().withMessage('Base price is required').isFloat({ min: 0 }),
  body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('description').optional().isString(),
  body('shortDescription').optional().isLength({ max: 500 }),
  body('isFeatured').optional().isBoolean(),
  body('isNewArrival').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('variants').optional().isArray(),
  body('variants.*.size').notEmpty().withMessage('Variant size is required'),
  body('variants.*.stock').optional().isInt({ min: 0 }),
  body('images').optional().isArray(),
  body('images.*.url').notEmpty().withMessage('Image URL is required')
];

const updateProductValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('categoryId').optional().isUUID(),
  body('sku').optional().trim().isLength({ min: 1, max: 50 }),
  body('basePrice').optional().isFloat({ min: 0 }),
  body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('description').optional().isString(),
  body('isFeatured').optional().isBoolean(),
  body('isNewArrival').optional().isBoolean(),
  body('isActive').optional().isBoolean()
];

// Public routes
router.get('/', optionalAuth, productController.getAllProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/new-arrivals', productController.getNewArrivals);
router.get('/:identifier', optionalAuth, productController.getProductBySlug);
router.get('/:id/related', productController.getRelatedProducts);

// Admin routes
router.post('/', authenticateAdmin, productValidation, validate, productController.createProduct);
router.put('/:id', authenticateAdmin, updateProductValidation, validate, productController.updateProduct);
router.delete('/:id', authenticateAdmin, productController.deleteProduct);

// Admin product listing (includes inactive)
router.get('/admin/list', authenticateAdmin, productController.getAdminProducts);

module.exports = router;
