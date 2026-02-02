const express = require('express');
const { body, query } = require('express-validator');
const discountController = require('../controllers/discountController');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// Validation schemas
const validateDiscountValidation = [
  body('code').trim().notEmpty().withMessage('Discount code is required'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be a positive number'),
  body('userId').optional().isUUID(),
  body('items').optional().isArray()
];

const createDiscountValidation = [
  body('code').trim().notEmpty().withMessage('Discount code is required')
    .isLength({ max: 50 }).withMessage('Code must be 50 characters or less')
    .matches(/^[A-Z0-9]+$/i).withMessage('Code must contain only letters and numbers'),
  body('description').optional().isLength({ max: 255 }),
  body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
  body('value').isFloat({ min: 0.01 }).withMessage('Value must be greater than 0'),
  body('minOrderAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('maxDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('perUserLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('expiresAt').optional({ nullable: true }).isISO8601(),
  body('isActive').optional().isBoolean(),
  body('applicableCategories').optional({ nullable: true }).isArray(),
  body('applicableProducts').optional({ nullable: true }).isArray()
];

const updateDiscountValidation = [
  body('code').optional().trim().isLength({ min: 1, max: 50 })
    .matches(/^[A-Z0-9]+$/i).withMessage('Code must contain only letters and numbers'),
  body('description').optional().isLength({ max: 255 }),
  body('type').optional().isIn(['percentage', 'fixed']),
  body('value').optional().isFloat({ min: 0.01 }),
  body('minOrderAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('maxDiscountAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('usageLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('perUserLimit').optional({ nullable: true }).isInt({ min: 1 }),
  body('startsAt').optional({ nullable: true }).isISO8601(),
  body('expiresAt').optional({ nullable: true }).isISO8601(),
  body('isActive').optional().isBoolean()
];

const bulkCreateValidation = [
  body('prefix').optional().matches(/^[A-Z0-9]+$/i).isLength({ max: 10 }),
  body('count').isInt({ min: 1, max: 100 }).withMessage('Count must be between 1 and 100'),
  body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
  body('value').isFloat({ min: 0.01 }).withMessage('Value must be greater than 0')
];

// Public routes
router.post('/validate', validateDiscountValidation, validate, discountController.validateDiscount);

// Admin routes
router.get('/admin/list', authenticateAdmin, discountController.getAllDiscounts);
router.get('/admin/generate-code', authenticateAdmin, discountController.generateDiscountCode);
router.get('/admin/:id', authenticateAdmin, discountController.getDiscountById);
router.post('/admin', authenticateAdmin, createDiscountValidation, validate, discountController.createDiscount);
router.post('/admin/bulk', authenticateAdmin, bulkCreateValidation, validate, discountController.bulkCreateDiscounts);
router.put('/admin/:id', authenticateAdmin, updateDiscountValidation, validate, discountController.updateDiscount);
router.delete('/admin/:id', authenticateAdmin, discountController.deleteDiscount);

module.exports = router;
