const { Op } = require('sequelize');
const { User, Order, OrderItem, sequelize } = require('../models');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');
const { getPaginationParams, getSortParams } = require('../utils/helpers');

/**
 * Get all customers (Admin only)
 * GET /api/customers
 */
const getCustomers = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { sortBy, sortOrder } = getSortParams(req.query, ['createdAt', 'firstName', 'lastName', 'email']);
    const { search } = req.query;

    const where = { role: 'customer' };

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: customers } = await User.findAndCountAll({
      where,
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phone',
        'isActive', 'lastLogin', 'createdAt'
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset
    });

    // Get order counts and totals for each customer
    const customerIds = customers.map(c => c.id);

    const orderStats = await Order.findAll({
      attributes: [
        'userId',
        [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount'],
        [sequelize.fn('SUM', sequelize.literal(
          "CASE WHEN status NOT IN ('cancelled', 'refunded') THEN `total` ELSE 0 END"
        )), 'totalSpent']
      ],
      where: { userId: { [Op.in]: customerIds } },
      group: ['userId'],
      raw: true
    });

    const statsMap = {};
    orderStats.forEach(s => {
      statsMap[s.userId] = {
        orderCount: parseInt(s.orderCount) || 0,
        totalSpent: parseFloat(s.totalSpent) || 0
      };
    });

    const customersWithStats = customers.map(c => {
      const cJson = c.toJSON();
      const stats = statsMap[c.id] || { orderCount: 0, totalSpent: 0 };
      return {
        ...cJson,
        orderCount: stats.orderCount,
        totalSpent: stats.totalSpent
      };
    });

    return paginatedResponse(res, customersWithStats, { page, limit, total: count }, 'Customers retrieved');
  } catch (error) {
    console.error('Error fetching customers:', error);
    return errorResponse(res, 'Failed to fetch customers', 500);
  }
};

/**
 * Get customer details (Admin only)
 * GET /api/customers/:id
 */
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findOne({
      where: { id, role: 'customer' },
      attributes: [
        'id', 'firstName', 'lastName', 'email', 'phone',
        'isActive', 'lastLogin', 'createdAt', 'updatedAt'
      ]
    });

    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    // Get customer orders
    const orders = await Order.findAll({
      where: { userId: id },
      attributes: ['id', 'orderNumber', 'total', 'status', 'paymentMethod', 'paymentStatus', 'createdAt'],
      include: [{
        model: OrderItem,
        as: 'items',
        attributes: ['id', 'productName', 'quantity', 'unitPrice', 'totalPrice']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    // Calculate stats
    const validOrders = orders.filter(o => !['cancelled', 'refunded'].includes(o.status));
    const totalSpent = validOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);

    return successResponse(res, {
      customer: customer.toJSON(),
      stats: {
        totalOrders: orders.length,
        totalSpent,
        averageOrderValue: validOrders.length ? totalSpent / validOrders.length : 0
      },
      orders: orders.map(o => o.toJSON())
    }, 'Customer details retrieved');
  } catch (error) {
    console.error('Error fetching customer:', error);
    return errorResponse(res, 'Failed to fetch customer details', 500);
  }
};

/**
 * Toggle customer active status (Admin only)
 * PUT /api/customers/:id/toggle-status
 */
const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await User.findOne({ where: { id, role: 'customer' } });
    if (!customer) {
      return errorResponse(res, 'Customer not found', 404);
    }

    await customer.update({ isActive: !customer.isActive });

    return successResponse(res, {
      id: customer.id,
      isActive: customer.isActive
    }, `Customer ${customer.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    console.error('Error toggling customer status:', error);
    return errorResponse(res, 'Failed to update customer status', 500);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  toggleCustomerStatus
};
