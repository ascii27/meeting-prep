const NodeCache = require('node-cache');

/**
 * Centralized cache service for the Meeting Prep application
 * Provides a single cache instance with different TTL options for different data types
 */
class CacheService {
  constructor() {
    // Single cache instance with default 1 hour TTL
    this.cache = new NodeCache({ 
      stdTTL: 3600, // 1 hour default
      checkperiod: 300, // Check for expired keys every 5 minutes
      useClones: false // Better performance, but be careful with object mutations
    });
    
    // Define TTL presets for different data types
    this.TTL_PRESETS = {
      MEETING_PREP: 3600,      // 1 hour - meeting preparation data
      AI_ANALYSIS: 1800,       // 30 minutes - AI analysis results
      DOCUMENT_CONTENT: 7200,  // 2 hours - document content (more stable)
      USER_NOTES: 86400,       // 24 hours - user notes (persistent)
      CALENDAR_EVENTS: 1800,   // 30 minutes - calendar data (can change)
      DAILY_BRIEFING: 3600     // 1 hour - daily briefing data
    };
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or undefined
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number|string} ttl - TTL in seconds or preset name
   * @returns {boolean} - Success status
   */
  set(key, value, ttl = null) {
    const ttlValue = typeof ttl === 'string' ? this.TTL_PRESETS[ttl] : ttl;
    return this.cache.set(key, value, ttlValue);
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   * @returns {number} - Number of deleted keys
   */
  del(key) {
    return this.cache.del(key);
  }

  /**
   * Delete multiple keys from cache
   * @param {string[]} keys - Array of cache keys
   * @returns {number} - Number of deleted keys
   */
  delMultiple(keys) {
    return this.cache.del(keys);
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} - Whether key exists
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Get all keys matching a pattern
   * @param {string} pattern - Pattern to match (supports wildcards)
   * @returns {string[]} - Array of matching keys
   */
  keys(pattern = null) {
    const allKeys = this.cache.keys();
    if (!pattern) return allKeys;
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  /**
   * Clear all cache entries
   */
  flushAll() {
    this.cache.flushAll();
  }

  /**
   * Clear cache entries for a specific meeting
   * @param {string} meetingId - Meeting ID
   */
  clearMeetingCache(meetingId) {
    const patterns = [
      `prep:${meetingId}`,
      `notes:${meetingId}`,
      `ai:*:${meetingId}`,
      `doc:*:${meetingId}`,
      `briefing:*:${meetingId}`
    ];
    
    patterns.forEach(pattern => {
      const keys = this.keys(pattern);
      if (keys.length > 0) {
        this.delMultiple(keys);
      }
    });
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Generate standardized cache keys
   */
  keys() {
    return {
      meetingPrep: (meetingId) => `prep:${meetingId}`,
      userNotes: (meetingId) => `notes:${meetingId}`,
      aiAnalysis: (type, meetingId) => `ai:${type}:${meetingId}`,
      documentContent: (docId) => `doc:content:${docId}`,
      calendarEvent: (eventId) => `calendar:${eventId}`,
      dailyBriefing: (date) => `briefing:${date}`
    };
  }
}

// Export singleton instance
module.exports = new CacheService();
