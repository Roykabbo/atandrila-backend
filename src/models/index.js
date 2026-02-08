const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    define: dbConfig.define,
    dialectOptions: dbConfig.dialectOptions
  }
);

// Import models
const User = require('./User')(sequelize);
const Category = require('./Category')(sequelize);
const Product = require('./Product')(sequelize);
const ProductImage = require('./ProductImage')(sequelize);
const ProductVariant = require('./ProductVariant')(sequelize);
const Order = require('./Order')(sequelize);
const OrderItem = require('./OrderItem')(sequelize);
const ShippingAddress = require('./ShippingAddress')(sequelize);
const DiscountCode = require('./DiscountCode')(sequelize);
const OrderStatusHistory = require('./OrderStatusHistory')(sequelize);
const StockMovement = require('./StockMovement')(sequelize);
const ComboItem = require('./ComboItem')(sequelize);
const OrderComboSelection = require('./OrderComboSelection')(sequelize);

// Define associations

// Category self-reference (parent-child)
Category.hasMany(Category, { as: 'children', foreignKey: 'parentId' });
Category.belongsTo(Category, { as: 'parent', foreignKey: 'parentId' });

// Category - Product
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

// Product - ProductImage
Product.hasMany(ProductImage, { foreignKey: 'productId', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Product - ProductVariant
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants', onDelete: 'CASCADE' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// User - Order
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Order - OrderItem
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// OrderItem - Product
Product.hasMany(OrderItem, { foreignKey: 'productId', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// OrderItem - ProductVariant
ProductVariant.hasMany(OrderItem, { foreignKey: 'productVariantId', as: 'orderItems' });
OrderItem.belongsTo(ProductVariant, { foreignKey: 'productVariantId', as: 'variant' });

// Order - ShippingAddress
Order.hasOne(ShippingAddress, { foreignKey: 'orderId', as: 'shippingAddress', onDelete: 'CASCADE' });
ShippingAddress.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Order - DiscountCode
DiscountCode.hasMany(Order, { foreignKey: 'discountCodeId', as: 'orders' });
Order.belongsTo(DiscountCode, { foreignKey: 'discountCodeId', as: 'discountCode' });

// Order - OrderStatusHistory
Order.hasMany(OrderStatusHistory, { foreignKey: 'orderId', as: 'statusHistory', onDelete: 'CASCADE' });
OrderStatusHistory.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// User - OrderStatusHistory (changed by)
User.hasMany(OrderStatusHistory, { foreignKey: 'changedBy', as: 'statusChanges' });
OrderStatusHistory.belongsTo(User, { foreignKey: 'changedBy', as: 'changedByUser' });

// ProductVariant - StockMovement
ProductVariant.hasMany(StockMovement, { foreignKey: 'productVariantId', as: 'stockMovements', onDelete: 'CASCADE' });
StockMovement.belongsTo(ProductVariant, { foreignKey: 'productVariantId', as: 'variant' });

// User - StockMovement (created by)
User.hasMany(StockMovement, { foreignKey: 'createdBy', as: 'stockMovements' });
StockMovement.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

// Combo associations
Product.hasMany(ComboItem, { foreignKey: 'comboProductId', as: 'comboItems', onDelete: 'CASCADE' });
ComboItem.belongsTo(Product, { foreignKey: 'comboProductId', as: 'comboProduct' });
ComboItem.belongsTo(Product, { foreignKey: 'childProductId', as: 'childProduct' });

// OrderComboSelection associations
OrderItem.hasMany(OrderComboSelection, { foreignKey: 'orderItemId', as: 'comboSelections', onDelete: 'CASCADE' });
OrderComboSelection.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });
OrderComboSelection.belongsTo(ComboItem, { foreignKey: 'comboItemId', as: 'comboItem' });
OrderComboSelection.belongsTo(Product, { foreignKey: 'childProductId', as: 'childProduct' });
OrderComboSelection.belongsTo(ProductVariant, { foreignKey: 'productVariantId', as: 'variant' });

const db = {
  sequelize,
  Sequelize,
  User,
  Category,
  Product,
  ProductImage,
  ProductVariant,
  Order,
  OrderItem,
  ShippingAddress,
  DiscountCode,
  OrderStatusHistory,
  StockMovement,
  ComboItem,
  OrderComboSelection
};

module.exports = db;
