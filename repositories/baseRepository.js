/**
 * Base Repository
 * Provides common CRUD operations for all models
 */
class BaseRepository {
  /**
   * Create a new repository instance
   * @param {Object} model - Sequelize model
   */
  constructor(model) {
    this.model = model;
  }

  /**
   * Create a new record
   * @param {Object} data - Data to create
   * @returns {Promise<Object>} - Created record
   */
  async create(data) {
    try {
      return await this.model.create(data);
    } catch (error) {
      console.error(`Error creating ${this.model.name}:`, error);
      throw error;
    }
  }

  /**
   * Find a record by ID
   * @param {string} id - Record ID
   * @param {Object} options - Additional options (include, attributes, etc.)
   * @returns {Promise<Object|null>} - Found record or null
   */
  async findById(id, options = {}) {
    try {
      return await this.model.findByPk(id, options);
    } catch (error) {
      console.error(`Error finding ${this.model.name} by ID:`, error);
      throw error;
    }
  }

  /**
   * Find all records matching the criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Additional options (include, attributes, etc.)
   * @returns {Promise<Array>} - Array of found records
   */
  async findAll(criteria = {}, options = {}) {
    try {
      return await this.model.findAll({
        where: criteria,
        ...options
      });
    } catch (error) {
      console.error(`Error finding ${this.model.name} records:`, error);
      throw error;
    }
  }

  /**
   * Find one record matching the criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Additional options (include, attributes, etc.)
   * @returns {Promise<Object|null>} - Found record or null
   */
  async findOne(criteria, options = {}) {
    try {
      return await this.model.findOne({
        where: criteria,
        ...options
      });
    } catch (error) {
      console.error(`Error finding ${this.model.name} record:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Updated record
   */
  async update(id, data) {
    try {
      const record = await this.findById(id);
      if (!record) {
        throw new Error(`${this.model.name} with ID ${id} not found`);
      }
      return await record.update(data);
    } catch (error) {
      console.error(`Error updating ${this.model.name}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} - True if deleted, false otherwise
   */
  async delete(id) {
    try {
      const record = await this.findById(id);
      if (!record) {
        return false;
      }
      await record.destroy();
      return true;
    } catch (error) {
      console.error(`Error deleting ${this.model.name}:`, error);
      throw error;
    }
  }

  /**
   * Count records matching the criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<number>} - Count of matching records
   */
  async count(criteria = {}) {
    try {
      return await this.model.count({
        where: criteria
      });
    } catch (error) {
      console.error(`Error counting ${this.model.name} records:`, error);
      throw error;
    }
  }
}

module.exports = BaseRepository;
