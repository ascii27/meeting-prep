/**
 * Data Storage Service
 * Provides an interface for storing and retrieving data from both database and cache
 */
const NodeCache = require('node-cache');
const meetingRepository = require('../repositories/meetingRepository');
const meetingSummaryRepository = require('../repositories/meetingSummaryRepository');
const preparationNoteRepository = require('../repositories/preparationNoteRepository');
const userRepository = require('../repositories/userRepository');

// Initialize cache with 1 hour TTL
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * Store meeting summary in database and cache
 * @param {string} meetingId - Meeting ID (Google Calendar Event ID)
 * @param {Object} summary - Summary object
 * @param {Array} documentIds - Document IDs used for the summary
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Stored summary
 */
async function storeMeetingSummary(meetingId, summary, documentIds = [], userId) {
  try {
    console.log(`[DataStorageService] Storing meeting summary for meeting: ${meetingId}`);
    
    // First, find or create the meeting record in the database
    let meeting = await meetingRepository.findByGoogleEventId(meetingId);
    
    // If meeting doesn't exist and we have a userId, try to create it
    if (!meeting && userId) {
      try {
        // Ensure user exists in the database
        await ensureUserExists(userId);
        
        // Create a basic meeting record
        meeting = await meetingRepository.create({
          googleEventId: meetingId,
          title: 'Meeting',
          startTime: new Date(),
          endTime: new Date(),
          userId: userId
        });
        console.log(`[DataStorageService] Created basic meeting record for ID: ${meetingId}`);
      } catch (createError) {
        console.error(`[DataStorageService] Error creating basic meeting record:`, createError);
      }
    }
    
    if (!meeting) {
      console.log(`[DataStorageService] Meeting not found in database, cannot store summary`);
      // We still store in cache even if we can't store in the database
      cache.set(`summary:${meetingId}`, summary);
      return summary;
    }
    
    // Store in database
    const dbSummary = await meetingSummaryRepository.createFromAnalysis(
      meeting.id,
      summary,
      documentIds
    );
    
    // Store in cache
    cache.set(`summary:${meetingId}`, summary);
    
    console.log(`[DataStorageService] Successfully stored meeting summary for meeting: ${meetingId}`);
    return summary;
  } catch (error) {
    console.error(`[DataStorageService] Error storing meeting summary:`, error);
    // Still store in cache even if database fails
    cache.set(`summary:${meetingId}`, summary);
    return summary;
  }
}

/**
 * Get meeting summary from cache or database
 * @param {string} meetingId - Meeting ID (Google Calendar Event ID)
 * @returns {Promise<Object|null>} - Summary object or null
 */
async function getMeetingSummary(meetingId) {
  try {
    console.log(`[DataStorageService] Getting meeting summary for meeting: ${meetingId}`);
    
    // First check cache
    const cachedSummary = cache.get(`summary:${meetingId}`);
    if (cachedSummary) {
      console.log(`[DataStorageService] Found cached summary for meeting: ${meetingId}`);
      return cachedSummary;
    }
    
    // If not in cache, check database
    const meeting = await meetingRepository.findByGoogleEventId(meetingId);
    if (!meeting) {
      console.log(`[DataStorageService] Meeting not found in database: ${meetingId}`);
      return null;
    }
    
    const dbSummary = await meetingSummaryRepository.findLatestByMeetingId(meeting.id);
    if (!dbSummary) {
      console.log(`[DataStorageService] No summary found in database for meeting: ${meetingId}`);
      return null;
    }
    
    // Create summary object from database record
    const summary = {
      summary: dbSummary.summaryText,
      summaryHtml: dbSummary.summaryHtml
    };
    
    // Store in cache for future requests
    cache.set(`summary:${meetingId}`, summary);
    
    console.log(`[DataStorageService] Successfully retrieved meeting summary for meeting: ${meetingId}`);
    return summary;
  } catch (error) {
    console.error(`[DataStorageService] Error getting meeting summary:`, error);
    return null;
  }
}

/**
 * Store preparation note in database
 * @param {string} meetingId - Meeting ID (Google Calendar Event ID)
 * @param {string} userId - User ID
 * @param {string} noteText - Note text
 * @param {boolean} isPrivate - Whether the note is private
 * @returns {Promise<Object|null>} - Created note or null
 */
async function storePreparationNote(meetingId, userId, noteText, isPrivate = true) {
  try {
    console.log(`[DataStorageService] Storing preparation note for meeting: ${meetingId}`);
    
    // Find meeting in database
    const meeting = await meetingRepository.findByGoogleEventId(meetingId);
    if (!meeting) {
      console.log(`[DataStorageService] Meeting not found in database, cannot store note`);
      return null;
    }
    
    // Store note in database
    const note = await preparationNoteRepository.create({
      meetingId: meeting.id,
      userId,
      noteText,
      isPrivate
    });
    
    console.log(`[DataStorageService] Successfully stored preparation note for meeting: ${meetingId}`);
    return note;
  } catch (error) {
    console.error(`[DataStorageService] Error storing preparation note:`, error);
    return null;
  }
}

/**
 * Get preparation notes for a meeting
 * @param {string} meetingId - Meeting ID (Google Calendar Event ID)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of notes
 */
async function getPreparationNotes(meetingId, userId) {
  try {
    console.log(`[DataStorageService] Getting preparation notes for meeting: ${meetingId}`);
    
    // Find meeting in database
    const meeting = await meetingRepository.findByGoogleEventId(meetingId);
    if (!meeting) {
      console.log(`[DataStorageService] Meeting not found in database: ${meetingId}`);
      return [];
    }
    
    // Get notes from database
    const notes = await preparationNoteRepository.findByMeetingAndUser(meeting.id, userId);
    
    console.log(`[DataStorageService] Found ${notes.length} preparation notes for meeting: ${meetingId}`);
    return notes;
  } catch (error) {
    console.error(`[DataStorageService] Error getting preparation notes:`, error);
    return [];
  }
}

/**
 * Clear meeting summary from cache
 * @param {string} meetingId - Meeting ID
 */
function clearMeetingSummaryCache(meetingId) {
  console.log(`[DataStorageService] Clearing meeting summary cache for meeting: ${meetingId}`);
  cache.del(`summary:${meetingId}`);
}

/**
 * Store meeting in database from Google Calendar event
 * @param {Object} event - Google Calendar event
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Created or updated meeting or null
 */
async function storeMeetingFromEvent(event, userId) {
  try {
    console.log(`[DataStorageService] Storing meeting from event: ${event.id}`);
    
    // Validate userId
    if (!userId) {
      console.warn(`[DataStorageService] No userId provided for event ${event.id}, using default`);
      userId = 'default-user';
    }
    
    // Ensure user exists in the database
    await ensureUserExists(userId);
    
    console.log(`[DataStorageService] Using userId: ${userId} for event: ${event.id}`);
    return await meetingRepository.createOrUpdateFromGoogleEvent(event, userId);
  } catch (error) {
    console.error(`[DataStorageService] Error storing meeting from event:`, error);
    return null;
  }
}

/**
 * Helper function to ensure a user exists in the database
 * @param {string} googleId - Google ID of the user
 * @returns {Promise<void>}
 */
async function ensureUserExists(googleId) {
  try {
    // Check if user exists
    const user = await userRepository.findByGoogleId(googleId);
    
    if (!user) {
      console.log(`[DataStorageService] User with Google ID ${googleId} not found, creating placeholder`);
      
      // Create a placeholder user with minimal information
      await userRepository.create({
        googleId: googleId,
        email: `placeholder-${googleId}@example.com`,
        name: `User ${googleId.substring(0, 8)}...`
      });
      
      console.log(`[DataStorageService] Created placeholder user for Google ID: ${googleId}`);
    } else {
      console.log(`[DataStorageService] User with Google ID ${googleId} already exists`);
    }
  } catch (error) {
    console.error(`[DataStorageService] Error ensuring user exists:`, error);
    throw error; // Re-throw to handle in the calling function
  }
}

module.exports = {
  storeMeetingSummary,
  getMeetingSummary,
  storePreparationNote,
  getPreparationNotes,
  clearMeetingSummaryCache,
  storeMeetingFromEvent
};
