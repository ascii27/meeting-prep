const NodeCache = require('node-cache');
const documentService = require('./documentService');
const openaiService = require('./openaiService');

// Initialize cache with 1 hour TTL by default
const prepCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });

/**
 * Generate a cache key for meeting preparation data
 * @param {string} meetingId - Meeting ID
 * @returns {string} - Cache key
 */
function getPrepCacheKey(meetingId) {
  return `prep:${meetingId}`;
}

/**
 * Clear preparation cache for a meeting
 * @param {string} meetingId - Meeting ID
 */
function clearPrepCache(meetingId) {
  const cacheKey = getPrepCacheKey(meetingId);
  prepCache.del(cacheKey);
  // Also clear OpenAI analysis cache
  openaiService.clearMeetingCache(meetingId);
}

/**
 * Prepare meeting materials by analyzing associated documents
 * @param {string} meetingId - Meeting ID (event ID)
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Object>} - Meeting preparation materials
 */
async function prepareMeetingMaterials(meetingId, tokens) {
  const cacheKey = getPrepCacheKey(meetingId);
  
  // Check cache first
  const cachedPrep = prepCache.get(cacheKey);
  if (cachedPrep) {
    return cachedPrep;
  }
  
  try {
    // Get documents for the meeting
    const event = { id: meetingId }; // Minimal event object with ID
    const documents = await documentService.getDocumentsForEvent(event, tokens);
    
    if (!documents || documents.length === 0) {
      return {
        summary: "No documents available for this meeting.",
        topics: [],
        suggestions: ["Review the meeting invitation for context."],
        documents: []
      };
    }
    
    // Process each document and collect analyses
    const documentAnalyses = await Promise.all(
      documents.map(async (doc) => {
        // Get document content
        const documentContent = await documentService.getDocumentContent(doc.id, tokens);
        
        if (!documentContent || !documentContent.content) {
          return {
            documentId: doc.id,
            title: doc.title,
            analysis: null
          };
        }
        
        // Analyze document content
        const analysis = await openaiService.analyzeDocumentForMeeting(
          documentContent.content,
          doc.id,
          meetingId
        );
        
        return {
          documentId: doc.id,
          title: doc.title,
          analysis
        };
      })
    );
    
    // Filter out documents with failed analysis
    const validAnalyses = documentAnalyses.filter(doc => doc.analysis !== null);
    
    if (validAnalyses.length === 0) {
      return {
        summary: "Could not analyze documents for this meeting.",
        topics: [],
        suggestions: ["Review the meeting documents manually."],
        documents: documents.map(doc => ({ id: doc.id, title: doc.title }))
      };
    }
    
    // Combine analyses from multiple documents if needed
    let combinedPrep;
    if (validAnalyses.length === 1) {
      // Single document case
      const doc = validAnalyses[0];
      combinedPrep = {
        summary: doc.analysis.summary,
        topics: doc.analysis.topics,
        suggestions: doc.analysis.suggestions,
        documents: documents.map(doc => ({ id: doc.id, title: doc.title }))
      };
    } else {
      // Multiple documents case - combine insights
      const allTopics = validAnalyses.flatMap(doc => doc.analysis.topics);
      const allSuggestions = validAnalyses.flatMap(doc => doc.analysis.suggestions);
      
      // Deduplicate topics and suggestions
      const uniqueTopics = [...new Set(allTopics)];
      const uniqueSuggestions = [...new Set(allSuggestions)];
      
      // Create a combined summary
      const documentSummaries = validAnalyses.map(doc => 
        `${doc.title}: ${doc.analysis.summary}`
      ).join('\n\n');
      
      combinedPrep = {
        summary: documentSummaries,
        topics: uniqueTopics,
        suggestions: uniqueSuggestions,
        documents: documents.map(doc => ({ id: doc.id, title: doc.title }))
      };
    }
    
    // Cache the result
    prepCache.set(cacheKey, combinedPrep);
    
    return combinedPrep;
  } catch (error) {
    console.error('Error preparing meeting materials:', error);
    throw new Error('Failed to prepare meeting materials');
  }
}

/**
 * Store user notes for a meeting
 * @param {string} meetingId - Meeting ID
 * @param {string} notes - User notes
 * @returns {boolean} - Success status
 */
function saveUserNotes(meetingId, notes) {
  try {
    const cacheKey = `notes:${meetingId}`;
    prepCache.set(cacheKey, notes);
    return true;
  } catch (error) {
    console.error('Error saving user notes:', error);
    return false;
  }
}

/**
 * Get user notes for a meeting
 * @param {string} meetingId - Meeting ID
 * @returns {string|null} - User notes or null if not found
 */
function getUserNotes(meetingId) {
  try {
    const cacheKey = `notes:${meetingId}`;
    return prepCache.get(cacheKey) || null;
  } catch (error) {
    console.error('Error getting user notes:', error);
    return null;
  }
}

module.exports = {
  prepareMeetingMaterials,
  saveUserNotes,
  getUserNotes,
  clearPrepCache
};
