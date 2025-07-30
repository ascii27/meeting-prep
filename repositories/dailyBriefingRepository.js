/**
 * Daily Briefing Repository
 * Handles database operations for DailyBriefing model
 */
const BaseRepository = require('./baseRepository');
const { DailyBriefing, User } = require('../models');
const { Op } = require('sequelize');

class DailyBriefingRepository extends BaseRepository {
  constructor() {
    super(DailyBriefing);
    this.logger = console; // Will be enhanced with proper logger later
  }

  /**
   * Find briefing by user ID and date
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} - Briefing or null
   */
  async findByUserIdAndDate(userId, date) {
    try {
      this.logger.log(`[DailyBriefingRepository] Finding briefing for user ${userId} on date ${date}`);
      
      const briefing = await this.model.findOne({
        where: { 
          userId,
          briefingDate: date
        },
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      this.logger.log(`[DailyBriefingRepository] Found briefing: ${briefing ? briefing.id : 'null'}`);
      return briefing;
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error finding briefing by user ID and date:', error);
      throw error;
    }
  }

  /**
   * Find all briefings for a user within a date range
   * @param {string} userId - User ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of briefings
   */
  async findByUserIdAndDateRange(userId, startDate, endDate) {
    try {
      this.logger.log(`[DailyBriefingRepository] Finding briefings for user ${userId} from ${startDate} to ${endDate}`);
      
      const briefings = await this.model.findAll({
        where: {
          userId,
          briefingDate: {
            [Op.between]: [startDate, endDate]
          }
        },
        order: [['briefing_date', 'DESC']],
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      this.logger.log(`[DailyBriefingRepository] Found ${briefings.length} briefings`);
      return briefings;
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error finding briefings by date range:', error);
      throw error;
    }
  }

  /**
   * Create a new daily briefing
   * @param {Object} briefingData - Briefing data
   * @returns {Promise<Object>} - Created briefing
   */
  async createBriefing(briefingData) {
    try {
      this.logger.log(`[DailyBriefingRepository] Creating briefing for user ${briefingData.userId} on ${briefingData.briefingDate}`);
      
      const briefing = await this.create(briefingData);
      
      this.logger.log(`[DailyBriefingRepository] Created briefing with ID: ${briefing.id}`);
      return briefing;
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error creating briefing:', error);
      throw error;
    }
  }

  /**
   * Update briefing status
   * @param {string} briefingId - Briefing ID
   * @param {string} status - New status
   * @returns {Promise<Object>} - Updated briefing
   */
  async updateStatus(briefingId, status) {
    try {
      this.logger.log(`[DailyBriefingRepository] Updating briefing ${briefingId} status to ${status}`);
      
      const [updatedCount, updatedBriefings] = await this.model.update(
        { status },
        { 
          where: { id: briefingId },
          returning: true
        }
      );

      if (updatedCount === 0) {
        throw new Error(`Briefing with ID ${briefingId} not found`);
      }

      this.logger.log(`[DailyBriefingRepository] Updated briefing status successfully`);
      return updatedBriefings[0];
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error updating briefing status:', error);
      throw error;
    }
  }

  /**
   * Update briefing content
   * @param {string} briefingId - Briefing ID
   * @param {Object} contentData - Content data to update
   * @returns {Promise<Object>} - Updated briefing
   */
  async updateContent(briefingId, contentData) {
    try {
      this.logger.log(`[DailyBriefingRepository] Updating briefing ${briefingId} content`);
      
      const updateData = {
        ...contentData,
        status: 'completed',
        generatedAt: new Date()
      };

      const [updatedCount, updatedBriefings] = await this.model.update(
        updateData,
        { 
          where: { id: briefingId },
          returning: true
        }
      );

      if (updatedCount === 0) {
        throw new Error(`Briefing with ID ${briefingId} not found`);
      }

      this.logger.log(`[DailyBriefingRepository] Updated briefing content successfully`);
      return updatedBriefings[0];
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error updating briefing content:', error);
      throw error;
    }
  }

  /**
   * Delete briefing by ID
   * @param {string} briefingId - Briefing ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteBriefing(briefingId) {
    try {
      this.logger.log(`[DailyBriefingRepository] Deleting briefing ${briefingId}`);
      
      const deletedCount = await this.model.destroy({
        where: { id: briefingId }
      });

      const success = deletedCount > 0;
      this.logger.log(`[DailyBriefingRepository] Briefing deletion ${success ? 'successful' : 'failed'}`);
      return success;
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error deleting briefing:', error);
      throw error;
    }
  }

  /**
   * Find briefings by status
   * @param {string} status - Status to filter by
   * @returns {Promise<Array>} - Array of briefings
   */
  async findByStatus(status) {
    try {
      this.logger.log(`[DailyBriefingRepository] Finding briefings with status: ${status}`);
      
      const briefings = await this.model.findAll({
        where: { status },
        order: [['created_at', 'ASC']],
        include: [{
          model: User,
          attributes: ['id', 'name', 'email']
        }]
      });

      this.logger.log(`[DailyBriefingRepository] Found ${briefings.length} briefings with status ${status}`);
      return briefings;
    } catch (error) {
      this.logger.error('[DailyBriefingRepository] Error finding briefings by status:', error);
      throw error;
    }
  }
}

module.exports = DailyBriefingRepository;
