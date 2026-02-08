const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderComboSelection = sequelize.define('OrderComboSelection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'order_item_id',
      references: {
        model: 'order_items',
        key: 'id'
      }
    },
    comboItemId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'combo_item_id',
      references: {
        model: 'combo_items',
        key: 'id'
      }
    },
    childProductId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'child_product_id',
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
      allowNull: true,
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
      defaultValue: 1
    }
  }, {
    tableName: 'order_combo_selections',
    timestamps: true,
    underscored: true
  });

  return OrderComboSelection;
};
