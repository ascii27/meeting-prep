/**
 * User Repository
 * Handles database operations for User model
 */
const BaseRepository = require('./baseRepository');
const { User } = require('../models');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find a user by Google ID
   * @param {string} googleId - Google ID
   * @returns {Promise<Object|null>} - User or null
   */
  async findByGoogleId(googleId) {
    try {
      return await this.findOne({ googleId });
    } catch (error) {
      console.error('Error finding user by Google ID:', error);
      throw error;
    }
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User or null
   */
  async findByEmail(email) {
    try {
      return await this.findOne({ email });
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Create or update a user from Google profile
   * @param {Object} profile - Google profile
   * @returns {Promise<Object>} - User
   */
  async findOrCreateFromGoogleProfile(profile) {
    try {
      const googleId = profile.id;
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const profilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

      let user = await this.findByGoogleId(googleId);
      
      if (user) {
        // Update existing user
        return await this.update(user.id, {
          name,
          email,
          profilePicture
        });
      } else {
        // Create new user
        return await this.create({
          googleId,
          email,
          name,
          profilePicture
        });
      }
    } catch (error) {
      console.error('Error finding or creating user from Google profile:', error);
      throw error;
    }
  }
}

module.exports = new UserRepository();
