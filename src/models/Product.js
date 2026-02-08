const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'category_id',
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(280),
      allowNull: false,
      unique: true
    },
    sku: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    shortDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'short_description'
    },
    basePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'base_price'
    },
    salePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'sale_price'
    },
    costPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'cost_price'
    },
    fabric: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    careInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'care_instructions'
    },
    sizeChart: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'size_chart'
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_featured'
    },
    isNewArrival: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_new_arrival'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'view_count'
    },
    soldCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sold_count'
    },
    metaTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'meta_title'
    },
    metaDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'meta_description'
    },
    isCombo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_combo'
    }
  }, {
    tableName: 'products',
    timestamps: true,
    underscored: true
  });

  return Product;
};
