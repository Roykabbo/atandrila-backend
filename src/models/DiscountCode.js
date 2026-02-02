const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DiscountCode = sequelize.define('DiscountCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('percentage', 'fixed'),
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    minOrderAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'min_order_amount'
    },
    maxDiscountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'max_discount_amount'
    },
    usageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'usage_limit'
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'used_count'
    },
    perUserLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'per_user_limit'
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'starts_at'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    applicableCategories: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'applicable_categories'
    },
    applicableProducts: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'applicable_products'
    }
  }, {
    tableName: 'discount_codes',
    timestamps: true,
    underscored: true
  });

  return DiscountCode;
};
