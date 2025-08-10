const { completion } = require('litellm');
const aiConfig = require('../config/aiConfig');
const NodeCache = require('node-cache');
const { marked } = require('marked');

// Get LiteLLM config from aiConfig
const config = aiConfig.litellm;

// Initialize cache with 30 minute TTL by default
const cache = new NodeCache({ stdTTL: 1800, checkperiod: 120 });

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: true
});

// Log configuration on startup
try {
  // Set API keys from environment variables
  // LiteLLM will automatically use these keys based on the model requested
  process.env.OPENAI_API_KEY = config.providers.openai.apiKey;
  
  // Set Anthropic API key if available
  if (config.providers.anthropic && config.providers.anthropic.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.providers.anthropic.apiKey;
  }
  
  // Set LiteLLM base URL and API key if provided
  const litellmUrl = process.env.LITELLM_API_URL;
  const litellmApiKey = process.env.LITELLM_API_KEY;
  
  if (litellmUrl) {
    console.log(`[LiteLLM Service] Using LiteLLM API URL: ${litellmUrl}`);
    // Base URL will be passed in each request
    
    if (litellmApiKey) {
      console.log('[LiteLLM Service] Using LiteLLM API key for authentication');
      // LiteLLM API key will be used in each request
    } else {
      console.warn('[LiteLLM Service] No LiteLLM API key provided for authentication');
    }
  }
  
  // Log available fallback models
  const fallbacks = config.fallbackModels.join(', ');
  console.log(`[LiteLLM Service] Initialized with fallback models: ${fallbacks || 'None configured'}`);
  console.log(`[LiteLLM Service] Default provider: ${config.defaultProvider}`);
} catch (error) {
  console.error('[LiteLLM Service] Error during initialization:', error);
}

/**
 * Get the appropriate API key for a given model
 * @param {string} model - The model name
 * @returns {string|undefined} - The API key for the model
 */
function getApiKeyForModel(model) {
  // Determine provider based on model prefix
  if (model.startsWith('gpt-') || model.startsWith('text-')) {
    return config.providers.openai.apiKey;
  } else if (model.startsWith('claude-')) {
    return config.providers.anthropic?.apiKey;
  }
  
  // Default to the default provider's API key
  const defaultProvider = config.defaultProvider;
  return config.providers[defaultProvider]?.apiKey;
}

/**
 * Send a completion request to LiteLLM
 * @param {Object} options - Completion options
 * @param {string} options.model - Model to use
 * @param {Array} options.messages - Messages to send
 * @param {number} options.temperature - Temperature for completion
 * @param {number} options.max_tokens - Maximum tokens to generate
 * @returns {Promise<Object>} - Completion response
 */
/**
 * Send a completion request using LiteLLM
 * @param {Object} options - Completion options
 * @returns {Promise<Object>} - Completion response
 */
async function completionWithFallback(options) {
  try {
    // Apply fallback model if available, use default if not specified
    const modelToUse = options.model || config.fallbackModels[0] || 'gpt-4.1-mini';
    console.log(`[LiteLLM Service] Sending completion request to model: ${modelToUse}`);
    
    // Prepare the request options
    const requestOptions = {
      model: modelToUse,
      messages: options.messages
    };
    
    // Handle temperature parameter based on model
    // GPT-5 models only support temperature of 1 (default), older models support custom values
    if (modelToUse && modelToUse.includes('gpt-5')) {
      // GPT-5 models only support default temperature of 1
      requestOptions.temperature = 1;
    } else {
      requestOptions.temperature = options.temperature || config.defaultParams.temperature;
    }
    
    // Handle token limit parameter based on model
    // GPT-5 models require max_completion_tokens, older models use max_tokens
    if (modelToUse.includes('gpt-5')) {
      requestOptions.max_completion_tokens = options.max_completion_tokens || options.max_tokens || config.defaultParams.maxTokens;
    } else {
      requestOptions.max_tokens = options.max_tokens || config.defaultParams.maxTokens;
    }
    
    // Add API key and base URL based on whether we're using LiteLLM server or direct provider calls
    if (config.apiUrl) {
      // If using LiteLLM server, set the base URL and use the LiteLLM API key for authentication
      requestOptions.baseUrl = config.apiUrl;
      if (config.apiKey) {
        requestOptions.apiKey = config.apiKey;
      }
    } else {
      // If using direct provider calls, use the provider-specific API key
      requestOptions.apiKey = getApiKeyForModel(modelToUse);
    }
    
    // Send the request
    const startTime = Date.now();
    const response = await completion(requestOptions);
    const duration = Date.now() - startTime;
    
    console.log(`[LiteLLM Service] Received response from model: ${modelToUse} in ${duration}ms`);
    
    // Add metadata to response for tracking
    response.litellm_metadata = {
      model: modelToUse,
      duration_ms: duration
    };
    
    return response;
  } catch (error) {
    console.error(`[LiteLLM Service] Error in completion with model ${options.model}:`, error.message);
    
    // Check if we have fallback models to try
    const currentModelIndex = config.fallbackModels.indexOf(options.model);
    
    if (currentModelIndex !== -1 && currentModelIndex < config.fallbackModels.length - 1) {
      // Get the next model in the fallback chain
      const fallbackModel = config.fallbackModels[currentModelIndex + 1];
      console.log(`[LiteLLM Service] Attempting fallback to model: ${fallbackModel}`);
      
      // Modify the request to use the fallback model
      const fallbackOptions = {
        ...options,
        model: fallbackModel
      };
      
      try {
        // Try the fallback model
        const fallbackResponse = await completionWithFallback(fallbackOptions);
        
        // Add fallback information to the response
        fallbackResponse.litellm_metadata = {
          ...fallbackResponse.litellm_metadata,
          fallback_from: options.model,
          fallback_reason: error.message
        };
        
        return fallbackResponse;
      } catch (fallbackError) {
        console.error(`[LiteLLM Service] Fallback to ${fallbackModel} failed:`, fallbackError.message);
        throw new Error(`Primary model (${options.model}) failed: ${error.message}. Fallback model (${fallbackModel}) also failed: ${fallbackError.message}`);
      }
    }
    
    throw error;
  }
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
 * Generate a document summary using LiteLLM
 * @param {string} documentContent - Document content to summarize
 * @param {string} documentId - Document ID for caching
 * @param {string} meetingId - Meeting ID for caching
 * @returns {Promise<string>} - Document summary
 */
async function generateSummary(documentContent, documentId, meetingId) {
  const cacheKey = getCacheKey('summary', documentId, meetingId);
  console.log(`[LiteLLM Service] Generating summary for document ${documentId} in meeting ${meetingId}`);
  
  // Check cache first
  const cachedSummary = cache.get(cacheKey);
  if (cachedSummary) {
    console.log(`[LiteLLM Service] Using cached summary for document ${documentId}`);
    return cachedSummary;
  }
  
  console.log(`[LiteLLM Service] No cached summary found, calling LiteLLM API`);
  try {
    // Select model based on the fallback models array and default provider
    let model;
    
    // If we have fallback models defined, use the first one in the array
    if (config.fallbackModels && config.fallbackModels.length > 0) {
      model = config.fallbackModels[0];
      console.log(`[LiteLLM Service] Using first model from fallback array: ${model}`);
    } 
    // Otherwise select based on the provider
    else if (config.defaultProvider === 'gemini') {
      model = 'gemini-pro';
    } else if (config.defaultProvider === 'anthropic' && config.providers.anthropic.model) {
      model = config.providers.anthropic.model;
    } else {
      model = config.providers.openai.model || 'gpt-4';
    }
    
    console.log(`[LiteLLM Service] Using model: ${model} based on provider: ${config.defaultProvider}`);
    console.log(`[LiteLLM Service] Calling LiteLLM API with model: ${model}`);
    
    const response = await completionWithFallback({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'I have a long internal meeting document. Please extract the following: 1.	Short Narrative Summary (3–5 sentences): Capture the purpose and main themes of the meeting in a natural tone, suitable for sharing in an internal update.  2.	High-Value Preparation List: Provide a short list (5–7 bullets max) of the most important actions, follow-ups, or items I should prepare before the next meeting. Focus on high-leverage items that drive planning, decision-making, or unblock others.  Keep your response concise, clear, and focused on execution.  ' 
        },
        {
          role: 'user',
          content: `Please summarize the following document content:\n\n${documentContent}`
        }
      ],
      temperature: config.defaultParams.temperature,
      max_tokens: config.defaultParams.maxTokens
    });
    console.log(`[LiteLLM Service] Received response from LiteLLM API for summary generation`);
    
    const markdownSummary = response.choices[0].message.content.trim();
    
    // Convert markdown to HTML
    console.log(`[LiteLLM Service] Converting markdown summary to HTML`);
    const htmlSummary = marked.parse(markdownSummary);
    
    // Cache the HTML result
    cache.set(cacheKey, htmlSummary);
    
    return htmlSummary;
  } catch (error) {
    console.error('[LiteLLM Service] Error generating summary:', error);
    throw new Error('Failed to generate document summary');
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
  try {
    const summary = await generateSummary(documentContent, documentId, meetingId);
    return { summary };
  } catch (error) {
    console.error('[LiteLLM Service] Error analyzing document:', error);
    throw new Error('Failed to analyze document for meeting');
  }
}

/**
 * Generate a meeting summary from multiple documents
 * @param {string} meetingTitle - Title of the meeting
 * @param {Array} documentContents - Array of {title, content} objects
 * @returns {Promise<Object>} Meeting summary with key topics and preparation suggestions
 */
async function generateMeetingSummary(meetingTitle, documentContents) {
  console.log(`[LiteLLM Service] Generating meeting summary for: ${meetingTitle}`);
  
  try {
    // Combine all document contents
    const combinedContent = documentContents.map(doc => 
      `Document: ${doc.title}\n\n${doc.content}\n\n`
    ).join('---\n');
    
    // Select model based on the default provider
    let model;
    
    // If we have fallback models defined, use the first one in the array
    if (config.fallbackModels && config.fallbackModels.length > 0) {
      model = config.fallbackModels[0];
      console.log(`[LiteLLM Service] Using first model from fallback array: ${model}`);
    } 
    // Otherwise select based on the provider
    else if (config.defaultProvider === 'gemini') {
      model = 'gemini-pro';
    } else if (config.defaultProvider === 'anthropic' && config.providers.anthropic.model) {
      model = config.providers.anthropic.model;
    } else {
      model = config.providers.openai.model || 'gpt-3.5-turbo';
    }
    
    console.log(`[LiteLLM Service] Using model: ${model} based on provider: ${config.defaultProvider}`);
    
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
    
    const response = await completionWithFallback({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.defaultParams.temperature,
      max_tokens: config.defaultParams.maxTokens
    });
    
    console.log(`[LiteLLM Service] Successfully generated meeting summary for: ${meetingTitle}`);
    
    // Parse the JSON response
    try {
      const jsonResponse = JSON.parse(response.choices[0].message.content);
      return jsonResponse;
    } catch (parseError) {
      console.error('[LiteLLM Service] Error parsing JSON response:', parseError);
      // Fallback to a basic structure if JSON parsing fails
      return {
        summary: response.choices[0].message.content,
        keyTopics: [],
        preparationSuggestions: []
      };
    }
  } catch (error) {
    console.error('[LiteLLM Service] Error generating meeting summary:', error);
    throw new Error('Failed to generate meeting summary');
  }
}

/**
 * Generate a comprehensive daily briefing from meeting summaries
 * @param {Object} briefingContext - Context object with date, meetings, and summaries
 * @returns {Promise<Object>} Daily briefing summary
 */
async function generateDailyBriefing(briefingContext) {
  const { date, meetings, summaries, timeContext = 'today' } = briefingContext;
  
  console.log(`[LiteLLM Service] Generating daily briefing for ${date}`);
  
  try {
    // Format meetings list
    const totalMeetings = meetings.length;
    const meetingsWithDocuments = summaries.length;
    
    const meetingsList = meetings.map(meeting => 
      `- ${meeting.title} (${meeting.startTime} - ${meeting.endTime})`
    ).join('\n');
    
    // Format summaries text
    const summariesText = summaries.map(summary => 
      `Meeting: ${summary.title}\nSummary: ${summary.summary}\nKey Topics: ${summary.keyTopics.join(', ')}\n`
    ).join('\n---\n\n');
    
    // Select model based on the fallback models array and default provider
    let model;
    
    // If we have fallback models defined, use the first one in the array
    if (config.fallbackModels && config.fallbackModels.length > 0) {
      model = config.fallbackModels[0];
      console.log(`[LiteLLM Service] Using first model from fallback array: ${model}`);
    } 
    // Otherwise select based on the provider
    else if (config.defaultProvider === 'gemini') {
      model = 'gemini-pro';
    } else if (config.defaultProvider === 'anthropic' && config.providers.anthropic.model) {
      model = config.providers.anthropic.model;
    } else {
      model = config.providers.openai.model || 'gpt-4';
    }
    
    console.log(`[LiteLLM Service] Using model: ${model} based on provider: ${config.defaultProvider}`);
    
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
  "summary": "Your comprehensive briefing summary here (3-4 paragraphs)",
  "peopleOverview": ["Person 1 - key context", "Person 2 - key context"],
  "priorityPreparations": ["Priority 1", "Priority 2", "Priority 3"]
}`;
    
    const response = await completionWithFallback({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.defaultParams.temperature,
      max_tokens: config.defaultParams.maxTokens
    });
    
    console.log(`[LiteLLM Service] Successfully generated daily briefing for ${date}`);
    
    // Parse the JSON response
    try {
      // Log the raw response for debugging
      console.log('[LiteLLM Service] Raw response content:', response.choices[0].message.content);
      
      // Clean the response content - remove any leading/trailing whitespace and markdown code blocks
      let cleanedContent = response.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present (```json and ```)
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\n/, '').replace(/```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\n/, '').replace(/```$/, '');
      }
      
      // Parse the JSON response
      const jsonResponse = JSON.parse(cleanedContent);
      
      // Ensure all expected properties exist
      return {
        summary: jsonResponse.summary || '',
        peopleOverview: Array.isArray(jsonResponse.peopleOverview) ? jsonResponse.peopleOverview : [],
        priorityPreparations: Array.isArray(jsonResponse.priorityPreparations) ? jsonResponse.priorityPreparations : []
      };
    } catch (parseError) {
      console.error('[LiteLLM Service] Error parsing JSON response:', parseError);
      console.error('[LiteLLM Service] Raw content that failed to parse:', response.choices[0].message.content);
      
      // Fallback to a basic structure if JSON parsing fails
      return {
        summary: response.choices[0].message.content,
        peopleOverview: [],
        priorityPreparations: []
      };
    }
  } catch (error) {
    console.error('[LiteLLM Service] Error generating daily briefing:', error);
    throw new Error('Failed to generate daily briefing');
  }
}

module.exports = {
  completion: completionWithFallback,
  generateSummary,
  analyzeDocumentForMeeting,
  generateMeetingSummary,
  generateDailyBriefing,
  clearMeetingCache
};
