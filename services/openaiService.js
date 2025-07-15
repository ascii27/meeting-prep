const OpenAI = require('openai');
const NodeCache = require('node-cache');

// Initialize cache with 30 minute TTL by default
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch (error) {
  console.error('Error initializing OpenAI client:', error);
}

/**
 * Cache key generator for AI analysis results
 * @param {string} type - Type of analysis (summary, topics, suggestions)
 * @param {string} documentId - Document ID
 * @param {string} meetingId - Meeting ID
 * @returns {string} - Cache key
 */
function getCacheKey(type, documentId, meetingId) {
  return `${type}:${documentId}:${meetingId}`;
}

/**
 * Clear cache for a specific meeting
 * @param {string} meetingId - Meeting ID
 */
function clearMeetingCache(meetingId) {
  const keys = cache.keys();
  const meetingKeys = keys.filter(key => key.includes(`:${meetingId}`));
  cache.del(meetingKeys);
}

/**
 * Generate a document summary using OpenAI
 * @param {string} documentContent - Document content to summarize
 * @param {string} documentId - Document ID for caching
 * @param {string} meetingId - Meeting ID for caching
 * @returns {Promise<string>} - Document summary
 */
async function generateSummary(documentContent, documentId, meetingId) {
  const cacheKey = getCacheKey('summary', documentId, meetingId);
  
  // Check cache first
  const cachedSummary = cache.get(cacheKey);
  if (cachedSummary) {
    return cachedSummary;
  }
  
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes documents for meeting preparation. Create a concise summary that captures the main points of the document.'
        },
        {
          role: 'user',
          content: `Please summarize the following document content:\n\n${documentContent}`
        }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    });
    
    const summary = response.choices[0].message.content.trim();
    
    // Cache the result
    cache.set(cacheKey, summary);
    
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate document summary');
  }
}

/**
 * Extract key topics from document content
 * @param {string} documentContent - Document content to analyze
 * @param {string} documentId - Document ID for caching
 * @param {string} meetingId - Meeting ID for caching
 * @returns {Promise<Array<string>>} - List of key topics
 */
async function extractKeyTopics(documentContent, documentId, meetingId) {
  const cacheKey = getCacheKey('topics', documentId, meetingId);
  
  // Check cache first
  const cachedTopics = cache.get(cacheKey);
  if (cachedTopics) {
    return cachedTopics;
  }
  
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that identifies key topics in documents for meeting preparation. Extract 3-5 main topics from the document.'
        },
        {
          role: 'user',
          content: `Please identify the key topics in the following document content. Return them as a JSON array of strings:\n\n${documentContent}`
        }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    const topics = result.topics || [];
    
    // Cache the result
    cache.set(cacheKey, topics);
    
    return topics;
  } catch (error) {
    console.error('Error extracting key topics:', error);
    throw new Error('Failed to extract key topics from document');
  }
}

/**
 * Generate preparation suggestions based on document content
 * @param {string} documentContent - Document content to analyze
 * @param {string} documentId - Document ID for caching
 * @param {string} meetingId - Meeting ID for caching
 * @returns {Promise<Array<string>>} - List of preparation suggestions
 */
async function generatePreparationSuggestions(documentContent, documentId, meetingId) {
  const cacheKey = getCacheKey('suggestions', documentId, meetingId);
  
  // Check cache first
  const cachedSuggestions = cache.get(cacheKey);
  if (cachedSuggestions) {
    return cachedSuggestions;
  }
  
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides preparation suggestions for meetings. Based on the document content, suggest 3-5 actions the user should take to prepare for the meeting.'
        },
        {
          role: 'user',
          content: `Please provide preparation suggestions based on the following document content. Return them as a JSON array of strings:\n\n${documentContent}`
        }
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    const suggestions = result.suggestions || [];
    
    // Cache the result
    cache.set(cacheKey, suggestions);
    
    return suggestions;
  } catch (error) {
    console.error('Error generating preparation suggestions:', error);
    throw new Error('Failed to generate preparation suggestions');
  }
}

/**
 * Analyze a document for meeting preparation
 * @param {string} documentContent - Document content to analyze
 * @param {string} documentId - Document ID
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Object>} - Analysis results including summary, topics, and suggestions
 */
async function analyzeDocumentForMeeting(documentContent, documentId, meetingId) {
  try {
    // Run all analyses in parallel
    const [summary, topics, suggestions] = await Promise.all([
      generateSummary(documentContent, documentId, meetingId),
      extractKeyTopics(documentContent, documentId, meetingId),
      generatePreparationSuggestions(documentContent, documentId, meetingId)
    ]);
    
    return {
      summary,
      topics,
      suggestions
    };
  } catch (error) {
    console.error('Error analyzing document for meeting:', error);
    throw new Error('Failed to analyze document for meeting preparation');
  }
}

module.exports = {
  generateSummary,
  extractKeyTopics,
  generatePreparationSuggestions,
  analyzeDocumentForMeeting,
  clearMeetingCache
};
