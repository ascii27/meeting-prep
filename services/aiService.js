/**
 * AI Service Router
 * This service routes AI requests to either OpenAI or LiteLLM based on configuration
 */

const aiConfig = require('../config/aiConfig');
const openaiService = require('./openaiService');
const litellmService = require('./litellmService');

// Log initial service configuration
console.log(`[AI Service] Using ${aiConfig.service.toUpperCase()} as the active AI service`);

/**
 * Generate a document summary
 * @param {string} documentContent - Document content to summarize
 * @param {string} documentId - Document ID for caching
 * @param {string} meetingId - Meeting ID for caching
 * @returns {Promise<string>} - Document summary
 */
async function generateSummary(documentContent, documentId, meetingId) {
  // Get current service configuration
  const service = aiConfig.service.toLowerCase();
  
  if (service === 'litellm') {
    return litellmService.generateSummary(documentContent, documentId, meetingId);
  } else {
    return openaiService.generateSummary(documentContent, documentId, meetingId);
  }
}

/**
 * Analyze a document for meeting preparation
 * @param {string} documentContent - Document content to analyze
 * @param {string} documentId - Document ID
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeDocumentForMeeting(documentContent, documentId, meetingId) {
  // Get current service configuration
  const service = aiConfig.service.toLowerCase();
  
  if (service === 'litellm') {
    return litellmService.analyzeDocumentForMeeting(documentContent, documentId, meetingId);
  } else {
    return openaiService.analyzeDocumentForMeeting(documentContent, documentId, meetingId);
  }
}

/**
 * Generate a meeting summary from multiple documents
 * @param {string} meetingTitle - Title of the meeting
 * @param {Array} documentContents - Array of {title, content} objects
 * @returns {Promise<Object>} Meeting summary with key topics and preparation suggestions
 */
async function generateMeetingSummary(meetingTitle, documentContents) {
  // Get current service configuration
  const service = aiConfig.service.toLowerCase();
  
  if (service === 'litellm') {
    return litellmService.generateMeetingSummary(meetingTitle, documentContents);
  } else {
    return openaiService.generateMeetingSummary(meetingTitle, documentContents);
  }
}

/**
 * Generate a comprehensive daily briefing from meeting summaries
 * @param {Object} briefingContext - Context object with date, meetings, and summaries
 * @returns {Promise<Object>} Daily briefing summary
 */
async function generateDailyBriefing(briefingContext) {
  // Get current service configuration
  const service = aiConfig.service.toLowerCase();
  
  if (service === 'litellm') {
    return litellmService.generateDailyBriefing(briefingContext);
  } else {
    return openaiService.generateDailyBriefing(briefingContext);
  }
}

/**
 * Clear cache for a specific meeting
 * @param {string} meetingId - Meeting ID
 */
function clearMeetingCache(meetingId) {
  // Get current service configuration
  const service = aiConfig.service.toLowerCase();
  
  if (service === 'litellm') {
    if (typeof litellmService.clearMeetingCache === 'function') {
      litellmService.clearMeetingCache(meetingId);
    }
  } else {
    openaiService.clearMeetingCache(meetingId);
  }
}

module.exports = {
  generateSummary,
  analyzeDocumentForMeeting,
  generateMeetingSummary,
  generateDailyBriefing,
  clearMeetingCache
};
