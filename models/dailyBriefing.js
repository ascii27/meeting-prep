/**
 * DailyBriefing Model
 * Represents an AI-generated daily briefing for a user's meetings
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const User = require('./user');

const DailyBriefing = sequelize.define('DailyBriefing', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true
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
  briefingDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'briefing_date'
  },
  summaryText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'summary_text'
  },
  summaryHtml: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'summary_html'
  },
  meetingCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'meeting_count'
  },
  peopleOverview: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'people_overview'
  },
  priorityPreparations: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'priority_preparations'
  },
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'generated_at'
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  tableName: 'daily_briefings',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'briefing_date'],
      name: 'daily_briefings_user_date_unique'
    }
  ]
});

// Define association with User
DailyBriefing.belongsTo(User, { 
  foreignKey: 'userId',
  targetKey: 'googleId'
});
User.hasMany(DailyBriefing, { 
  foreignKey: 'userId',
  sourceKey: 'googleId'
});

module.exports = DailyBriefing;
