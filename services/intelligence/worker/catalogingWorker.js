/**
 * Cataloging Worker Service
 * Handles asynchronous processing of meeting data
 */
const calendarProcessingService = require('../calendar/calendarProcessingService');
const graphDatabaseService = require('../graph/graphDatabaseService');
const { v4: uuidv4 } = require('uuid');

class CatalogingWorker {
  constructor() {
    this.isProcessing = false;
    this.processingStatus = {
      inProgress: false,
      startTime: null,
      endTime: null,
      totalEvents: 0,
      processedEvents: 0,
      errors: []
    };
  }

  /**
   * Start processing calendar data for a user
   * @param {Object} userTokens - User's OAuth tokens
   * @param {Object} user - User information
   * @param {Object} options - Processing options
   * @param {number} options.monthsBack - Number of months to look back (default: 1)
   * @returns {Promise<Object>} - Processing status
   */
  async processCalendarData(userTokens, user, options = {}) {
    // Prevent concurrent processing for the same user
    if (this.isProcessing) {
      return { 
        status: 'already_running', 
        message: 'Calendar processing is already in progress',
        processingStatus: this.processingStatus
      };
    }

    try {
      this.isProcessing = true;
      this.processingStatus = {
        inProgress: true,
        startTime: new Date(),
        endTime: null,
        totalEvents: 0,
        processedEvents: 0,
        errors: []
      };

      // Initialize Neo4j connection
      await graphDatabaseService.initialize();

      // Create or update the user as a Person node
      await graphDatabaseService.createPerson({
        id: user.id,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        // Ensure photoUrl is null if not provided
        photoUrl: user.photoUrl || null
      });

      // Get calendar events with time boundaries
      const events = await calendarProcessingService.getCalendarEvents(userTokens, options);
      this.processingStatus.totalEvents = events.length;

      // Process each event
      for (const event of events) {
        try {
          await graphDatabaseService.createMeeting(event);
          this.processingStatus.processedEvents++;
        } catch (error) {
          console.error(`Error processing event ${event.googleEventId}:`, error);
          this.processingStatus.errors.push({
            eventId: event.googleEventId,
            error: error.message
          });
        }
      }

      this.processingStatus.inProgress = false;
      this.processingStatus.endTime = new Date();
      
      return {
        status: 'completed',
        message: `Processed ${this.processingStatus.processedEvents} of ${this.processingStatus.totalEvents} events`,
        processingStatus: this.processingStatus
      };
    } catch (error) {
      console.error('Error in calendar processing:', error);
      this.processingStatus.inProgress = false;
      this.processingStatus.endTime = new Date();
      this.processingStatus.errors.push({
        error: error.message
      });
      
      return {
        status: 'error',
        message: `Error processing calendar data: ${error.message}`,
        processingStatus: this.processingStatus
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the current processing status
   * @returns {Object} - Current processing status
   */
  getProcessingStatus() {
    return this.processingStatus;
  }
}

module.exports = new CatalogingWorker();
