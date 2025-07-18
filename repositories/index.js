/**
 * Repositories Index
 * Exports all repositories
 */
const userRepository = require('./userRepository');
const meetingRepository = require('./meetingRepository');
const meetingSummaryRepository = require('./meetingSummaryRepository');
const preparationNoteRepository = require('./preparationNoteRepository');
const userPreferenceRepository = require('./userPreferenceRepository');

module.exports = {
  userRepository,
  meetingRepository,
  meetingSummaryRepository,
  preparationNoteRepository,
  userPreferenceRepository
};
