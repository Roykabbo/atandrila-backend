const express = require('express');
const customerController = require('../controllers/customerController');
const { authenticateAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateAdmin);

router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id/toggle-status', customerController.toggleCustomerStatus);

module.exports = router;
