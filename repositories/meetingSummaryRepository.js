/**
 * Meeting Summary Repository
 * Handles database operations for MeetingSummary model
 */
const BaseRepository = require('./baseRepository');
const { MeetingSummary, Meeting } = require('../models');

class MeetingSummaryRepository extends BaseRepository {
  constructor() {
    super(MeetingSummary);
  }

  /**
   * Find the latest summary for a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object|null>} - Latest summary or null
   */
  async findLatestByMeetingId(meetingId) {
    try {
      return await this.model.findOne({
        where: { meetingId },
        order: [['generated_at', 'DESC']]
      });
    } catch (error) {
      console.error('Error finding latest summary by meeting ID:', error);
      throw error;
    }
  }

  /**
   * Find all summaries for a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} - Array of summaries
   */
  async findAllByMeetingId(meetingId) {
    try {
      return await this.findAll(
        { meetingId },
        { order: [['generated_at', 'DESC']] }
      );
    } catch (error) {
      console.error('Error finding all summaries by meeting ID:', error);
      throw error;
    }
  }

  /**
   * Create a summary from OpenAI analysis
   * @param {string} meetingId - Meeting ID
   * @param {Object} analysisResult - OpenAI analysis result
   * @param {Array} documentIds - Array of document IDs used for analysis
   * @returns {Promise<Object>} - Created summary
   */
  async createFromAnalysis(meetingId, analysisResult, documentIds = []) {
    try {
      return await this.create({
        meetingId,
        summaryText: analysisResult.summary,
        summaryHtml: analysisResult.summaryHtml || analysisResult.summary,
        documentIds,
        generatedAt: new Date()
      });
    } catch (error) {
      console.error('Error creating summary from analysis:', error);
      throw error;
    }
  }

  /**
   * Find summaries with meeting details
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} - Array of summaries with meeting details
   */
  async findWithMeetingDetails(criteria = {}) {
    try {
      return await this.findAll(criteria, {
        include: [
          {
            model: Meeting,
            attributes: ['id', 'title', 'startTime', 'endTime']
          }
        ]
      });
    } catch (error) {
      console.error('Error finding summaries with meeting details:', error);
      throw error;
    }
  }
}

module.exports = new MeetingSummaryRepository();
