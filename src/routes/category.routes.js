const express = require('express');
const { body, query } = require('express-validator');
const categoryController = require('../controllers/categoryController');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// Validation schemas
const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 100 }),
  body('description').optional().isString(),
  body('image').optional().isString().withMessage('Image must be a valid URL or path'),
  body('bannerImage').optional().isString().withMessage('Banner image must be a valid URL or path'),
  body('parentId').optional({ nullable: true }).isUUID(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  body('metaTitle').optional().isLength({ max: 255 }),
  body('metaDescription').optional().isString()
];

const updateCategoryValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString(),
  body('image').optional({ nullable: true }).isString(),
  body('bannerImage').optional({ nullable: true }).isString(),
  body('parentId').optional({ nullable: true }).isUUID(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
];

const reorderValidation = [
  body('categories').isArray().withMessage('Categories must be an array'),
  body('categories.*.id').isUUID().withMessage('Category ID must be a valid UUID'),
  body('categories.*.sortOrder').isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer')
];

// Public routes
router.get('/', categoryController.getAllCategories);

// Admin routes (must be before /:identifier to avoid param capture)
router.get('/admin/list', authenticateAdmin, categoryController.getAdminCategories);
router.post('/', authenticateAdmin, categoryValidation, validate, categoryController.createCategory);
router.put('/reorder', authenticateAdmin, reorderValidation, validate, categoryController.reorderCategories);
router.put('/:id', authenticateAdmin, updateCategoryValidation, validate, categoryController.updateCategory);
router.delete('/:id', authenticateAdmin, categoryController.deleteCategory);

// Public route with param (must be last)
router.get('/:identifier', categoryController.getCategoryBySlug);

module.exports = router;
