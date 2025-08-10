/**
 * LLM Service for Meeting Intelligence
 * Handles natural language query processing and response generation
 */

const aiConfig = require('../../../config/aiConfig');
const openaiService = require('../../openaiService');
const litellmService = require('../../litellmService');

class LLMService {
  constructor() {
    this.systemPrompt = `You are an intelligent assistant for a meeting intelligence platform. 
You help users query information about meetings, participants, documents, and organizational relationships.

Your capabilities include:
- Analyzing meeting data and participant relationships
- Finding documents associated with meetings
- Tracking meeting patterns and frequencies
- Understanding organizational context and hierarchies

You have access to a Neo4j graph database with the following node types:
- Person: Meeting participants with properties like name, email, role
- Meeting: Calendar events with properties like title, date, duration, location
- Document: Files associated with meetings with properties like title, content, url
- Topic: Discussion subjects extracted from meetings and documents

Relationship types include:
- ATTENDED: Person participated in Meeting
- ORGANIZED: Person organized Meeting
- HAS_DOCUMENT: Meeting has associated Document
- DISCUSSED: Topic was covered in Meeting
- COLLABORATES_WITH: People work together regularly

When processing queries, you should:
1. Understand the user's intent and extract key entities (people, dates, topics, etc.)
2. Translate the natural language query into appropriate database queries
3. Provide clear, actionable responses based on the data
4. Suggest follow-up questions when relevant

Always be helpful, accurate, and concise in your responses.`;
  }

  /**
   * Process a natural language query about meeting intelligence
   * @param {string} query - User's natural language query
   * @param {Object} context - Additional context (user info, recent queries, etc.)
   * @returns {Promise<Object>} - Processed query with intent and parameters
   */
  async processQuery(query, context = {}) {
    try {
      console.log(`[LLMService] Processing query: "${query}"`);
      
      const prompt = this.buildQueryProcessingPrompt(query, context);
      
      // Use configured AI service
      const service = aiConfig.service.toLowerCase();
      let response;
      
      if (service === 'litellm') {
        const completion = await litellmService.completion({
          model: aiConfig.litellm.fallbackModels[0] || 'gpt-4',
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });
        response = completion.choices[0].message.content;
      } else {
        response = await openaiService.generateResponse([
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.3,
          max_tokens: 1000
        });
      }

      const processedQuery = this.parseQueryResponse(response, query);
      
      console.log(`[LLMService] Processed query intent: ${processedQuery.intent}`);
      return processedQuery;
      
    } catch (error) {
      console.error(`[LLMService] Error processing query:`, error);
      throw new Error(`Failed to process query: ${error.message}`);
    }
  }

  /**
   * Generate a response based on query results
   * @param {string} originalQuery - Original user query
   * @param {Object} queryResults - Results from database queries
   * @param {Object} context - Additional context
   * @returns {Promise<string>} - Natural language response
   */
  async generateResponse(originalQuery, queryResults, context = {}) {
    try {
      console.log(`[LLMService] Generating response for query: "${originalQuery}"`);
      
      const prompt = this.buildResponseGenerationPrompt(originalQuery, queryResults, context);
      
      // Use configured AI service
      const service = aiConfig.service.toLowerCase();
      let response;
      
      if (service === 'litellm') {
        const completion = await litellmService.completion({
          model: aiConfig.litellm.fallbackModels[0] || 'gpt-4',
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1500
        });
        response = completion.choices[0].message.content;
      } else {
        response = await openaiService.generateResponse([
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          max_tokens: 1500
        });
      }

      console.log(`[LLMService] Generated response (${response.length} characters)`);
      return response;
      
    } catch (error) {
      console.error(`[LLMService] Error generating response:`, error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Build prompt for query processing
   * @param {string} query - User's query
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   */
  buildQueryProcessingPrompt(query, context) {
    return `Please analyze this natural language query about meeting intelligence and extract the key information:

Query: "${query}"

Context:
- User: ${context.userEmail || 'Unknown'}
- Current date: ${new Date().toISOString().split('T')[0]}
- Recent queries: ${context.recentQueries ? context.recentQueries.slice(0, 3).join(', ') : 'None'}

Please respond with a JSON object containing:
{
  "intent": "string - the main intent (e.g., 'find_meetings', 'get_participants', 'find_documents', 'analyze_relationships')",
  "entities": {
    "people": ["array of person names or emails mentioned"],
    "timeframe": "string - time period mentioned (e.g., 'last week', 'July 2024', 'yesterday')",
    "topics": ["array of topics or meeting subjects mentioned"],
    "meeting_types": ["array of meeting types mentioned"],
    "documents": ["array of document names mentioned"]
  },
  "parameters": {
    "limit": "number - how many results to return (default 10)",
    "sort_by": "string - how to sort results (e.g., 'date', 'relevance')",
    "include_content": "boolean - whether to include document content"
  },
  "confidence": "number between 0-1 indicating confidence in the interpretation"
}

Only return the JSON object, no additional text.`;
  }

  /**
   * Build prompt for response generation
   * @param {string} originalQuery - Original query
   * @param {Object} queryResults - Database results
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   */
  buildResponseGenerationPrompt(originalQuery, queryResults, context) {
    return `Generate a helpful, natural language response to this meeting intelligence query:

Original Query: "${originalQuery}"

Query Results:
${JSON.stringify(queryResults, null, 2)}

Context:
- User: ${context.userEmail || 'Unknown'}
- Total results found: ${queryResults.totalResults || 0}

Please provide a response that:
1. Directly answers the user's question
2. Summarizes the key findings from the data
3. Highlights interesting patterns or insights
4. Suggests relevant follow-up questions if appropriate
5. Is conversational and easy to understand

If no results were found, explain why and suggest alternative queries.
Keep the response concise but informative (2-4 paragraphs maximum).`;
  }

  /**
   * Parse the LLM response for query processing
   * @param {string} response - LLM response
   * @param {string} originalQuery - Original query for fallback
   * @returns {Object} - Parsed query object
   */
  parseQueryResponse(response, originalQuery) {
    try {
      // Try to parse JSON response
      const parsed = JSON.parse(response.trim());
      
      // Validate required fields
      if (!parsed.intent) {
        throw new Error('Missing intent field');
      }
      
      // Set defaults for missing fields
      return {
        intent: parsed.intent,
        entities: parsed.entities || {},
        parameters: {
          limit: 10,
          sort_by: 'date',
          include_content: false,
          ...parsed.parameters
        },
        confidence: parsed.confidence || 0.5,
        originalQuery
      };
      
    } catch (error) {
      console.warn(`[LLMService] Failed to parse LLM response, using fallback:`, error);
      
      // Fallback: basic intent detection
      return this.fallbackQueryParsing(originalQuery);
    }
  }

  /**
   * Fallback query parsing when LLM response can't be parsed
   * @param {string} query - Original query
   * @returns {Object} - Basic parsed query
   */
  fallbackQueryParsing(query) {
    const lowerQuery = query.toLowerCase();
    
    let intent = 'general_query';
    
    // Check for participant-related queries first (more specific)
    if (lowerQuery.includes('who') || lowerQuery.includes('participant') || lowerQuery.includes('attended')) {
      intent = 'get_participants';
    } 
    // Check for relationship/collaboration queries
    else if (lowerQuery.includes('relationship') || lowerQuery.includes('collaborate') || lowerQuery.includes('collaboration')) {
      intent = 'analyze_relationships';
    }
    // Check for document queries
    else if (lowerQuery.includes('document') || lowerQuery.includes('doc')) {
      intent = 'find_documents';
    }
    // Check for meeting queries (most general, check last)
    else if (lowerQuery.includes('meeting') || lowerQuery.includes('met with')) {
      intent = 'find_meetings';
    }
    
    return {
      intent,
      entities: {},
      parameters: {
        limit: 10,
        sort_by: 'date',
        include_content: false
      },
      confidence: 0.3,
      originalQuery: query
    };
  }

  /**
   * Get available query intents and their descriptions
   * @returns {Object} - Available intents
   */
  getAvailableIntents() {
    return {
      find_meetings: {
        description: 'Find meetings based on criteria like participants, dates, or topics',
        examples: ['Show me meetings with John last week', 'What meetings did I have yesterday?']
      },
      get_participants: {
        description: 'Get information about meeting participants and their roles',
        examples: ['Who attended the Q4 planning meeting?', 'Show me all participants from July meetings']
      },
      find_documents: {
        description: 'Find documents associated with meetings or topics',
        examples: ['What documents are linked to my 1:1s?', 'Show me all planning documents']
      },
      analyze_relationships: {
        description: 'Analyze collaboration patterns and relationships between people',
        examples: ['Who do I meet with most often?', 'Show me collaboration patterns in my team']
      },
      general_query: {
        description: 'General questions about meeting data and organizational insights',
        examples: ['How many meetings did I have last month?', 'What are my most common meeting topics?']
      }
    };
  }
}

module.exports = new LLMService();
