const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShippingAddress = sequelize.define('ShippingAddress', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'order_id',
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    recipientName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'recipient_name'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    alternatePhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'alternate_phone'
    },
    addressLine1: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'address_line_1'
    },
    addressLine2: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'address_line_2'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    district: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'postal_code'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Bangladesh'
    },
    deliveryInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'delivery_instructions'
    }
  }, {
    tableName: 'shipping_addresses',
    timestamps: true,
    underscored: true
  });

  return ShippingAddress;
};
