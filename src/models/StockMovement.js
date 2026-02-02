const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StockMovement = sequelize.define('StockMovement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    productVariantId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'product_variant_id',
      references: {
        model: 'product_variants',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('purchase', 'sale', 'return', 'adjustment', 'damage'),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    previousStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'previous_stock'
    },
    newStock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'new_stock'
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    referenceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reference_id'
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'stock_movements',
    timestamps: true,
    underscored: true,
    updatedAt: false
  });

  return StockMovement;
};
