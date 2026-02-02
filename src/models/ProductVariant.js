const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductVariant = sequelize.define('ProductVariant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_id',
      references: {
        model: 'products',
        key: 'id'
      }
    },
    sku: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    colorCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'color_code'
    },
    priceAdjustment: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'price_adjustment'
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lowStockThreshold: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      field: 'low_stock_threshold'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'product_variants',
    timestamps: true,
    underscored: true
  });

  return ProductVariant;
};
