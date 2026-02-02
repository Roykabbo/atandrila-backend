const { Op } = require('sequelize');
const {
  Order,
  OrderItem,
  ShippingAddress,
  OrderStatusHistory,
  Product,
  ProductVariant,
  ProductImage,
  DiscountCode,
  User,
  StockMovement,
  sequelize
} = require('../models');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');
const { generateOrderNumber, getPaginationParams } = require('../utils/helpers');
const { ORDER_STATUS, STOCK_MOVEMENT_TYPES } = require('../config/constants');
const { notifyAdminNewOrder, sendOrderConfirmation, sendOrderStatusUpdate } = require('../services/emailService');

/**
 * Create a new order (supports both guest and registered users)
 * POST /api/orders
 */
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      discountCode,
      notes,
      guestEmail,
      guestPhone,
      guestName
    } = req.body;

    // Get user ID if authenticated
    const userId = req.user?.id || null;

    // Validate items
    if (!items || items.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'Order must contain at least one item', 400);
    }

    // Validate guest info if not logged in
    if (!userId && (!guestEmail || !guestPhone || !guestName)) {
      await transaction.rollback();
      return errorResponse(res, 'Guest orders require email, phone, and name', 400);
    }

    // Validate and calculate order items
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: ProductVariant, as: 'variants' }]
      });

      if (!product || !product.isActive) {
        await transaction.rollback();
        return errorResponse(res, `Product ${item.productId} not found or unavailable`, 400);
      }

      // Get variant if specified
      let variant = null;
      let unitPrice = parseFloat(product.salePrice || product.basePrice);

      if (item.variantId) {
        variant = product.variants.find(v => v.id === item.variantId && v.isActive);
        if (!variant) {
          await transaction.rollback();
          return errorResponse(res, `Variant ${item.variantId} not found or unavailable`, 400);
        }

        // Check stock
        if (variant.stock < item.quantity) {
          await transaction.rollback();
          return errorResponse(res, `Insufficient stock for ${product.name} (${variant.size}/${variant.color})`, 400);
        }

        // Apply price adjustment
        unitPrice += parseFloat(variant.priceAdjustment || 0);
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        productId: product.id,
        productVariantId: variant?.id,
        productName: product.name,
        productSku: variant?.sku || product.sku,
        size: variant?.size || item.size,
        color: variant?.color || item.color,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        variant // Keep reference for stock update
      });
    }

    // Handle discount code
    let discountAmount = 0;
    let discountCodeId = null;

    if (discountCode) {
      const discount = await DiscountCode.findOne({
        where: {
          code: discountCode.toUpperCase(),
          isActive: true
        }
      });

      if (discount) {
        const now = new Date();

        // Check validity
        if (discount.startsAt && new Date(discount.startsAt) > now) {
          await transaction.rollback();
          return errorResponse(res, 'Discount code is not yet active', 400);
        }

        if (discount.expiresAt && new Date(discount.expiresAt) < now) {
          await transaction.rollback();
          return errorResponse(res, 'Discount code has expired', 400);
        }

        if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
          await transaction.rollback();
          return errorResponse(res, 'Discount code usage limit reached', 400);
        }

        if (discount.minOrderAmount && subtotal < parseFloat(discount.minOrderAmount)) {
          await transaction.rollback();
          return errorResponse(res, `Minimum order amount of ${discount.minOrderAmount} required`, 400);
        }

        // Calculate discount
        if (discount.type === 'percentage') {
          discountAmount = subtotal * (parseFloat(discount.value) / 100);
          if (discount.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, parseFloat(discount.maxDiscountAmount));
          }
        } else {
          discountAmount = parseFloat(discount.value);
        }

        discountCodeId = discount.id;

        // Increment usage count
        await discount.increment('usedCount', { transaction });
      }
    }

    // Calculate shipping cost (can be customized based on location/weight)
    const shippingCost = calculateShippingCost(shippingAddress);

    // Calculate total
    const total = subtotal - discountAmount + shippingCost;

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order
    const order = await Order.create({
      orderNumber,
      userId,
      guestEmail: userId ? null : guestEmail,
      guestPhone: userId ? null : guestPhone,
      guestName: userId ? null : guestName,
      status: ORDER_STATUS.PENDING,
      subtotal,
      discountAmount,
      discountCodeId,
      shippingCost,
      total,
      paymentMethod,
      paymentStatus: 'pending',
      notes,
      estimatedDelivery: calculateEstimatedDelivery()
    }, { transaction });

    // Create order items
    for (const item of orderItems) {
      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        productSku: item.productSku,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }, { transaction });

      // Update variant stock
      if (item.variant) {
        const previousStock = item.variant.stock;
        const newStock = previousStock - item.quantity;
        await item.variant.decrement('stock', { by: item.quantity, transaction });

        // Create stock movement record
        await StockMovement.create({
          productVariantId: item.variant.id,
          type: STOCK_MOVEMENT_TYPES.SALE,
          quantity: -item.quantity,
          previousStock,
          newStock,
          reference: 'order',
          referenceId: order.id,
          note: `Sold via order ${orderNumber}`,
          createdBy: userId
        }, { transaction });
      }

      // Update product sold count
      await Product.increment('soldCount', {
        by: item.quantity,
        where: { id: item.productId },
        transaction
      });
    }

    // Create shipping address
    await ShippingAddress.create({
      orderId: order.id,
      recipientName: shippingAddress.recipientName,
      phone: shippingAddress.phone,
      alternatePhone: shippingAddress.alternatePhone,
      addressLine1: shippingAddress.addressLine1,
      addressLine2: shippingAddress.addressLine2,
      city: shippingAddress.city,
      district: shippingAddress.district,
      postalCode: shippingAddress.postalCode,
      country: shippingAddress.country || 'Bangladesh',
      deliveryInstructions: shippingAddress.deliveryInstructions
    }, { transaction });

    // Create initial status history
    await OrderStatusHistory.create({
      orderId: order.id,
      status: ORDER_STATUS.PENDING,
      note: 'Order placed',
      changedBy: userId
    }, { transaction });

    await transaction.commit();

    // Fetch complete order
    const completeOrder = await getOrderWithDetails(order.id);

    // Send email notifications (non-blocking)
    notifyAdminNewOrder(completeOrder).catch(err => console.error('Admin notification failed:', err));
    sendOrderConfirmation(completeOrder).catch(err => console.error('Customer confirmation failed:', err));

    return successResponse(res, completeOrder, 'Order created successfully', 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating order:', error);
    return errorResponse(res, 'Failed to create order', 500);
  }
};

/**
 * Get orders for current user or all orders for admin
 * GET /api/orders
 */
const getOrders = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { status, search, startDate, endDate } = req.query;

    const isAdmin = req.user?.role === 'admin';
    const where = {};

    // Non-admin users can only see their own orders
    if (!isAdmin) {
      if (req.user) {
        where.userId = req.user.id;
      } else {
        return errorResponse(res, 'Authentication required', 401);
      }
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Search filter (order number, guest email/name)
    if (search) {
      where[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { guestEmail: { [Op.like]: `%${search}%` } },
        { guestName: { [Op.like]: `%${search}%` } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'slug'],
              include: [{
                model: ProductImage,
                as: 'images',
                where: { isPrimary: true },
                required: false,
                attributes: ['thumbnailUrl']
              }]
            }
          ]
        },
        {
          model: ShippingAddress,
          as: 'shippingAddress'
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    return paginatedResponse(res, orders, { page, limit, total: count }, 'Orders retrieved successfully');
  } catch (error) {
    console.error('Error fetching orders:', error);
    return errorResponse(res, 'Failed to fetch orders', 500);
  }
};

/**
 * Get single order by ID
 * GET /api/orders/:id
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === 'admin';

    const order = await getOrderWithDetails(id);

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    // Check permission - users can only view their own orders
    if (!isAdmin && order.userId !== req.user?.id) {
      return errorResponse(res, 'Access denied', 403);
    }

    return successResponse(res, order, 'Order retrieved successfully');
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse(res, 'Failed to fetch order', 500);
  }
};

/**
 * Track order by order number (public)
 * GET /api/orders/track/:orderNumber
 */
const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email, phone } = req.query;

    // Require either email or phone for verification
    if (!email && !phone) {
      return errorResponse(res, 'Email or phone required for order tracking', 400);
    }

    const where = { orderNumber };

    // Verify ownership by email/phone
    if (email) {
      where[Op.or] = [
        { guestEmail: email },
        { '$user.email$': email }
      ];
    } else if (phone) {
      where[Op.or] = [
        { guestPhone: phone },
        { '$shippingAddress.phone$': phone }
      ];
    }

    const order = await Order.findOne({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['email']
        },
        {
          model: OrderItem,
          as: 'items',
          attributes: ['productName', 'size', 'color', 'quantity', 'unitPrice', 'totalPrice']
        },
        {
          model: ShippingAddress,
          as: 'shippingAddress'
        },
        {
          model: OrderStatusHistory,
          as: 'statusHistory',
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!order) {
      return errorResponse(res, 'Order not found or verification failed', 404);
    }

    // Return limited info for tracking
    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      items: order.items,
      shippingAddress: {
        recipientName: order.shippingAddress.recipientName,
        city: order.shippingAddress.city,
        district: order.shippingAddress.district
      },
      statusHistory: order.statusHistory
    };

    return successResponse(res, trackingInfo, 'Order tracking info retrieved');
  } catch (error) {
    console.error('Error tracking order:', error);
    return errorResponse(res, 'Failed to track order', 500);
  }
};

/**
 * Update order status (Admin only)
 * PUT /api/orders/:id/status
 */
const updateOrderStatus = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { status, note, paymentStatus, adminNotes } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      await transaction.rollback();
      return errorResponse(res, 'Order not found', 404);
    }

    // Validate status transition
    const validTransitions = getValidStatusTransitions(order.status);
    if (status && !validTransitions.includes(status)) {
      await transaction.rollback();
      return errorResponse(res, `Invalid status transition from ${order.status} to ${status}`, 400);
    }

    const updateData = {};

    if (status) {
      updateData.status = status;

      // Handle special status actions
      if (status === ORDER_STATUS.DELIVERED) {
        updateData.deliveredAt = new Date();
        updateData.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
      }

      if (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REFUNDED) {
        // Restore stock
        await restoreOrderStock(order.id, transaction);
      }
    }

    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
    }

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    await order.update(updateData, { transaction });

    // Create status history entry
    if (status) {
      await OrderStatusHistory.create({
        orderId: order.id,
        status,
        note,
        changedBy: req.user.id
      }, { transaction });
    }

    await transaction.commit();

    // Fetch updated order
    const updatedOrder = await getOrderWithDetails(order.id);

    // Notify customer of status change (non-blocking)
    if (status) {
      sendOrderStatusUpdate(updatedOrder, status, note).catch(err => console.error('Status notification failed:', err));
    }

    return successResponse(res, updatedOrder, 'Order status updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating order status:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
};

/**
 * Cancel order (User can cancel pending orders)
 * PUT /api/orders/:id/cancel
 */
const cancelOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      await transaction.rollback();
      return errorResponse(res, 'Order not found', 404);
    }

    // Check permission
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && order.userId !== req.user?.id) {
      await transaction.rollback();
      return errorResponse(res, 'Access denied', 403);
    }

    // Users can only cancel pending orders
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!isAdmin && !cancellableStatuses.includes(order.status)) {
      await transaction.rollback();
      return errorResponse(res, 'Order cannot be cancelled at this stage', 400);
    }

    // Restore stock
    await restoreOrderStock(order.id, transaction);

    await order.update({
      status: ORDER_STATUS.CANCELLED
    }, { transaction });

    await OrderStatusHistory.create({
      orderId: order.id,
      status: ORDER_STATUS.CANCELLED,
      note: reason || 'Order cancelled by customer',
      changedBy: req.user?.id
    }, { transaction });

    await transaction.commit();

    return successResponse(res, null, 'Order cancelled successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling order:', error);
    return errorResponse(res, 'Failed to cancel order', 500);
  }
};

/**
 * Get order statistics (Admin only)
 * GET /api/admin/orders/stats
 */
const getOrderStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateWhere = {};
    if (startDate) dateWhere[Op.gte] = new Date(startDate);
    if (endDate) dateWhere[Op.lte] = new Date(endDate);

    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      todayOrders
    ] = await Promise.all([
      Order.count({ where: Object.keys(dateWhere).length ? { createdAt: dateWhere } : {} }),
      Order.count({ where: { status: 'pending' } }),
      Order.count({ where: { status: 'delivered' } }),
      Order.count({ where: { status: 'cancelled' } }),
      Order.sum('total', {
        where: {
          status: { [Op.notIn]: ['cancelled', 'refunded'] },
          ...(Object.keys(dateWhere).length ? { createdAt: dateWhere } : {})
        }
      }),
      Order.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    // Orders by status
    const ordersByStatus = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    // Recent orders trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrend = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders'],
        [sequelize.fn('SUM', sequelize.col('total')), 'revenue']
      ],
      where: {
        createdAt: { [Op.gte]: sevenDaysAgo },
        status: { [Op.notIn]: ['cancelled', 'refunded'] }
      },
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
    });

    return successResponse(res, {
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: totalRevenue || 0,
      todayOrders,
      ordersByStatus,
      recentTrend
    }, 'Order statistics retrieved');
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return errorResponse(res, 'Failed to fetch order statistics', 500);
  }
};

// Helper functions

async function getOrderWithDetails(orderId) {
  return Order.findByPk(orderId, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
      },
      {
        model: OrderItem,
        as: 'items',
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'slug'],
          include: [{
            model: ProductImage,
            as: 'images',
            where: { isPrimary: true },
            required: false,
            attributes: ['url', 'thumbnailUrl']
          }]
        }]
      },
      {
        model: ShippingAddress,
        as: 'shippingAddress'
      },
      {
        model: DiscountCode,
        as: 'discountCode',
        attributes: ['code', 'type', 'value']
      },
      {
        model: OrderStatusHistory,
        as: 'statusHistory',
        include: [{
          model: User,
          as: 'changedByUser',
          attributes: ['firstName', 'lastName']
        }],
        order: [['createdAt', 'DESC']]
      }
    ]
  });
}

function getValidStatusTransitions(currentStatus) {
  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery', 'delivered'],
    out_for_delivery: ['delivered'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: []
  };
  return transitions[currentStatus] || [];
}

async function restoreOrderStock(orderId, transaction) {
  const orderItems = await OrderItem.findAll({
    where: { orderId },
    include: [{ model: ProductVariant, as: 'variant' }]
  });

  for (const item of orderItems) {
    if (item.productVariantId) {
      await ProductVariant.increment('stock', {
        by: item.quantity,
        where: { id: item.productVariantId },
        transaction
      });

      await StockMovement.create({
        productVariantId: item.productVariantId,
        type: STOCK_MOVEMENT_TYPES.RETURN,
        quantity: item.quantity,
        referenceType: 'order_cancellation',
        referenceId: orderId,
        notes: 'Stock restored due to order cancellation'
      }, { transaction });
    }

    await Product.decrement('soldCount', {
      by: item.quantity,
      where: { id: item.productId },
      transaction
    });
  }
}

function calculateShippingCost(shippingAddress) {
  // Inside Dhaka: 80 BDT, Outside Dhaka: 130 BDT
  const dhakaCities = ['dhaka', 'dhaka city', 'dhaka district'];
  const city = shippingAddress.city?.toLowerCase()?.trim();
  const district = shippingAddress.district?.toLowerCase()?.trim();
  if (dhakaCities.includes(city) || district === 'dhaka') {
    return 80;
  }
  return 130;
}

function calculateEstimatedDelivery() {
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 5); // 5 days from now
  return delivery;
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  trackOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderStats
};
