/**
 * Preparation Note Repository
 * Handles database operations for PreparationNote model
 */
const BaseRepository = require('./baseRepository');
const { PreparationNote, Meeting, User } = require('../models');

class PreparationNoteRepository extends BaseRepository {
  constructor() {
    super(PreparationNote);
  }

  /**
   * Find notes for a specific meeting
   * @param {string} meetingId - Meeting ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of notes
   */
  async findByMeetingId(meetingId, options = {}) {
    try {
      return await this.findAll(
        { meetingId },
        { 
          order: [['created_at', 'DESC']],
          ...options
        }
      );
    } catch (error) {
      console.error('Error finding notes by meeting ID:', error);
      throw error;
    }
  }

  /**
   * Find notes for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of notes
   */
  async findByUserId(userId, options = {}) {
    try {
      return await this.findAll(
        { userId },
        { 
          order: [['created_at', 'DESC']],
          ...options
        }
      );
    } catch (error) {
      console.error('Error finding notes by user ID:', error);
      throw error;
    }
  }

  /**
   * Find notes for a specific meeting and user
   * @param {string} meetingId - Meeting ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of notes
   */
  async findByMeetingAndUser(meetingId, userId) {
    try {
      return await this.findAll(
        { meetingId, userId },
        { order: [['created_at', 'DESC']] }
      );
    } catch (error) {
      console.error('Error finding notes by meeting and user:', error);
      throw error;
    }
  }

  /**
   * Find notes with meeting and user details
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of notes with meeting and user details
   */
  async findWithDetails(criteria = {}) {
    try {
      return await this.findAll(criteria, {
        include: [
          {
            model: Meeting,
            attributes: ['id', 'title', 'startTime', 'endTime']
          },
          {
            model: User,
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      console.error('Error finding notes with details:', error);
      throw error;
    }
  }
}

module.exports = new PreparationNoteRepository();
