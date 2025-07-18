const NodeCache = require('node-cache');
const documentService = require('./documentService');
const openaiService = require('./openaiService');
const dataStorageService = require('./dataStorageService');
const calendarService = require('./calendarService');

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
  
  // Clear meeting summary cache in data storage service
  console.log(`[MeetingPrepService] Clearing meeting summary cache in data storage service`);
  dataStorageService.clearMeetingSummaryCache(meetingId);
  
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
  try {
    // Debug tokens
    console.log(`[MeetingPrepService] Preparing materials for meeting ${meetingId} with tokens:`, {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      user: tokens.user
    });
    
    // Ensure we have user ID
    if (!tokens.user || !tokens.user.id) {
      console.error('[MeetingPrepService] Missing user ID in tokens');
      tokens.user = tokens.user || {};
      
      // If we have a googleId in the tokens, use that as the user ID
      if (tokens.googleId) {
        console.log(`[MeetingPrepService] Using googleId ${tokens.googleId} as user ID`);
        tokens.user.id = tokens.googleId;
      } else {
        console.log('[MeetingPrepService] No user ID found, using default');
        tokens.user.id = 'default-user'; // Fallback to a default user ID
      }
    }
  } catch (error) {
    console.error('Error preparing meeting materials:', error);
    throw new Error('Failed to prepare meeting materials');
  }
  
  console.log(`[MeetingPrepService] Preparing materials for meeting ${meetingId}`);
  const cacheKey = getPrepCacheKey(meetingId);
  
  // Check cache first
  const cachedPrep = prepCache.get(cacheKey);
  if (cachedPrep) {
    console.log(`[MeetingPrepService] Using cached preparation materials for meeting ${meetingId}`);
    return cachedPrep;
  }
  
  // Check database for existing summary
  console.log(`[MeetingPrepService] Checking database for existing summary for meeting ${meetingId}`);
  try {
    const dbSummary = await dataStorageService.getMeetingSummary(meetingId);
    if (dbSummary) {
      console.log(`[MeetingPrepService] Found summary in database for meeting ${meetingId}`);
      
      // Get event to get document list
      const event = await calendarService.getEventById(meetingId, tokens);
      const documents = event ? await documentService.getDocumentsForEvent(event, tokens) : [];
      
      // Create preparation object from database summary
      const dbPrep = {
        summary: dbSummary.summary,
        summaryHtml: dbSummary.summaryHtml,
        topics: dbSummary.topics || [],
        suggestions: dbSummary.suggestions || [],
        documents: documents.map(doc => ({ id: doc.id, title: doc.title }))
      };
      
      // Cache it for future requests
      prepCache.set(cacheKey, dbPrep);
      
      return dbPrep;
    }
  } catch (dbError) {
    console.error(`[MeetingPrepService] Error checking database for summary:`, dbError);
    // Continue with generating new analysis
  }
  
  console.log(`[MeetingPrepService] No existing materials found, generating new analysis for meeting ${meetingId}`);
  
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
    
    // Store in database via data storage service
    try {
      console.log(`[MeetingPrepService] Storing meeting summary in database for meeting ${meetingId}`);
      // Get the full event details to store the meeting in the database
      const event = await calendarService.getEventById(meetingId, tokens);
      if (event) {
        // Store the meeting in the database
        console.log(`[MeetingPrepService] Storing meeting with user ID: ${tokens.user.id}`);
        await dataStorageService.storeMeetingFromEvent(event, tokens.user.id);
        
        // Store the summary in the database
        // Extract document IDs for reference
        const documentIds = documents.map(doc => doc.id);
        await dataStorageService.storeMeetingSummary(meetingId, combinedPrep, documentIds, tokens.user.id);
      }
    } catch (dbError) {
      // Log error but continue - we still have the cache
      console.error(`[MeetingPrepService] Error storing in database, continuing with cache only:`, dbError);
    }
    
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
 * @param {string} userId - User ID
 * @returns {boolean} - Success status
 */
async function saveUserNotes(meetingId, notes, userId) {
  try {
    // Store in cache
    const cacheKey = `notes:${meetingId}`;
    prepCache.set(cacheKey, notes);
    
    // Store in database if possible
    if (userId) {
      try {
        await dataStorageService.storePreparationNote(meetingId, userId, notes);
      } catch (dbError) {
        console.error('Error saving notes to database:', dbError);
        // Continue with cache only
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error saving user notes:', error);
    return false;
  }
}

/**
 * Get user notes for a meeting
 * @param {string} meetingId - Meeting ID
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - User notes or null if not found
 */
async function getUserNotes(meetingId, userId) {
  try {
    // First check cache
    const cacheKey = `notes:${meetingId}`;
    const cachedNotes = prepCache.get(cacheKey);
    if (cachedNotes) {
      return cachedNotes;
    }
    
    // If not in cache and we have a userId, check database
    if (userId) {
      try {
        const notes = await dataStorageService.getPreparationNotes(meetingId, userId);
        if (notes && notes.length > 0) {
          // Use the most recent note
          const latestNote = notes[0].noteText;
          // Cache it for future requests
          prepCache.set(cacheKey, latestNote);
          return latestNote;
        }
      } catch (dbError) {
        console.error('Error getting notes from database:', dbError);
        // Continue with cache only
      }
    }
    
    return null;
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
