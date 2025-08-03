const NodeCache = require('node-cache');
const documentService = require('./documentService');
const aiService = require('./aiService');
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
  aiService.clearMeetingCache(meetingId);
  
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
 * @param {boolean} forceRefresh - Whether to force fresh analysis, skipping cache and database
 * @returns {Promise<Object>} - Meeting preparation materials
 */
async function prepareMeetingMaterials(meetingId, tokens, forceRefresh = false) {
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
  
  console.log(`[MeetingPrepService] Preparing materials for meeting ${meetingId} (forceRefresh: ${forceRefresh})`);
  const cacheKey = getPrepCacheKey(meetingId);
  
  // Skip cache and database checks if forcing refresh
  if (!forceRefresh) {
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
      console.log(`[MeetingPrepService] Error checking database for summary: ${dbError.message}`);
      // Continue with fresh analysis if database check fails
    }
  } else {
    console.log(`[MeetingPrepService] Skipping cache and database checks due to forceRefresh`);
  }
  
  console.log(`[MeetingPrepService] No existing materials found, generating new analysis for meeting ${meetingId}`);
  
  try {
    // Get the full event object with attachments
    console.log(`[MeetingPrepService] Fetching full event details for meeting ${meetingId}`);
    const event = await calendarService.getEventById(meetingId, tokens);
    if (!event) {
      console.log(`[MeetingPrepService] Event not found: ${meetingId}`);
      return {
        summary: "Meeting event not found.",
        topics: [],
        suggestions: ["Verify the meeting ID and try again."],
        documents: []
      };
    }
    
    // Get documents for the meeting using the full event object
    console.log(`[MeetingPrepService] Fetching documents for meeting ${meetingId}`);
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
          contentType: typeof documentData?.content,
          contentStructure: documentData?.content ? Object.keys(documentData.content).join(',') : 'undefined',
          contentValueType: documentData?.content?.content ? typeof documentData.content.content : 'undefined',
          contentLength: documentData?.content?.content ? documentData.content.content.length : 0,
          rawContentPreview: documentData?.content ? JSON.stringify(documentData.content).substring(0, 200) + '...' : 'undefined'
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
        // The document content structure is: documentData.content = { title, content }
        let documentContent;
        let documentTitle = doc.title; // Default to the doc title we already have
        
        if (documentData.content) {
          // If content is an object with a content property (expected format)
          if (typeof documentData.content.content === 'string') {
            documentContent = documentData.content.content;
            // Update title if available
            if (documentData.content.title) {
              documentTitle = documentData.content.title;
            }
          } 
          // If content is directly a string (unexpected but handle it)
          else if (typeof documentData.content === 'string') {
            documentContent = documentData.content;
          }
          // If content is something else entirely (like [object Object])
          else {
            console.log(`[MeetingPrepService] Warning: Document content has unexpected format for ${doc.id}:`, 
              typeof documentData.content, JSON.stringify(documentData.content).substring(0, 100));
            documentContent = `The provided document '${documentTitle}' appears to be missing or corrupted.`;
          }
        } else {
          // No content at all
          console.log(`[MeetingPrepService] Warning: No document content available for ${doc.id}`);
          documentContent = `No content available for document '${documentTitle}'.`;
        }
        
        console.log(`[MeetingPrepService] Document content prepared for analysis:`, {
          length: documentContent.length,
          preview: documentContent.substring(0, 100) + '...'
        });
        
        // Analyze document content
        console.log(`[MeetingPrepService] Sending document ${doc.id} to AI for analysis`);
        console.log(`[MeetingPrepService] Content being sent to AI:`, {
          type: typeof documentContent,
          length: documentContent ? documentContent.length : 0,
          preview: documentContent ? documentContent.substring(0, 100) + '...' : 'null',
          isString: typeof documentContent === 'string'
        });
        
        const analysis = await aiService.analyzeDocumentForMeeting(
          documentContent,
          doc.id,
          meetingId
        );
        console.log(`[MeetingPrepService] Successfully received analysis for document ${doc.id}`);
        
        return {
          documentId: doc.id,
          title: documentTitle, // Use the potentially updated title from document content
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
    
    // Process document analyses into a combined result
    console.log(`[MeetingPrepService] Combining analyses for ${documentAnalyses.length} documents`);
    
    // Extract document titles for reference
    const documentTitles = documentAnalyses
      .filter(doc => doc && doc.title)
      .map(doc => doc.title);
    
    // Combine all document analyses
    const combinedAnalysis = {
      summary: '',
      topics: [],
      suggestions: [],
      documents: documentAnalyses.map(doc => ({
        id: doc.documentId,
        title: doc.title
      }))
    };
    
    // Log the document analyses structure for debugging
    console.log(`[MeetingPrepService] Document analyses structure:`, 
      documentAnalyses.map(doc => ({
        id: doc.documentId,
        title: doc.title,
        hasAnalysis: !!doc.analysis,
        analysisSummaryLength: doc.analysis?.summary?.length || 0
      })));
    
    // Combine insights from multiple documents if needed
    if (validAnalyses.length === 1) {
      // Single document case
      const doc = validAnalyses[0];
      combinedAnalysis.summary = doc.analysis.summary;
      combinedAnalysis.topics = doc.analysis.topics;
      combinedAnalysis.suggestions = doc.analysis.suggestions;
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
      
      combinedAnalysis.summary = documentSummaries;
      combinedAnalysis.topics = uniqueTopics;
      combinedAnalysis.suggestions = uniqueSuggestions;
    }
    
    // Cache the results
    console.log(`[MeetingPrepService] Caching preparation results for meeting ${meetingId}`);
    prepCache.set(cacheKey, combinedAnalysis);
    
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
        await dataStorageService.storeMeetingSummary(meetingId, combinedAnalysis, documentIds, tokens.user.id);
      }
    } catch (dbError) {
      // Log error but continue - we still have the cache
      console.error(`[MeetingPrepService] Error storing in database, continuing with cache only:`, dbError);
    }
    
    console.log(`[MeetingPrepService] Successfully completed preparation for meeting ${meetingId}`);
    return combinedAnalysis;
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
 * Check if preparation materials exist for a meeting (in cache or database)
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<boolean>} - Whether preparation materials exist
 */
async function checkPrepExists(meetingId) {
  // First check cache
  const cacheKey = getPrepCacheKey(meetingId);
  if (prepCache.has(cacheKey)) {
    console.log(`[MeetingPrepService] Found preparation materials in cache for meeting ${meetingId}`);
    return true;
  }
  
  // If not in cache, check database
  try {
    console.log(`[MeetingPrepService] Checking database for meeting summary ${meetingId}`);
    const dbSummary = await dataStorageService.getMeetingSummary(meetingId);
    if (dbSummary) {
      console.log(`[MeetingPrepService] Found preparation materials in database for meeting ${meetingId}`);
      return true;
    }
  } catch (error) {
    console.error(`[MeetingPrepService] Error checking database for meeting summary:`, error);
  }
  
  console.log(`[MeetingPrepService] No preparation materials found for meeting ${meetingId}`);
  return false;
}

module.exports = {
  prepareMeetingMaterials,
  saveUserNotes,
  getUserNotes,
  clearPrepCache,
  checkPrepExists
};
