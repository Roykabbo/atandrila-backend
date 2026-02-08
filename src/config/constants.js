module.exports = {
  // User roles
  ROLES: {
    ADMIN: 'admin',
    CUSTOMER: 'customer'
  },

  // Order statuses
  ORDER_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
  },

  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  },

  // Payment methods
  PAYMENT_METHODS: {
    COD: 'cod',
    BKASH: 'bkash',
    NAGAD: 'nagad',
    ROCKET: 'rocket'
  },

  // Discount types
  DISCOUNT_TYPES: {
    PERCENTAGE: 'percentage',
    FIXED: 'fixed'
  },

  // Stock movement types
  STOCK_MOVEMENT_TYPES: {
    PURCHASE: 'purchase',
    SALE: 'sale',
    RETURN: 'return',
    ADJUSTMENT: 'adjustment',
    DAMAGE: 'damage'
  },

  // Media settings (images and videos)
  IMAGE: {
    MAX_SIZE: Infinity, // No file size limit
    ALLOWED_TYPES: [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      // Videos
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'
    ],
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'],
    PRODUCT_SIZES: {
      thumbnail: { width: 150, height: 150 },
      small: { width: 300, height: 400 },
      medium: { width: 600, height: 800 },
      large: { width: 1200, height: 1600 }
    },
    CATEGORY_SIZES: {
      thumbnail: { width: 100, height: 100 },
      image: { width: 800, height: 1067 },
      banner: { width: 800, height: 400 }
    }
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 12,
    MAX_LIMIT: 100
  },

  // JWT
  JWT: {
    ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '30m',
    REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d'
  }
};
