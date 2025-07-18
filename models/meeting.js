/**
 * Meeting Model
 * Represents a calendar meeting event with associated metadata
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const User = require('./user');

const Meeting = sequelize.define('Meeting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true
  },
  googleEventId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'google_event_id'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time'
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id',
    references: {
      model: User,
      key: 'google_id'
    }
  },
  attendees: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: []
  }
}, {
  tableName: 'meetings',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define association with User
Meeting.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Meeting, { foreignKey: 'userId' });

module.exports = Meeting;
