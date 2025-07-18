/**
 * Meeting Repository
 * Handles database operations for Meeting model
 */
const BaseRepository = require('./baseRepository');
const { Meeting, User } = require('../models');
const { Op } = require('sequelize');

class MeetingRepository extends BaseRepository {
  constructor() {
    super(Meeting);
  }

  /**
   * Find a meeting by Google Event ID
   * @param {string} googleEventId - Google Event ID
   * @returns {Promise<Object|null>} - Meeting or null
   */
  async findByGoogleEventId(googleEventId) {
    try {
      return await this.findOne({ googleEventId });
    } catch (error) {
      console.error('Error finding meeting by Google Event ID:', error);
      throw error;
    }
  }

  /**
   * Find meetings for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of meetings
   */
  async findByUserId(userId, options = {}) {
    try {
      return await this.findAll({ userId }, options);
    } catch (error) {
      console.error('Error finding meetings by user ID:', error);
      throw error;
    }
  }

  /**
   * Find meetings for a specific user within a date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Array of meetings
   */
  async findByUserIdAndDateRange(userId, startDate, endDate) {
    try {
      return await this.findAll(
        { 
          userId,
          startTime: {
            [Op.between]: [startDate, endDate]
          }
        },
        {
          order: [['start_time', 'ASC']]
        }
      );
    } catch (error) {
      console.error('Error finding meetings by user ID and date range:', error);
      throw error;
    }
  }

  /**
   * Create or update a meeting from Google Calendar event
   * @param {Object} event - Google Calendar event
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Meeting
   */
  async createOrUpdateFromGoogleEvent(event, userId) {
    try {
      if (!userId) {
        console.error('Missing userId in createOrUpdateFromGoogleEvent');
        throw new Error('userId is required for creating or updating a meeting');
      }

      console.log(`Creating/updating meeting with userId: ${userId}`);
      
      const googleEventId = event.id;
      let meeting = await this.findByGoogleEventId(googleEventId);
      
      const meetingData = {
        googleEventId,
        title: event.title || 'Untitled Meeting',
        description: event.description || '',
        startTime: new Date(event.start),
        endTime: new Date(event.end),
        location: event.location || '',
        userId: userId, // Explicitly set userId
        attendees: event.attendees || [],
        attachments: event.attachments || []
      };
      
      console.log('Meeting data prepared:', { 
        googleEventId: meetingData.googleEventId,
        title: meetingData.title,
        userId: meetingData.userId
      });
      
      if (meeting) {
        // Update existing meeting
        return await this.update(meeting.id, meetingData);
      } else {
        // Create new meeting
        return await this.create(meetingData);
      }
    } catch (error) {
      console.error('Error creating or updating meeting from Google event:', error);
      throw error;
    }
  }

  /**
   * Find meetings with user details
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of meetings with user details
   */
  async findWithUserDetails(criteria = {}) {
    try {
      return await this.findAll(criteria, {
        include: [
          {
            model: User,
            attributes: ['id', 'name', 'email']
          }
        ]
      });
    } catch (error) {
      console.error('Error finding meetings with user details:', error);
      throw error;
    }
  }
}

module.exports = new MeetingRepository();
