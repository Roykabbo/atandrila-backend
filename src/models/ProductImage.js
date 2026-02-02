const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductImage = sequelize.define('ProductImage', {
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
    url: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    thumbnailUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'thumbnail_url'
    },
    altText: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'alt_text'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_primary'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    },
    colorName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'color_name'
    }
  }, {
    tableName: 'product_images',
    timestamps: true,
    underscored: true
  });

  return ProductImage;
};
