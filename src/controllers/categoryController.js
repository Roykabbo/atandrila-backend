const { Op } = require('sequelize');
const { Category, Product, ProductImage, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response.utils');
const { generateSlug } = require('../utils/helpers');

/**
 * Get all categories (with optional tree structure)
 * GET /api/categories
 */
const getAllCategories = async (req, res) => {
  try {
    const { tree, includeInactive } = req.query;

    const where = {};
    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    // If tree=true, return hierarchical structure
    if (tree === 'true') {
      // Get parent categories first
      const parentCategories = await Category.findAll({
        where: { ...where, parentId: null },
        include: [
          {
            model: Category,
            as: 'children',
            where: includeInactive !== 'true' ? { isActive: true } : {},
            required: false,
            attributes: ['id', 'name', 'slug', 'image', 'sortOrder', 'isActive']
          }
        ],
        order: [
          ['sortOrder', 'ASC'],
          ['name', 'ASC'],
          [{ model: Category, as: 'children' }, 'sortOrder', 'ASC']
        ],
        attributes: ['id', 'name', 'slug', 'description', 'image', 'bannerImage', 'sortOrder', 'isActive']
      });

      return successResponse(res, parentCategories, 'Categories retrieved successfully');
    }

    // Flat list of all categories
    const categories = await Category.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        }
      ],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      attributes: ['id', 'name', 'slug', 'description', 'image', 'bannerImage', 'parentId', 'sortOrder', 'isActive']
    });

    return successResponse(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Error fetching categories:', error);
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
};

/**
 * Get category by slug or ID with products
 * GET /api/categories/:identifier
 */
const getCategoryBySlug = async (req, res) => {
  try {
    const { identifier } = req.params;
    const { includeProducts, limit = 12, page = 1 } = req.query;

    // Determine if identifier is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const where = isUUID ? { id: identifier } : { slug: identifier };
    where.isActive = true;

    const categoryInclude = [
      {
        model: Category,
        as: 'parent',
        attributes: ['id', 'name', 'slug']
      },
      {
        model: Category,
        as: 'children',
        where: { isActive: true },
        required: false,
        attributes: ['id', 'name', 'slug', 'image', 'sortOrder']
      }
    ];

    // Include products if requested
    if (includeProducts === 'true') {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      categoryInclude.push({
        model: Product,
        as: 'products',
        where: { isActive: true },
        required: false,
        limit: parseInt(limit),
        offset,
        include: [
          {
            model: ProductImage,
            as: 'images',
            where: { isPrimary: true },
            required: false,
            attributes: ['id', 'url', 'thumbnailUrl', 'altText']
          }
        ],
        attributes: ['id', 'name', 'slug', 'basePrice', 'salePrice', 'isFeatured', 'isNewArrival']
      });
    }

    const category = await Category.findOne({
      where,
      include: categoryInclude,
      attributes: ['id', 'name', 'slug', 'description', 'image', 'bannerImage', 'parentId', 'metaTitle', 'metaDescription']
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Get product count for this category
    const productCount = await Product.count({
      where: { categoryId: category.id, isActive: true }
    });

    const result = category.toJSON();
    result.productCount = productCount;

    return successResponse(res, result, 'Category retrieved successfully');
  } catch (error) {
    console.error('Error fetching category:', error);
    return errorResponse(res, 'Failed to fetch category', 500);
  }
};

/**
 * Create a new category (Admin only)
 * POST /api/categories
 */
const createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      bannerImage,
      parentId,
      sortOrder,
      isActive,
      metaTitle,
      metaDescription
    } = req.body;

    // Generate slug from name
    let slug = generateSlug(name);

    // Check if slug already exists
    const existingSlug = await Category.findOne({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Validate parent category if provided
    if (parentId) {
      const parentCategory = await Category.findByPk(parentId);
      if (!parentCategory) {
        return errorResponse(res, 'Parent category not found', 400);
      }
      // Prevent deep nesting (only 2 levels allowed)
      if (parentCategory.parentId) {
        return errorResponse(res, 'Categories can only be nested one level deep', 400);
      }
    }

    const category = await Category.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      parentId: parentId || null,
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
      metaTitle,
      metaDescription
    });

    return successResponse(res, category, 'Category created successfully', 201);
  } catch (error) {
    console.error('Error creating category:', error);
    return errorResponse(res, 'Failed to create category', 500);
  }
};

/**
 * Update a category (Admin only)
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Handle slug update if name changed
    if (updateData.name && updateData.name !== category.name) {
      let newSlug = generateSlug(updateData.name);
      const existingSlug = await Category.findOne({
        where: { slug: newSlug, id: { [Op.ne]: id } }
      });
      if (existingSlug) {
        newSlug = `${newSlug}-${Date.now()}`;
      }
      updateData.slug = newSlug;
    }

    // Validate parent category if changing
    if (updateData.parentId !== undefined) {
      if (updateData.parentId === id) {
        return errorResponse(res, 'Category cannot be its own parent', 400);
      }
      if (updateData.parentId) {
        const parentCategory = await Category.findByPk(updateData.parentId);
        if (!parentCategory) {
          return errorResponse(res, 'Parent category not found', 400);
        }
        if (parentCategory.parentId) {
          return errorResponse(res, 'Categories can only be nested one level deep', 400);
        }
      }
    }

    await category.update(updateData);

    // Fetch updated category with relations
    const updatedCategory = await Category.findByPk(id, {
      include: [
        { model: Category, as: 'parent', attributes: ['id', 'name', 'slug'] },
        { model: Category, as: 'children', attributes: ['id', 'name', 'slug'] }
      ]
    });

    return successResponse(res, updatedCategory, 'Category updated successfully');
  } catch (error) {
    console.error('Error updating category:', error);
    return errorResponse(res, 'Failed to update category', 500);
  }
};

/**
 * Delete a category (Admin only)
 * DELETE /api/categories/:id
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;

    const category = await Category.findByPk(id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Check if category has children
    const childrenCount = await Category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return errorResponse(res, 'Cannot delete category with subcategories. Delete subcategories first.', 400);
    }

    // Check if category has products
    const productCount = await Product.count({ where: { categoryId: id } });
    if (productCount > 0 && force !== 'true') {
      return errorResponse(res, `Category has ${productCount} products. Use force=true to delete anyway or reassign products first.`, 400);
    }

    if (force === 'true') {
      // Hard delete
      await category.destroy();
      return successResponse(res, null, 'Category permanently deleted');
    } else {
      // Soft delete
      await category.update({ isActive: false });
      return successResponse(res, null, 'Category deactivated successfully');
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    return errorResponse(res, 'Failed to delete category', 500);
  }
};

/**
 * Get all categories for admin (including inactive)
 * GET /api/admin/categories
 */
const getAdminCategories = async (req, res) => {
  try {
    const { search, parent } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } }
      ];
    }

    if (parent === 'root') {
      where.parentId = null;
    } else if (parent) {
      where.parentId = parent;
    }

    const categories = await Category.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'parent',
          attributes: ['id', 'name', 'slug']
        },
        {
          model: Category,
          as: 'children',
          attributes: ['id', 'name', 'slug', 'isActive']
        }
      ],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });

    // Add product count for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const catData = cat.toJSON();
        catData.productCount = await Product.count({ where: { categoryId: cat.id } });
        return catData;
      })
    );

    return successResponse(res, categoriesWithCounts, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Error fetching admin categories:', error);
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
};

/**
 * Reorder categories (Admin only)
 * PUT /api/categories/reorder
 */
const reorderCategories = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { categories } = req.body; // Array of { id, sortOrder }

    if (!Array.isArray(categories)) {
      await transaction.rollback();
      return errorResponse(res, 'Categories must be an array', 400);
    }

    for (const cat of categories) {
      await Category.update(
        { sortOrder: cat.sortOrder },
        { where: { id: cat.id }, transaction }
      );
    }

    await transaction.commit();
    return successResponse(res, null, 'Categories reordered successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error reordering categories:', error);
    return errorResponse(res, 'Failed to reorder categories', 500);
  }
};

module.exports = {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminCategories,
  reorderCategories
};
