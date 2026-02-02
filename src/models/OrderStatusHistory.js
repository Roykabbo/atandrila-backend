const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
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
    status: {
      type: DataTypes.ENUM(
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'refunded'
      ),
      allowNull: false
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    changedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'changed_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'order_status_history',
    timestamps: true,
    underscored: true
  });

  return OrderStatusHistory;
};
