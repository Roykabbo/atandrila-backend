const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_id',
      references: {
        model: 'orders',
        key: 'id'
      }
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
    productVariantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'product_variant_id',
      references: {
        model: 'product_variants',
        key: 'id'
      }
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'product_name'
    },
    productSku: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'product_sku'
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'unit_price'
    },
    totalPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'total_price'
    }
  }, {
    tableName: 'order_items',
    timestamps: true,
    underscored: true
  });

  return OrderItem;
};
