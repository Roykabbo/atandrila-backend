const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ComboItem = sequelize.define('ComboItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    comboProductId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'combo_product_id',
      references: {
        model: 'products',
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
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sort_order'
    }
  }, {
    tableName: 'combo_items',
    timestamps: true,
    underscored: true
  });

  return ComboItem;
};
