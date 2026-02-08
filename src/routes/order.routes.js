const express = require('express');
const { body, query, param } = require('express-validator');
const orderController = require('../controllers/orderController');
const { authenticate, authenticateAdmin, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router();

// Validation schemas
const createOrderValidation = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').isUUID().withMessage('Product ID must be a valid UUID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.variantId').optional({ nullable: true }).isUUID(),
  body('items.*.isCombo').optional().isBoolean(),
  body('items.*.comboSelections').optional().isArray(),
  body('items.*.comboSelections.*.comboItemId').optional().isUUID(),
  body('items.*.comboSelections.*.childProductId').optional().isUUID(),
  body('items.*.comboSelections.*.variantId').optional({ nullable: true }).isUUID(),

  body('shippingAddress').notEmpty().withMessage('Shipping address is required'),
  body('shippingAddress.recipientName').trim().notEmpty().withMessage('Recipient name is required'),
  body('shippingAddress.phone').trim().notEmpty().withMessage('Phone is required')
    .matches(/^(?:\+88)?01[3-9]\d{8}$/).withMessage('Invalid Bangladesh phone number'),
  body('shippingAddress.addressLine1').trim().notEmpty().withMessage('Address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.district').trim().notEmpty().withMessage('District is required'),

  body('paymentMethod').isIn(['cod', 'bkash', 'nagad', 'rocket']).withMessage('Invalid payment method'),

  body('discountCode').optional().isString(),
  body('notes').optional().isString(),

  // Guest checkout fields (required if not authenticated)
  body('guestEmail').optional().isEmail().withMessage('Invalid email'),
  body('guestPhone').optional().matches(/^(?:\+88)?01[3-9]\d{8}$/).withMessage('Invalid phone number'),
  body('guestName').optional().trim().isLength({ min: 2 })
];

const updateStatusValidation = [
  body('status').isIn([
    'pending', 'confirmed', 'processing', 'shipped',
    'out_for_delivery', 'delivered', 'cancelled', 'refunded'
  ]).withMessage('Invalid order status'),
  body('note').optional().isString(),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  body('adminNotes').optional().isString()
];

const cancelOrderValidation = [
  body('reason').optional().isString().isLength({ max: 500 })
];

// Public routes
router.get('/track/:orderNumber', orderController.trackOrder);

// Create order (supports both guest and authenticated users)
router.post('/', optionalAuth, createOrderValidation, validate, orderController.createOrder);

// Protected routes (require authentication)
router.get('/', authenticate, orderController.getOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/cancel', authenticate, cancelOrderValidation, validate, orderController.cancelOrder);

// Admin routes
router.put('/:id/status', authenticateAdmin, updateStatusValidation, validate, orderController.updateOrderStatus);
router.get('/admin/stats', authenticateAdmin, orderController.getOrderStats);

module.exports = router;
