const { Op } = require('sequelize');
const { Order, Product, ProductVariant, User, OrderItem, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response.utils');

const LOW_STOCK_THRESHOLD = 5;

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Current period stats (last 30 days)
    const [
      totalRevenue,
      previousRevenue,
      totalOrders,
      previousOrders,
      totalProducts,
      totalCustomers,
      previousCustomers,
      todayOrders,
      pendingOrders
    ] = await Promise.all([
      // Revenue last 30 days
      Order.sum('total', {
        where: {
          status: { [Op.notIn]: ['cancelled', 'refunded'] },
          createdAt: { [Op.gte]: thirtyDaysAgo }
        }
      }),
      // Revenue previous 30 days (for comparison)
      Order.sum('total', {
        where: {
          status: { [Op.notIn]: ['cancelled', 'refunded'] },
          createdAt: { [Op.gte]: sixtyDaysAgo, [Op.lt]: thirtyDaysAgo }
        }
      }),
      // Orders last 30 days
      Order.count({
        where: { createdAt: { [Op.gte]: thirtyDaysAgo } }
      }),
      // Orders previous 30 days
      Order.count({
        where: { createdAt: { [Op.gte]: sixtyDaysAgo, [Op.lt]: thirtyDaysAgo } }
      }),
      // Total active products
      Product.count({ where: { isActive: true } }),
      // Customers last 30 days
      User.count({
        where: { role: 'customer', createdAt: { [Op.gte]: thirtyDaysAgo } }
      }),
      // Customers previous 30 days
      User.count({
        where: { role: 'customer', createdAt: { [Op.gte]: sixtyDaysAgo, [Op.lt]: thirtyDaysAgo } }
      }),
      // Today's orders
      Order.count({
        where: { createdAt: { [Op.gte]: today } }
      }),
      // Pending orders
      Order.count({
        where: { status: 'pending' }
      })
    ]);

    // Calculate percentage changes
    const revenueChange = previousRevenue
      ? (((totalRevenue || 0) - previousRevenue) / previousRevenue * 100).toFixed(1)
      : totalRevenue ? '+100' : '0';
    const ordersChange = previousOrders
      ? (((totalOrders - previousOrders) / previousOrders) * 100).toFixed(1)
      : totalOrders ? '+100' : '0';
    const customersChange = previousCustomers
      ? (((totalCustomers - previousCustomers) / previousCustomers) * 100).toFixed(1)
      : totalCustomers ? '+100' : '0';

    // Recent orders (last 10)
    const recentOrders = await Order.findAll({
      attributes: ['id', 'orderNumber', 'total', 'status', 'createdAt', 'guestName'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Low stock variants
    const lowStockVariants = await ProductVariant.findAll({
      where: {
        stock: { [Op.lte]: LOW_STOCK_THRESHOLD, [Op.gt]: 0 }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name'],
          where: { isActive: true }
        }
      ],
      attributes: ['id', 'sku', 'size', 'color', 'stock'],
      order: [['stock', 'ASC']],
      limit: 10
    });

    // Out of stock variants
    const outOfStockCount = await ProductVariant.count({
      where: { stock: 0 },
      include: [{
        model: Product,
        as: 'product',
        where: { isActive: true }
      }]
    });

    return successResponse(res, {
      stats: {
        totalRevenue: totalRevenue || 0,
        revenueChange: `${revenueChange >= 0 ? '+' : ''}${revenueChange}%`,
        totalOrders,
        ordersChange: `${ordersChange >= 0 ? '+' : ''}${ordersChange}%`,
        totalProducts,
        totalCustomers,
        customersChange: `${customersChange >= 0 ? '+' : ''}${customersChange}%`,
        todayOrders,
        pendingOrders
      },
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.user
          ? `${o.user.firstName} ${o.user.lastName}`
          : (o.guestName || 'Guest'),
        date: o.createdAt,
        total: o.total,
        status: o.status
      })),
      lowStockVariants: lowStockVariants.map(v => ({
        id: v.id,
        productName: v.product.name,
        sku: v.sku,
        size: v.size,
        color: v.color,
        stock: v.stock
      })),
      outOfStockCount
    }, 'Dashboard stats retrieved');
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return errorResponse(res, 'Failed to fetch dashboard stats', 500);
  }
};

/**
 * Get new order notifications (Admin only)
 * GET /api/dashboard/notifications
 * Query: ?since=ISO_DATE (returns orders created after this date)
 */
const getNotifications = async (req, res) => {
  try {
    const { since } = req.query;

    const where = {};
    if (since) {
      where.createdAt = { [Op.gt]: new Date(since) };
    }

    const orders = await Order.findAll({
      where,
      attributes: ['id', 'orderNumber', 'total', 'status', 'createdAt', 'guestName'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['firstName', 'lastName'],
        required: false
      }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    const notifications = orders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.user
        ? `${o.user.firstName} ${o.user.lastName}`
        : (o.guestName || 'Guest'),
      total: o.total,
      status: o.status,
      createdAt: o.createdAt
    }));

    return successResponse(res, notifications, 'Notifications retrieved');
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return errorResponse(res, 'Failed to fetch notifications', 500);
  }
};

module.exports = { getDashboardStats, getNotifications };
