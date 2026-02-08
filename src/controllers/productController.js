const { Op } = require('sequelize');
const { Product, ProductImage, ProductVariant, Category, ComboItem, sequelize } = require('../models');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response.utils');
const { generateSlug, getPaginationParams, getSortParams } = require('../utils/helpers');
const { PAGINATION } = require('../config/constants');

/**
 * Get all products with filtering, pagination, and sorting
 * GET /api/products
 */
const getAllProducts = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { sortBy, sortOrder } = getSortParams(req.query, ['createdAt', 'name', 'basePrice', 'soldCount', 'viewCount']);

    const {
      category,
      minPrice,
      maxPrice,
      size,
      color,
      search,
      featured,
      newArrivals,
      inStock
    } = req.query;

    // Build where clause
    const where = { isActive: true };

    // Category filter
    if (category) {
      const categoryRecord = await Category.findOne({
        where: { [Op.or]: [{ id: category }, { slug: category }] }
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    // Build Op.and conditions array
    const andConditions = [];

    // Price range filter
    if (minPrice || maxPrice) {
      const priceCondition = {};
      if (minPrice) priceCondition[Op.gte] = parseFloat(minPrice);
      if (maxPrice) priceCondition[Op.lte] = parseFloat(maxPrice);

      andConditions.push({
        [Op.or]: [
          { salePrice: priceCondition },
          { [Op.and]: [{ salePrice: null }, { basePrice: priceCondition }] }
        ]
      });
    }

    // Search filter
    if (search) {
      andConditions.push({
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } }
        ]
      });
    }

    if (andConditions.length > 0) {
      where[Op.and] = andConditions;
    }

    // Featured filter
    if (featured === 'true') {
      where.isFeatured = true;
    }

    // New arrivals filter
    if (newArrivals === 'true') {
      where.isNewArrival = true;
    }

    // Variant filters (size, color, stock)
    let variantWhere = {};
    let hasVariantFilter = false;

    if (size) {
      variantWhere.size = size;
      hasVariantFilter = true;
    }
    if (color) {
      variantWhere.color = { [Op.like]: `%${color}%` };
      hasVariantFilter = true;
    }
    if (inStock === 'true') {
      variantWhere.stock = { [Op.gt]: 0 };
      hasVariantFilter = true;
    }

    // Map sortBy to actual database fields
    let orderField = sortBy;
    if (sortBy === 'price') {
      orderField = 'basePrice';
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'url', 'thumbnailUrl', 'altText', 'isPrimary', 'sortOrder', 'colorName'],
          order: [['sortOrder', 'ASC']]
        },
        {
          model: ProductVariant,
          as: 'variants',
          where: hasVariantFilter ? { ...variantWhere, isActive: true } : { isActive: true },
          required: hasVariantFilter,
          attributes: ['id', 'sku', 'size', 'color', 'colorCode', 'priceAdjustment', 'stock']
        }
      ],
      order: [[orderField, sortOrder]],
      limit,
      offset,
      distinct: true
    });

    return paginatedResponse(res, products, { page, limit, total: count }, 'Products retrieved successfully');
  } catch (error) {
    console.error('Error fetching products:', error);
    return errorResponse(res, 'Failed to fetch products', 500);
  }
};

/**
 * Get single product by slug or ID
 * GET /api/products/:identifier
 */
const getProductBySlug = async (req, res) => {
  try {
    const { identifier } = req.params;

    // Determine if identifier is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const where = isUUID ? { id: identifier } : { slug: identifier };
    where.isActive = true;

    const product = await Product.findOne({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'parentId']
        },
        {
          model: ProductImage,
          as: 'images',
          attributes: ['id', 'url', 'thumbnailUrl', 'altText', 'isPrimary', 'sortOrder', 'colorName'],
          order: [['sortOrder', 'ASC']]
        },
        {
          model: ProductVariant,
          as: 'variants',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'sku', 'size', 'color', 'colorCode', 'priceAdjustment', 'stock', 'lowStockThreshold']
        },
        {
          model: ComboItem,
          as: 'comboItems',
          required: false,
          include: [{
            model: Product,
            as: 'childProduct',
            attributes: ['id', 'name', 'slug', 'sku', 'basePrice', 'salePrice'],
            include: [
              { model: ProductImage, as: 'images', attributes: ['id', 'url', 'thumbnailUrl', 'altText', 'isPrimary', 'sortOrder', 'colorName'] },
              { model: ProductVariant, as: 'variants', where: { isActive: true }, required: false, attributes: ['id', 'sku', 'size', 'color', 'colorCode', 'priceAdjustment', 'stock'] }
            ]
          }]
        }
      ],
      order: [
        [{ model: ComboItem, as: 'comboItems' }, 'sortOrder', 'ASC']
      ]
    });

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    // Increment view count asynchronously
    product.increment('viewCount').catch(err => console.error('Failed to update view count:', err));

    return successResponse(res, product, 'Product retrieved successfully');
  } catch (error) {
    console.error('Error fetching product:', error);
    return errorResponse(res, 'Failed to fetch product', 500);
  }
};

/**
 * Get featured products
 * GET /api/products/featured
 */
const getFeaturedProducts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);

    const products = await Product.findAll({
      where: { isActive: true, isFeatured: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
          attributes: ['id', 'url', 'thumbnailUrl', 'altText']
        },
        {
          model: ProductVariant,
          as: 'variants',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'size', 'stock']
        }
      ],
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
      limit
    });

    return successResponse(res, products, 'Featured products retrieved successfully');
  } catch (error) {
    console.error('Error fetching featured products:', error);
    return errorResponse(res, 'Failed to fetch featured products', 500);
  }
};

/**
 * Get new arrival products
 * GET /api/products/new-arrivals
 */
const getNewArrivals = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);

    const products = await Product.findAll({
      where: { isActive: true, isNewArrival: true },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
          attributes: ['id', 'url', 'thumbnailUrl', 'altText']
        },
        {
          model: ProductVariant,
          as: 'variants',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'size', 'stock']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit
    });

    return successResponse(res, products, 'New arrivals retrieved successfully');
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    return errorResponse(res, 'Failed to fetch new arrivals', 500);
  }
};

/**
 * Create a new product (Admin only)
 * POST /api/products
 */
const createProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      categoryId,
      name,
      sku,
      description,
      shortDescription,
      basePrice,
      salePrice,
      costPrice,
      fabric,
      careInstructions,
      sizeChart,
      isFeatured,
      isNewArrival,
      isActive,
      sortOrder,
      metaTitle,
      metaDescription,
      images,
      variants,
      isCombo,
      comboItems
    } = req.body;

    // Generate slug from name
    let slug = generateSlug(name);

    // Check if slug already exists
    const existingSlug = await Product.findOne({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Check if SKU already exists
    const existingSku = await Product.findOne({ where: { sku } });
    if (existingSku) {
      await transaction.rollback();
      return errorResponse(res, 'SKU already exists', 400);
    }

    // Create product
    const product = await Product.create({
      categoryId,
      name,
      slug,
      sku,
      description,
      shortDescription,
      basePrice,
      salePrice,
      costPrice,
      fabric,
      careInstructions,
      sizeChart,
      isFeatured: isFeatured || false,
      isNewArrival: isNewArrival || false,
      isActive: isActive !== false,
      isCombo: isCombo || false,
      sortOrder: sortOrder || 0,
      metaTitle,
      metaDescription
    }, { transaction });

    // Create product images
    if (images && images.length > 0) {
      const imageRecords = images.map((img, index) => ({
        productId: product.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        altText: img.altText || name,
        isPrimary: img.isPrimary || index === 0,
        sortOrder: img.sortOrder || index,
        colorName: img.colorName || null
      }));
      await ProductImage.bulkCreate(imageRecords, { transaction });
    }

    // Create product variants (skip for combo products)
    if (!isCombo && variants && variants.length > 0) {
      const variantRecords = variants.map(variant => ({
        productId: product.id,
        sku: variant.sku || `${sku}-${variant.size}-${variant.color || 'DEF'}`.toUpperCase(),
        size: variant.size,
        color: variant.color,
        colorCode: variant.colorCode,
        priceAdjustment: variant.priceAdjustment || 0,
        stock: variant.stock || 0,
        lowStockThreshold: variant.lowStockThreshold || 5,
        isActive: variant.isActive !== false
      }));
      await ProductVariant.bulkCreate(variantRecords, { transaction });
    }

    // Create combo items if this is a combo product
    if (isCombo && comboItems && comboItems.length > 0) {
      const comboRecords = comboItems.map((item, index) => ({
        comboProductId: product.id,
        childProductId: item.childProductId,
        quantity: item.quantity || 1,
        label: item.label || null,
        sortOrder: item.sortOrder ?? index
      }));
      await ComboItem.bulkCreate(comboRecords, { transaction });
    }

    await transaction.commit();

    // Fetch complete product with associations
    const includeList = [
      { model: Category, as: 'category' },
      { model: ProductImage, as: 'images' },
      { model: ProductVariant, as: 'variants' }
    ];
    if (isCombo) {
      includeList.push({
        model: ComboItem,
        as: 'comboItems',
        include: [{
          model: Product,
          as: 'childProduct',
          attributes: ['id', 'name', 'slug', 'sku', 'basePrice', 'salePrice'],
          include: [
            { model: ProductImage, as: 'images' },
            { model: ProductVariant, as: 'variants', where: { isActive: true }, required: false }
          ]
        }]
      });
    }
    const completeProduct = await Product.findByPk(product.id, {
      include: includeList
    });

    return successResponse(res, completeProduct, 'Product created successfully', 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating product:', error);
    return errorResponse(res, 'Failed to create product', 500);
  }
};

/**
 * Update a product (Admin only)
 * PUT /api/products/:id
 */
const updateProduct = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      await transaction.rollback();
      return errorResponse(res, 'Product not found', 404);
    }

    // Handle slug update if name changed
    if (updateData.name && updateData.name !== product.name) {
      let newSlug = generateSlug(updateData.name);
      const existingSlug = await Product.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } }
      });
      if (existingSlug) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
      updateData.slug = newSlug;
    }

    // Check SKU uniqueness if changing
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingSku = await Product.findOne({
        where: { sku: updateData.sku, id: { [Op.ne]: id } }
      });
      if (existingSku) {
        await transaction.rollback();
        return errorResponse(res, 'SKU already exists', 400);
      }
    }

    // Update product fields
    await product.update(updateData, { transaction });

    // Update images if provided
    if (updateData.images) {
      await ProductImage.destroy({ where: { productId: id }, transaction });
      if (updateData.images.length > 0) {
        const imageRecords = updateData.images.map((img, index) => ({
          productId: id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          altText: img.altText || product.name,
          isPrimary: img.isPrimary || index === 0,
          sortOrder: img.sortOrder || index,
          colorName: img.colorName || null
        }));
        await ProductImage.bulkCreate(imageRecords, { transaction });
      }
    }

    // Update variants if provided (skip for combo products)
    const productIsCombo = updateData.isCombo !== undefined ? updateData.isCombo : product.isCombo;
    if (!productIsCombo && updateData.variants) {
      await ProductVariant.destroy({ where: { productId: id }, transaction });
      if (updateData.variants.length > 0) {
        const variantRecords = updateData.variants.map(variant => ({
          productId: id,
          sku: variant.sku || `${product.sku}-${variant.size}-${variant.color || 'DEF'}`.toUpperCase(),
          size: variant.size,
          color: variant.color,
          colorCode: variant.colorCode,
          priceAdjustment: variant.priceAdjustment || 0,
          stock: variant.stock || 0,
          lowStockThreshold: variant.lowStockThreshold || 5,
          isActive: variant.isActive !== false
        }));
        await ProductVariant.bulkCreate(variantRecords, { transaction });
      }
    }

    // Update combo items if this is a combo product
    if (productIsCombo && updateData.comboItems) {
      await ComboItem.destroy({ where: { comboProductId: id }, transaction });
      if (updateData.comboItems.length > 0) {
        const comboRecords = updateData.comboItems.map((item, index) => ({
          comboProductId: id,
          childProductId: item.childProductId,
          quantity: item.quantity || 1,
          label: item.label || null,
          sortOrder: item.sortOrder ?? index
        }));
        await ComboItem.bulkCreate(comboRecords, { transaction });
      }
    }

    await transaction.commit();

    // Fetch updated product with associations
    const includeList = [
      { model: Category, as: 'category' },
      { model: ProductImage, as: 'images' },
      { model: ProductVariant, as: 'variants' }
    ];
    if (productIsCombo) {
      includeList.push({
        model: ComboItem,
        as: 'comboItems',
        include: [{
          model: Product,
          as: 'childProduct',
          attributes: ['id', 'name', 'slug', 'sku', 'basePrice', 'salePrice'],
          include: [
            { model: ProductImage, as: 'images' },
            { model: ProductVariant, as: 'variants', where: { isActive: true }, required: false }
          ]
        }]
      });
    }
    const updatedProduct = await Product.findByPk(id, {
      include: includeList
    });

    return successResponse(res, updatedProduct, 'Product updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating product:', error);
    return errorResponse(res, 'Failed to update product', 500);
  }
};

/**
 * Delete a product (Admin only) - Soft delete by setting isActive to false
 * DELETE /api/products/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const product = await Product.findByPk(id);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    if (permanent === 'true') {
      // Hard delete - removes from database
      await ProductImage.destroy({ where: { productId: id } });
      await ProductVariant.destroy({ where: { productId: id } });
      await ComboItem.destroy({ where: { comboProductId: id } });
      // Also remove this product from any combos it's a child of
      await ComboItem.destroy({ where: { childProductId: id } });
      await product.destroy();
      return successResponse(res, null, 'Product permanently deleted');
    } else {
      // Soft delete - just mark as inactive
      await product.update({ isActive: false });
      return successResponse(res, null, 'Product deactivated successfully');
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    return errorResponse(res, 'Failed to delete product', 500);
  }
};

/**
 * Get related products
 * GET /api/products/:id/related
 */
const getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 4, 12);

    const product = await Product.findByPk(id);
    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const relatedProducts = await Product.findAll({
      where: {
        categoryId: product.categoryId,
        id: { [Op.ne]: id },
        isActive: true
      },
      include: [
        {
          model: ProductImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
          attributes: ['id', 'url', 'thumbnailUrl', 'altText']
        },
        {
          model: ProductVariant,
          as: 'variants',
          where: { isActive: true },
          required: false,
          attributes: ['id', 'size', 'stock']
        }
      ],
      order: sequelize.random(),
      limit
    });

    return successResponse(res, relatedProducts, 'Related products retrieved successfully');
  } catch (error) {
    console.error('Error fetching related products:', error);
    return errorResponse(res, 'Failed to fetch related products', 500);
  }
};

/**
 * Get all products for admin (including inactive)
 * GET /api/admin/products
 */
const getAdminProducts = async (req, res) => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const { sortBy, sortOrder } = getSortParams(req.query, ['createdAt', 'name', 'basePrice', 'stock', 'soldCount']);
    const { search, category, status } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: ProductImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
          attributes: ['id', 'url', 'thumbnailUrl']
        },
        {
          model: ProductVariant,
          as: 'variants',
          attributes: ['id', 'size', 'stock']
        }
      ],
      order: [[sortBy, sortOrder]],
      limit,
      offset,
      distinct: true
    });

    // Calculate total stock for each product (combos don't have their own stock)
    const productsWithStock = products.map(p => {
      const productData = p.toJSON();
      productData.totalStock = productData.isCombo ? null : (productData.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0);
      return productData;
    });

    return paginatedResponse(res, productsWithStock, { page, limit, total: count }, 'Products retrieved successfully');
  } catch (error) {
    console.error('Error fetching admin products:', error);
    return errorResponse(res, 'Failed to fetch products', 500);
  }
};

module.exports = {
  getAllProducts,
  getProductBySlug,
  getFeaturedProducts,
  getNewArrivals,
  createProduct,
  updateProduct,
  deleteProduct,
  getRelatedProducts,
  getAdminProducts
};
