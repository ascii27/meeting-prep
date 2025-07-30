const OpenAI = require('openai');
const NodeCache = require('node-cache');
const { marked } = require('marked');

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: true
});

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
  console.log(`[OpenAI Service] Generating summary for document ${documentId} in meeting ${meetingId}`);
  
  // Check cache first
  const cachedSummary = cache.get(cacheKey);
  if (cachedSummary) {
    console.log(`[OpenAI Service] Using cached summary for document ${documentId}`);
    return cachedSummary;
  }
  
  console.log(`[OpenAI Service] No cached summary found, calling OpenAI API`);
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    console.log(`[OpenAI Service] Calling OpenAI API with model: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'I have a long internal meeting document. Please extract the following: 1.	Short Narrative Summary (3–5 sentences): Capture the purpose and main themes of the meeting in a natural tone, suitable for sharing in an internal update.  2.	High-Value Preparation List: Provide a short list (5–7 bullets max) of the most important actions, follow-ups, or items I should prepare before the next meeting. Focus on high-leverage items that drive planning, decision-making, or unblock others.  Keep your response concise, clear, and focused on execution.  ' 
        },
        {
          role: 'user',
          content: `Please summarize the following document content:\n\n${documentContent}`
        }
      ]
    });
    console.log(`[OpenAI Service] Received response from OpenAI API for summary generation`);
    
    const markdownSummary = response.choices[0].message.content.trim();
    
    // Convert markdown to HTML
    console.log(`[OpenAI Service] Converting markdown summary to HTML`);
    const htmlSummary = marked.parse(markdownSummary);
    
    // Cache the HTML result
    cache.set(cacheKey, htmlSummary);
    
    return htmlSummary;
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
    
    console.log(`[OpenAI Service] Extracting key topics for document ${documentId} in meeting ${meetingId}`);
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that identifies key topics in documents for meeting preparation. Extract 3-5 main topics from the document.'
        },
        {
          role: 'user',
          content: `Please identify the key topics in the following document content. Return them as a JSON object with a 'topics' array of strings. Format your entire response as valid JSON and nothing else:\n\n${documentContent}`
        }
      ]
    });
    
    console.log(`[OpenAI Service] Received response from OpenAI API for key topics extraction`);
    
    // Get the response text and parse it as JSON
    const responseText = response.choices[0].message.content.trim();
    console.log(`[OpenAI Service] Parsing response text as JSON: ${responseText.substring(0, 100)}...`);
    
    let topics = [];
    try {
      const result = JSON.parse(responseText);
      topics = result.topics || [];
      console.log(`[OpenAI Service] Successfully extracted ${topics.length} topics`);
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      // Fallback: try to extract topics from non-JSON response
      topics = responseText.split('\n')
        .filter(line => line.trim().length > 0)
        .slice(0, 5);
      console.log(`[OpenAI Service] Fallback: extracted ${topics.length} topics from text`);
    }
    
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
    
    console.log(`[OpenAI Service] Generating preparation suggestions for document ${documentId} in meeting ${meetingId}`);
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that provides preparation suggestions for meetings. Based on the document content, suggest 3-5 actions the user should take to prepare for the meeting.'
        },
        {
          role: 'user',
          content: `Please provide preparation suggestions based on the following document content. Return them as a JSON object with a 'suggestions' array of strings. Format your entire response as valid JSON and nothing else:\n\n${documentContent}`
        }
      ]
    });
    
    console.log(`[OpenAI Service] Received response from OpenAI API for preparation suggestions`);
    
    // Get the response text and parse it as JSON
    const responseText = response.choices[0].message.content.trim();
    console.log(`[OpenAI Service] Parsing response text as JSON: ${responseText.substring(0, 100)}...`);
    
    let suggestions = [];
    try {
      const result = JSON.parse(responseText);
      suggestions = result.suggestions || [];
      console.log(`[OpenAI Service] Successfully extracted ${suggestions.length} suggestions`);
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      // Fallback: try to extract suggestions from non-JSON response
      suggestions = responseText.split('\n')
        .filter(line => line.trim().length > 0 && line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim())
        .slice(0, 5);
      console.log(`[OpenAI Service] Fallback: extracted ${suggestions.length} suggestions from text`);
    }
    
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
 * @returns {Promise<Object>} - Analysis results including only summary
 */
async function analyzeDocumentForMeeting(documentContent, documentId, meetingId) {
  console.log(`[OpenAI Service] Starting document analysis for document ${documentId} in meeting ${meetingId}`);
  
  // Validate document content
  if (!documentContent) {
    console.error(`[OpenAI Service] Document content is empty or null for document ${documentId}`);
    throw new Error('Document content is required for analysis');
  }
  
  // Log document content details
  console.log(`[OpenAI Service] Document content type: ${typeof documentContent}`);
  console.log(`[OpenAI Service] Document content length: ${documentContent.length} characters`);
  console.log(`[OpenAI Service] Document content preview: ${documentContent.substring(0, 100)}...`);
  
  try {
    // Generate summary only
    console.log(`[OpenAI Service] Generating summary for document ${documentId}`);
    const summary = await generateSummary(documentContent, documentId, meetingId);
    
    console.log(`[OpenAI Service] Successfully completed analysis for document ${documentId}`);
    return {
      summary,
      // Provide empty arrays for topics and suggestions to maintain API compatibility
      topics: [],
      suggestions: []
    };
  } catch (error) {
    console.error('Error analyzing document for meeting:', error);
    throw new Error('Failed to analyze document for meeting preparation');
  }
}

/**
 * Generate a meeting summary from multiple documents
 * @param {string} meetingTitle - Title of the meeting
 * @param {Array} documentContents - Array of {title, content} objects
 * @returns {Promise<Object>} Meeting summary with key topics and preparation suggestions
 */
async function generateMeetingSummary(meetingTitle, documentContents) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  try {
    console.log(`[OpenAI Service] Generating meeting summary for: ${meetingTitle}`);
    
    // Combine all document contents
    const combinedContent = documentContents.map(doc => 
      `Document: ${doc.title}\n${doc.content}`
    ).join('\n\n---\n\n');

    const prompt = `You are an AI assistant helping to prepare for a meeting. Please analyze the following documents for the meeting "${meetingTitle}" and provide:

1. A concise summary (2-3 paragraphs) of the key information
2. A list of key topics that will likely be discussed
3. Specific preparation suggestions for the attendee

Documents:
${combinedContent}

Please format your response as JSON with the following structure:
{
  "summary": "Your summary here",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "preparationSuggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes meeting documents and provides structured summaries in JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    const content = response.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content);
      console.log(`[OpenAI Service] Successfully generated meeting summary for: ${meetingTitle}`);
      return parsed;
    } catch (parseError) {
      console.error('[OpenAI Service] Error parsing JSON response:', parseError);
      // Fallback to basic summary
      return {
        summary: content,
        keyTopics: [],
        preparationSuggestions: []
      };
    }

  } catch (error) {
    console.error('[OpenAI Service] Error generating meeting summary:', error);
    throw new Error('Failed to generate meeting summary');
  }
}

/**
 * Generate a comprehensive daily briefing from meeting summaries
 * @param {Object} briefingContext - Context object with date, meetings, and summaries
 * @returns {Promise<Object>} Daily briefing summary
 */
async function generateDailyBriefing(briefingContext) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  try {
    console.log(`[OpenAI Service] Generating daily briefing for ${briefingContext.date}`);
    
    const { date, isToday, totalMeetings, meetingsWithDocuments, meetings, summaries } = briefingContext;
    
    // Create context summary
    const meetingsList = meetings.map(meeting => 
      `- ${meeting.title} (${meeting.startTime})`
    ).join('\n');
    
    const summariesText = summaries.map(summary => 
      `Meeting: ${summary.meetingTitle}\nSummary: ${summary.summary}\nKey Topics: ${summary.keyTopics.join(', ')}\n`
    ).join('\n---\n');

    const timeContext = isToday ? 'today' : `on ${date}`;
    
    const prompt = `You are an AI assistant creating a comprehensive daily briefing. Please analyze the following information about meetings ${timeContext} and create a unified briefing.

Date: ${date}
Total Meetings: ${totalMeetings}
Meetings with Documents: ${meetingsWithDocuments}

All Meetings:
${meetingsList}

Detailed Summaries (for meetings with documents):
${summariesText}

Please create a comprehensive daily briefing that:
1. Provides an executive summary of the day's meetings
2. Highlights key themes and connections across meetings
3. Identifies important decisions or actions needed
4. Suggests strategic preparation priorities

Format your response as JSON:
{
  "summary": "Your comprehensive briefing summary here (3-4 paragraphs)"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic executive assistant that creates comprehensive daily briefings by analyzing multiple meetings and finding connections and priorities.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.4
    });

    const content = response.choices[0].message.content;
    
    try {
      // Try to extract JSON from the content if it's not pure JSON
      let jsonContent = content;
      
      // Check if the content might contain markdown or text before/after JSON
      const jsonStartIndex = content.indexOf('{');
      const jsonEndIndex = content.lastIndexOf('}');
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
        // Extract what looks like JSON
        jsonContent = content.substring(jsonStartIndex, jsonEndIndex + 1);
      }
      
      const parsed = JSON.parse(jsonContent);
      console.log(`[OpenAI Service] Successfully generated daily briefing for ${date}`);
      return parsed;
    } catch (parseError) {
      console.error('[OpenAI Service] Error parsing daily briefing JSON:', parseError);
      console.log('[OpenAI Service] Raw content received:', content);
      
      // Fallback to basic summary
      return {
        summary: content
      };
    }

  } catch (error) {
    console.error('[OpenAI Service] Error generating daily briefing:', error);
    throw new Error('Failed to generate daily briefing');
  }
}

module.exports = {
  generateSummary,
  analyzeDocumentForMeeting,
  generateMeetingSummary,
  generateDailyBriefing,
  clearMeetingCache
};
