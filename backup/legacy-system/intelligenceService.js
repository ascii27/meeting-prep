/**
 * Intelligence Service
 * Coordinates between different intelligence components and provides a unified interface
 */
const graphDatabaseService = require('./intelligence/graph/graphDatabaseService');
const calendarProcessingService = require('./intelligence/calendar/calendarProcessingService');
const catalogingWorker = require('./intelligence/worker/catalogingWorker');

class IntelligenceService {
  constructor() {
    // Default configuration
    this.config = {
      historicalDataLimitMonths: 1 // Default to 1 month of historical data
    };
  }

  /**
   * Initialize the intelligence service
   * @param {Object} config - Service configuration
   */
  initialize(config = {}) {
    this.config = {
      ...this.config,
      ...config
    };

    return graphDatabaseService.initialize();
  }

  /**
   * Start asynchronous processing of a user's calendar data
   * @param {Object} userTokens - User's OAuth tokens
   * @param {Object} user - User information
   * @returns {Promise<Object>} - Processing status
   */
  async startCalendarProcessing(userTokens, user) {
    return catalogingWorker.processCalendarData(userTokens, user, {
      monthsBack: this.config.historicalDataLimitMonths
    });
  }

  /**
   * Get the current processing status
   * @returns {Object} - Current processing status
   */
  getProcessingStatus() {
    return catalogingWorker.getProcessingStatus();
  }

  /**
   * Get recent meetings
   * @param {number} limit - Maximum number of meetings to return
   * @returns {Promise<Array>} - List of recent meetings
   */
  async getRecentMeetings(limit = 10) {
    return graphDatabaseService.getRecentMeetings(limit);
  }

  /**
   * Get meeting participants
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} - List of meeting participants
   */
  async getMeetingParticipants(meetingId) {
    return graphDatabaseService.getMeetingParticipants(meetingId);
  }

  /**
   * Get meetings for a person
   * @param {string} email - Person's email
   * @param {number} limit - Maximum number of meetings to return
   * @returns {Promise<Array>} - List of meetings
   */
  async getMeetingsForPerson(email, limit = 10) {
    return graphDatabaseService.getMeetingsForPerson(email, limit);
  }

  /**
   * Close connections
   */
  async close() {
    return graphDatabaseService.close();
  }
}

module.exports = new IntelligenceService();
