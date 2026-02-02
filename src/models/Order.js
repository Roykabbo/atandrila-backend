const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      field: 'order_number'
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    guestEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'guest_email'
    },
    guestPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'guest_phone'
    },
    guestName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'guest_name'
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
      defaultValue: 'pending'
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'discount_amount'
    },
    discountCodeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'discount_code_id',
      references: {
        model: 'discount_codes',
        key: 'id'
      }
    },
    shippingCost: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'shipping_cost'
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    paymentMethod: {
      type: DataTypes.ENUM('cod', 'bkash', 'nagad', 'rocket'),
      allowNull: false,
      field: 'payment_method'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
      defaultValue: 'pending',
      field: 'payment_status'
    },
    paymentTransactionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'payment_transaction_id'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'admin_notes'
    },
    estimatedDelivery: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'estimated_delivery'
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'delivered_at'
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });

  return Order;
};
