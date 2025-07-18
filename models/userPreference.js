/**
 * UserPreference Model
 * Represents user preferences and settings
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const User = require('./user');

const UserPreference = sequelize.define('UserPreference', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: User,
      key: 'id'
    }
  },
  preferenceKey: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'preference_key'
  },
  preferenceValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'preference_value'
  }
}, {
  tableName: 'user_preferences',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'preference_key']
    }
  ]
});

// Define association with User
UserPreference.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(UserPreference, { foreignKey: 'userId' });

module.exports = UserPreference;
