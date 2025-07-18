/**
 * MeetingSummary Model
 * Represents an AI-generated summary for a meeting
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Meeting = require('./meeting');

const MeetingSummary = sequelize.define('MeetingSummary', {
  id: {
    type: DataTypes.UUID,
    defaultValue: () => uuidv4(),
    primaryKey: true
  },
  meetingId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'meeting_id',
    references: {
      model: Meeting,
      key: 'id'
    }
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
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'generated_at'
  },
  documentIds: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    field: 'document_ids'
  }
}, {
  tableName: 'meeting_summaries',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define association with Meeting
MeetingSummary.belongsTo(Meeting, { foreignKey: 'meetingId' });
Meeting.hasMany(MeetingSummary, { foreignKey: 'meetingId' });

module.exports = MeetingSummary;
