const express = require('express');
const authRoutes = require('./auth.routes');
const productRoutes = require('./product.routes');
const categoryRoutes = require('./category.routes');
const orderRoutes = require('./order.routes');
const discountRoutes = require('./discount.routes');
const uploadRoutes = require('./upload.routes');
const customerRoutes = require('./customer.routes');
const { authenticateAdmin } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Atandrila E-Commerce API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      categories: '/api/categories',
      orders: '/api/orders',
      discount: '/api/discount'
    }
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', orderRoutes);
router.use('/discount', discountRoutes);
router.use('/upload', uploadRoutes);
router.use('/customers', customerRoutes);

// Dashboard
router.get('/dashboard/stats', authenticateAdmin, dashboardController.getDashboardStats);
router.get('/dashboard/notifications', authenticateAdmin, dashboardController.getNotifications);

module.exports = router;
