/**
 * User Preference Repository
 * Handles database operations for UserPreference model
 */
const BaseRepository = require('./baseRepository');
const { UserPreference, User } = require('../models');

class UserPreferenceRepository extends BaseRepository {
  constructor() {
    super(UserPreference);
  }

  /**
   * Find all preferences for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of preferences
   */
  async findByUserId(userId) {
    try {
      return await this.findAll({ userId });
    } catch (error) {
      console.error('Error finding preferences by user ID:', error);
      throw error;
    }
  }

  /**
   * Get a specific preference value for a user
   * @param {string} userId - User ID
   * @param {string} preferenceKey - Preference key
   * @returns {Promise<string|null>} - Preference value or null
   */
  async getPreference(userId, preferenceKey) {
    try {
      const preference = await this.findOne({ userId, preferenceKey });
      return preference ? preference.preferenceValue : null;
    } catch (error) {
      console.error('Error getting user preference:', error);
      throw error;
    }
  }

  /**
   * Set a preference value for a user
   * @param {string} userId - User ID
   * @param {string} preferenceKey - Preference key
   * @param {string} preferenceValue - Preference value
   * @returns {Promise<Object>} - Updated or created preference
   */
  async setPreference(userId, preferenceKey, preferenceValue) {
    try {
      const existing = await this.findOne({ userId, preferenceKey });
      
      if (existing) {
        return await this.update(existing.id, { preferenceValue });
      } else {
        return await this.create({
          userId,
          preferenceKey,
          preferenceValue
        });
      }
    } catch (error) {
      console.error('Error setting user preference:', error);
      throw error;
    }
  }

  /**
   * Delete a specific preference for a user
   * @param {string} userId - User ID
   * @param {string} preferenceKey - Preference key
   * @returns {Promise<boolean>} - True if deleted, false otherwise
   */
  async deletePreference(userId, preferenceKey) {
    try {
      const preference = await this.findOne({ userId, preferenceKey });
      if (!preference) {
        return false;
      }
      await preference.destroy();
      return true;
    } catch (error) {
      console.error('Error deleting user preference:', error);
      throw error;
    }
  }
}

module.exports = new UserPreferenceRepository();
