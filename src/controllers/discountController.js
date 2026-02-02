const { Op } = require('sequelize');
const { DiscountCode, Order, User, sequelize } = require('../models');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');
const { getPaginationParams } = require('../utils/helpers');
const { DISCOUNT_TYPES } = require('../config/constants');

/**
 * Validate a discount code
 * POST /api/discount/validate
 */
const validateDiscount = async (req, res) => {
  try {
    const { code, subtotal, userId, items } = req.body;

    if (!code) {
      return errorResponse(res, 'Discount code is required', 400);
    }

    const discount = await DiscountCode.findOne({
      where: {
        code: code.toUpperCase(),
        isActive: true
      }
    });

    if (!discount) {
      return errorResponse(res, 'Invalid discount code', 404);
    }

    const now = new Date();

    // Check if discount is active
    if (discount.startsAt && new Date(discount.startsAt) > now) {
      return errorResponse(res, 'Discount code is not yet active', 400);
    }

    if (discount.expiresAt && new Date(discount.expiresAt) < now) {
      return errorResponse(res, 'Discount code has expired', 400);
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return errorResponse(res, 'Discount code usage limit reached', 400);
    }

    // Check per-user limit
    if (userId && discount.perUserLimit) {
      const userUsageCount = await Order.count({
        where: {
          userId,
          discountCodeId: discount.id,
          status: { [Op.notIn]: ['cancelled', 'refunded'] }
        }
      });

      if (userUsageCount >= discount.perUserLimit) {
        return errorResponse(res, 'You have already used this discount code the maximum number of times', 400);
      }
    }

    // Check minimum order amount
    if (discount.minOrderAmount && subtotal < parseFloat(discount.minOrderAmount)) {
      return errorResponse(res, `Minimum order amount of ৳${discount.minOrderAmount} required for this discount`, 400);
    }

    // Check applicable categories/products
    if (items && discount.applicableCategories) {
      const applicableCategories = discount.applicableCategories;
      const hasApplicableItem = items.some(item =>
        applicableCategories.includes(item.categoryId)
      );
      if (!hasApplicableItem) {
        return errorResponse(res, 'Discount code is not applicable to items in your cart', 400);
      }
    }

    if (items && discount.applicableProducts) {
      const applicableProducts = discount.applicableProducts;
      const hasApplicableItem = items.some(item =>
        applicableProducts.includes(item.productId)
      );
      if (!hasApplicableItem) {
        return errorResponse(res, 'Discount code is not applicable to items in your cart', 400);
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discount.type === DISCOUNT_TYPES.PERCENTAGE) {
      discountAmount = (subtotal * parseFloat(discount.value)) / 100;
      if (discount.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, parseFloat(discount.maxDiscountAmount));
      }
    } else {
      discountAmount = parseFloat(discount.value);
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    return successResponse(res, {
      valid: true,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discountAmount: Math.round(discountAmount * 100) / 100,
      description: discount.description,
      minOrderAmount: discount.minOrderAmount,
      maxDiscountAmount: discount.maxDiscountAmount
    }, 'Discount code is valid');
  } catch (error) {
    console.error('Error validating discount:', error);
    return errorResponse(res, 'Failed to validate discount code', 500);
  }
};

/**
 * Get all discount codes (Admin only)
 * GET /api/admin/discounts
 */
const getAllDiscounts = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { search, status, type } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (status === 'active') {
      where.isActive = true;
      where[Op.or] = [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } }
      ];
    } else if (status === 'expired') {
      where.expiresAt = { [Op.lt]: new Date() };
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (type) {
      where.type = type;
    }

    const { count, rows: discounts } = await DiscountCode.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Add usage percentage for each discount
    const discountsWithUsage = discounts.map(d => {
      const data = d.toJSON();
      data.usagePercentage = d.usageLimit
        ? Math.round((d.usedCount / d.usageLimit) * 100)
        : null;
      return data;
    });

    return paginatedResponse(res, discountsWithUsage, { page, limit, total: count }, 'Discounts retrieved successfully');
  } catch (error) {
    console.error('Error fetching discounts:', error);
    return errorResponse(res, 'Failed to fetch discounts', 500);
  }
};

/**
 * Get single discount code (Admin only)
 * GET /api/admin/discounts/:id
 */
const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await DiscountCode.findByPk(id);

    if (!discount) {
      return errorResponse(res, 'Discount code not found', 404);
    }

    // Get usage statistics
    const usageStats = await Order.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        [sequelize.fn('SUM', sequelize.col('discount_amount')), 'totalDiscount']
      ],
      where: {
        discountCodeId: id,
        status: { [Op.notIn]: ['cancelled', 'refunded'] }
      },
      raw: true
    });

    const result = discount.toJSON();
    result.usageStats = {
      totalOrders: usageStats[0]?.totalOrders || 0,
      totalDiscount: usageStats[0]?.totalDiscount || 0
    };

    return successResponse(res, result, 'Discount retrieved successfully');
  } catch (error) {
    console.error('Error fetching discount:', error);
    return errorResponse(res, 'Failed to fetch discount', 500);
  }
};

/**
 * Create a new discount code (Admin only)
 * POST /api/admin/discounts
 */
const createDiscount = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      startsAt,
      expiresAt,
      isActive,
      applicableCategories,
      applicableProducts
    } = req.body;

    // Validate required fields
    if (!code || !type || !value) {
      return errorResponse(res, 'Code, type, and value are required', 400);
    }

    // Validate type
    if (!Object.values(DISCOUNT_TYPES).includes(type)) {
      return errorResponse(res, 'Invalid discount type', 400);
    }

    // Check if code already exists
    const existingCode = await DiscountCode.findOne({
      where: { code: code.toUpperCase() }
    });

    if (existingCode) {
      return errorResponse(res, 'Discount code already exists', 400);
    }

    // Validate percentage value
    if (type === DISCOUNT_TYPES.PERCENTAGE && (value <= 0 || value > 100)) {
      return errorResponse(res, 'Percentage discount must be between 1 and 100', 400);
    }

    const discount = await DiscountCode.create({
      code: code.toUpperCase(),
      description,
      type,
      value,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      startsAt,
      expiresAt,
      isActive: isActive !== false,
      applicableCategories,
      applicableProducts
    });

    return successResponse(res, discount, 'Discount code created successfully', 201);
  } catch (error) {
    console.error('Error creating discount:', error);
    return errorResponse(res, 'Failed to create discount code', 500);
  }
};

/**
 * Update a discount code (Admin only)
 * PUT /api/admin/discounts/:id
 */
const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const discount = await DiscountCode.findByPk(id);

    if (!discount) {
      return errorResponse(res, 'Discount code not found', 404);
    }

    // Check code uniqueness if changing
    if (updateData.code && updateData.code.toUpperCase() !== discount.code) {
      const existingCode = await DiscountCode.findOne({
        where: {
          code: updateData.code.toUpperCase(),
          id: { [Op.ne]: id }
        }
      });

      if (existingCode) {
        return errorResponse(res, 'Discount code already exists', 400);
      }

      updateData.code = updateData.code.toUpperCase();
    }

    // Validate percentage value
    if (updateData.type === DISCOUNT_TYPES.PERCENTAGE &&
        updateData.value && (updateData.value <= 0 || updateData.value > 100)) {
      return errorResponse(res, 'Percentage discount must be between 1 and 100', 400);
    }

    await discount.update(updateData);

    return successResponse(res, discount, 'Discount code updated successfully');
  } catch (error) {
    console.error('Error updating discount:', error);
    return errorResponse(res, 'Failed to update discount code', 500);
  }
};

/**
 * Delete a discount code (Admin only)
 * DELETE /api/admin/discounts/:id
 */
const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const discount = await DiscountCode.findByPk(id);

    if (!discount) {
      return errorResponse(res, 'Discount code not found', 404);
    }

    // Check if discount has been used
    if (discount.usedCount > 0 && force !== 'true') {
      return errorResponse(res, `Discount has been used ${discount.usedCount} times. Use force=true to delete anyway or deactivate instead.`, 400);
    }

    if (force === 'true') {
      await discount.destroy();
      return successResponse(res, null, 'Discount code permanently deleted');
    } else {
      await discount.update({ isActive: false });
      return successResponse(res, null, 'Discount code deactivated');
    }
  } catch (error) {
    console.error('Error deleting discount:', error);
    return errorResponse(res, 'Failed to delete discount code', 500);
  }
};

/**
 * Generate a random discount code
 * GET /api/admin/discounts/generate-code
 */
const generateDiscountCode = async (req, res) => {
  try {
    const { prefix = 'ATNDR' } = req.query;

    let code;
    let isUnique = false;

    // Generate unique code
    while (!isUnique) {
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      code = `${prefix}${random}`;

      const existing = await DiscountCode.findOne({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
    }

    return successResponse(res, { code }, 'Discount code generated');
  } catch (error) {
    console.error('Error generating discount code:', error);
    return errorResponse(res, 'Failed to generate discount code', 500);
  }
};

/**
 * Bulk create discount codes (Admin only)
 * POST /api/admin/discounts/bulk
 */
const bulkCreateDiscounts = async (req, res) => {
  try {
    const { prefix, count, ...discountData } = req.body;

    if (!count || count < 1 || count > 100) {
      return errorResponse(res, 'Count must be between 1 and 100', 400);
    }

    const codes = [];
    const existingCodes = new Set(
      (await DiscountCode.findAll({ attributes: ['code'], raw: true }))
        .map(d => d.code)
    );

    // Generate unique codes
    while (codes.length < count) {
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${prefix || 'ATNDR'}${random}`;

      if (!existingCodes.has(code) && !codes.includes(code)) {
        codes.push(code);
      }
    }

    // Create all discount codes
    const discounts = await DiscountCode.bulkCreate(
      codes.map(code => ({
        code,
        ...discountData,
        isActive: discountData.isActive !== false
      }))
    );

    return successResponse(res, {
      count: discounts.length,
      codes: discounts.map(d => d.code)
    }, `${discounts.length} discount codes created successfully`, 201);
  } catch (error) {
    console.error('Error bulk creating discounts:', error);
    return errorResponse(res, 'Failed to create discount codes', 500);
  }
};

module.exports = {
  validateDiscount,
  getAllDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  generateDiscountCode,
  bulkCreateDiscounts
};
