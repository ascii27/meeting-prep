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
 * @param {boolean} preserveDocumentCache - Whether to preserve document content cache (default: true)
 */
function clearPrepCache(meetingId, preserveDocumentCache = true) {
  console.log(`[MeetingPrepService] Clearing preparation cache for meeting ${meetingId}`);
  
  // Clear preparation cache for this meeting
  const cacheKey = getPrepCacheKey(meetingId);
  prepCache.del(cacheKey);
  
  // Clear OpenAI cache for this meeting
  console.log(`[MeetingPrepService] Clearing OpenAI cache for meeting ${meetingId}`);
  openaiService.clearMeetingCache(meetingId);
  
  // Optionally clear document cache (but by default we preserve it for manual analysis)
  if (!preserveDocumentCache) {
    console.log(`[MeetingPrepService] Clearing document cache for meeting ${meetingId}`);
    // Note: We're not actually clearing the document cache here since we want to preserve
    // recently accessed documents for manual analysis
  } else {
    console.log(`[MeetingPrepService] Preserving document cache for meeting ${meetingId}`);
  }
  
  console.log(`[MeetingPrepService] Cache cleared for meeting ${meetingId}`);
}

/**
 * Prepare meeting materials by analyzing associated documents
 * @param {string} meetingId - Meeting ID (event ID)
 * @param {Object} tokens - OAuth tokens
 * @returns {Promise<Object>} - Meeting preparation materials
 */
async function prepareMeetingMaterials(meetingId, tokens) {
  console.log(`[MeetingPrepService] Preparing materials for meeting ${meetingId}`);
  const cacheKey = getPrepCacheKey(meetingId);
  
  // Check cache first
  const cachedPrep = prepCache.get(cacheKey);
  if (cachedPrep) {
    console.log(`[MeetingPrepService] Using cached preparation materials for meeting ${meetingId}`);
    return cachedPrep;
  }
  
  console.log(`[MeetingPrepService] No cached materials found, generating new analysis for meeting ${meetingId}`);
  
  try {
    // Get documents for the meeting
    console.log(`[MeetingPrepService] Fetching documents for meeting ${meetingId}`);
    const event = { id: meetingId }; // Minimal event object with ID
    const documents = await documentService.getDocumentsForEvent(event, tokens);
    console.log(`[MeetingPrepService] Found ${documents ? documents.length : 0} documents for meeting ${meetingId}`);
    
    if (!documents || documents.length === 0) {
      return {
        summary: "No documents available for this meeting.",
        topics: [],
        suggestions: ["Review the meeting invitation for context."],
        documents: []
      };
    }
    
    // Process each document and collect analyses
    console.log(`[MeetingPrepService] Starting analysis of ${documents.length} documents for meeting ${meetingId}`);
    const documentAnalyses = await Promise.all(
      documents.map(async (doc) => {
        console.log(`[MeetingPrepService] Processing document: ${doc.id} - ${doc.title}`);
        // Get document content
        console.log(`[MeetingPrepService] Fetching content for document ${doc.id}`);
        const documentData = await documentService.getDocumentContent(doc.id, tokens);
        
        console.log(`[MeetingPrepService] Document data received:`, {
          id: documentData?.id,
          hasContent: !!documentData?.content,
          contentType: typeof documentData?.content
        });
        
        if (!documentData || !documentData.content) {
          console.log(`[MeetingPrepService] No content available for document ${doc.id}`);
          return {
            documentId: doc.id,
            title: doc.title,
            analysis: null
          };
        }
        
        // Extract the document content text for analysis
        // Handle both formats: either content is directly a string or it's an object with content property
        let documentContent;
        
        if (typeof documentData.content === 'string') {
          documentContent = documentData.content;
        } else if (documentData.content && typeof documentData.content.content === 'string') {
          documentContent = documentData.content.content;
        } else {
          // Fallback to empty string if no valid content format is found
          console.log(`[MeetingPrepService] Warning: Document content has unexpected format for ${doc.id}`);
          documentContent = 'No content available';
        }
        
        console.log(`[MeetingPrepService] Document content prepared for analysis:`, {
          length: documentContent.length,
          preview: documentContent.substring(0, 100) + '...'
        });
        
        // Analyze document content
        console.log(`[MeetingPrepService] Sending document ${doc.id} to OpenAI for analysis`);
        const analysis = await openaiService.analyzeDocumentForMeeting(
          documentContent,
          doc.id,
          meetingId
        );
        console.log(`[MeetingPrepService] Successfully received analysis for document ${doc.id}`);
        
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
    
    // Cache the results
    console.log(`[MeetingPrepService] Caching preparation results for meeting ${meetingId}`);
    prepCache.set(cacheKey, combinedPrep);
    
    console.log(`[MeetingPrepService] Successfully completed preparation for meeting ${meetingId}`);
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

/**
 * Check if preparation materials exist in cache for a meeting
 * @param {string} meetingId - Meeting ID
 * @returns {boolean} - Whether preparation materials exist
 */
function checkPrepExists(meetingId) {
  const cacheKey = getPrepCacheKey(meetingId);
  return prepCache.has(cacheKey);
}

module.exports = {
  prepareMeetingMaterials,
  saveUserNotes,
  getUserNotes,
  clearPrepCache,
  checkPrepExists
};
