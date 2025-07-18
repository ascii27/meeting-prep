/**
 * PreparationNote Model
 * Represents user-created notes for meeting preparation
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const Meeting = require('./meeting');
const User = require('./user');

const PreparationNote = sequelize.define('PreparationNote', {
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
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'user_id',
    references: {
      model: User,
      key: 'google_id'
    }
  },
  noteText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'note_text'
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_private'
  }
}, {
  tableName: 'preparation_notes',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Define associations
PreparationNote.belongsTo(Meeting, { foreignKey: 'meetingId' });
Meeting.hasMany(PreparationNote, { foreignKey: 'meetingId' });

PreparationNote.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(PreparationNote, { foreignKey: 'userId' });

module.exports = PreparationNote;
