/**
 * Models Index
 * Exports all models and establishes associations
 */
const User = require('./user');
const Meeting = require('./meeting');
const MeetingSummary = require('./meetingSummary');
const PreparationNote = require('./preparationNote');
const UserPreference = require('./userPreference');

const { sequelize } = require('../config/database');

// Associations are defined in the individual model files
// This ensures they are set up when the models are imported

// Export all models
module.exports = {
  User,
  Meeting,
  MeetingSummary,
  PreparationNote,
  UserPreference,
  sequelize
};
