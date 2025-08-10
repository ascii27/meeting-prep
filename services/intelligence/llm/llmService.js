/**
 * Enhanced LLM Service for Meeting Intelligence - Step 5.2
 * Handles natural language query processing with advanced capabilities:
 * - Complex query translation and optimization
 * - Context-aware conversation management
 * - Organizational intelligence integration
 */

const aiConfig = require('../../../config/aiConfig');
const openaiService = require('../../openaiService');
const litellmService = require('../../litellmService');

class LLMService {
  constructor() {
    // Enhanced conversation management
    this.conversationHistory = new Map(); // Store conversation context per user
    this.queryOptimizationRules = this.initializeOptimizationRules();
    
    this.systemPrompt = `You are an advanced intelligent assistant for a meeting intelligence platform with organizational intelligence capabilities.
You help users query information about meetings, participants, documents, organizational relationships, and collaboration patterns.

Your enhanced capabilities include:
- Analyzing meeting data and participant relationships
- Finding documents associated with meetings
- Tracking meeting patterns and frequencies
- Understanding organizational context and hierarchies
- Analyzing cross-department collaboration
- Providing organizational insights and statistics
- Generating context-aware follow-up suggestions

You have access to a Neo4j graph database with the following node types:
- Person: Meeting participants with properties like name, email, role, department
- Meeting: Calendar events with properties like title, date, duration, location
- Document: Files associated with meetings with properties like title, content, url
- Topic: Discussion subjects extracted from meetings and documents
- Organization: Company entities with domain, name, industry
- Department: Organizational units with code, name, description

Relationship types include:
- ATTENDED: Person participated in Meeting
- ORGANIZED: Person organized Meeting
- HAS_DOCUMENT: Meeting has associated Document
- DISCUSSED: Topic was covered in Meeting
- COLLABORATES_WITH: People work together regularly
- BELONGS_TO: Person belongs to Department
- REPORTS_TO: Person reports to another Person
- HAS_DEPARTMENT: Organization has Department
- PARENT_DEPARTMENT: Department hierarchy relationships

When processing queries, you should:
1. Understand complex, multi-part queries and break them down into components
2. Extract key entities (people, dates, topics, departments, organizations)
3. Consider conversation context and previous queries
4. Optimize query parameters based on data patterns
5. Translate queries into appropriate database operations
6. Provide clear, actionable responses with insights
7. Suggest relevant follow-up questions based on results
8. Handle organizational intelligence queries (hierarchy, collaboration, statistics)

Always be helpful, accurate, and provide context-aware responses.`;
  }

  /**
   * Initialize query optimization rules for Step 5.2
   * @returns {Object} - Optimization rules
   */
  initializeOptimizationRules() {
    return {
      timeRangeDefaults: {
        'recent': 30, // days
        'last month': 30,
        'last week': 7,
        'yesterday': 1,
        'today': 0
      },
      resultLimits: {
        'meetings': 20,
        'participants': 50,
        'documents': 15,
        'collaborations': 25
      },
      priorityKeywords: {
        'urgent': { boost: 1.5, sort: 'priority' },
        'important': { boost: 1.3, sort: 'priority' },
        'recent': { sort: 'date_desc' },
        'frequent': { sort: 'frequency_desc' }
      }
    };
  }

  /**
   * Get conversation context for a user (Step 5.2 enhancement)
   * @param {string} userEmail - User's email
   * @returns {Object} - Conversation context
   */
  getConversationContext(userEmail) {
    if (!userEmail) return { queries: [], topics: [], entities: {} };
    
    if (!this.conversationHistory.has(userEmail)) {
      this.conversationHistory.set(userEmail, {
        queries: [],
        topics: [],
        entities: {},
        lastActivity: Date.now()
      });
    }
    
    return this.conversationHistory.get(userEmail);
  }

  /**
   * Update conversation context with new query (Step 5.2 enhancement)
   * @param {string} userEmail - User's email
   * @param {string} query - Original query
   * @param {Object} processedQuery - Processed query object
   */
  updateConversationContext(userEmail, query, processedQuery) {
    if (!userEmail) return;
    
    const context = this.getConversationContext(userEmail);
    
    // Add query to history (keep last 10)
    context.queries.unshift({
      original: query,
      intent: processedQuery.intent,
      entities: processedQuery.entities,
      timestamp: Date.now()
    });
    if (context.queries.length > 10) {
      context.queries = context.queries.slice(0, 10);
    }
    
    // Update topics and entities
    if (processedQuery.entities) {
      Object.keys(processedQuery.entities).forEach(key => {
        if (!context.entities[key]) context.entities[key] = new Set();
        if (Array.isArray(processedQuery.entities[key])) {
          processedQuery.entities[key].forEach(val => context.entities[key].add(val));
        } else {
          context.entities[key].add(processedQuery.entities[key]);
        }
      });
    }
    
    context.lastActivity = Date.now();
  }

  /**
   * Optimize query based on patterns and context (Step 5.2 enhancement)
   * @param {Object} query - Processed query
   * @param {Object} context - Request context
   * @returns {Object} - Optimized query
   */
  optimizeQuery(query, context) {
    const optimized = { ...query };
    
    // Apply time range optimization
    if (!optimized.parameters.timeRange && query.originalQuery) {
      const timeKeywords = Object.keys(this.queryOptimizationRules.timeRangeDefaults);
      const foundKeyword = timeKeywords.find(keyword => 
        query.originalQuery.toLowerCase().includes(keyword)
      );
      if (foundKeyword) {
        optimized.parameters.timeRange = this.queryOptimizationRules.timeRangeDefaults[foundKeyword];
      }
    }
    
    // Apply result limit optimization
    if (!optimized.parameters.limit) {
      const intentType = query.intent.split('_')[1] || 'meetings';
      optimized.parameters.limit = this.queryOptimizationRules.resultLimits[intentType] || 10;
    }
    
    // Apply priority-based sorting
    const priorityKeywords = Object.keys(this.queryOptimizationRules.priorityKeywords);
    const foundPriority = priorityKeywords.find(keyword => 
      query.originalQuery.toLowerCase().includes(keyword)
    );
    if (foundPriority) {
      const rule = this.queryOptimizationRules.priorityKeywords[foundPriority];
      if (rule.sort) optimized.parameters.sort_by = rule.sort;
      if (rule.boost) optimized.parameters.boost = rule.boost;
    }
    
    // Add organizational context if available
    if (context.userEmail) {
      const domain = context.userEmail.split('@')[1];
      if (domain) {
        optimized.parameters.organizationDomain = domain;
      }
    }
    
    return optimized;
  }

  /**
   * Process a natural language query about meeting intelligence with enhanced capabilities
   * @param {string} query - User's natural language query
   * @param {Object} context - Additional context (user info, recent queries, etc.)
   * @returns {Promise<Object>} - Processed query with intent and parameters
   */
  async processQuery(query, context = {}) {
    try {
      console.log(`[LLMService] Processing query: "${query}"`);
      
      // Get conversation context for this user (Step 5.2 enhancement)
      const userContext = this.getConversationContext(context.userEmail);
      
      // Build enhanced prompt with context
      const prompt = this.buildEnhancedQueryProcessingPrompt(query, context, userContext);
      
      // Use configured AI service
      const service = aiConfig.service.toLowerCase();
      let response;
      
      if (service === 'litellm') {
        const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
        
        // Use max_completion_tokens for newer models (gpt-5, gpt-5-mini), max_tokens for older ones
        const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
        const requestParams = {
          model: model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          [tokenParam]: 1000
        };
        
        const completion = await litellmService.completion(requestParams);
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
      
      // Apply query optimization (Step 5.2 enhancement)
      const optimizedQuery = this.optimizeQuery(processedQuery, context);
      
      // Update conversation context (Step 5.2 enhancement)
      this.updateConversationContext(context.userEmail, query, optimizedQuery);
      
      console.log(`[LLMService] Processed query intent: ${optimizedQuery.intent}`);
      return optimizedQuery;
      
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
        const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
        
        // Use max_completion_tokens for newer models (gpt-5, gpt-5-mini), max_tokens for older ones
        const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
        const requestParams = {
          model: model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          [tokenParam]: 1500
        };
        
        const completion = await litellmService.completion(requestParams);
        console.log(`[LLMService] Raw completion response:`, JSON.stringify(completion, null, 2));
        response = completion.choices[0].message.content;
        console.log(`[LLMService] Extracted content:`, response);
      } else {
        response = await openaiService.generateResponse([
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          max_tokens: 1500
        });
      }

      console.log(`[LLMService] Generated response (${response ? response.length : 0} characters)`);
      
      // Handle empty responses
      if (!response || response.trim().length === 0) {
        console.warn(`[LLMService] Empty response received, providing fallback`);
        return "I found the information you requested, but I'm having trouble generating a response right now. Please try rephrasing your question.";
      }
      
      return response;
      
    } catch (error) {
      console.error(`[LLMService] Error generating response:`, error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async generateResponse(queryResults, intent, context = {}) {
    try {
      const userContext = this.getConversationContext(context.userEmail);
      const prompt = this.buildResponseGenerationPrompt(context.originalQuery || 'Show me relevant information', queryResults, context);
      
      // Use configured AI service (consistent with processQuery method)
      const service = aiConfig.service.toLowerCase();
      let response;
      
      if (service === 'litellm') {
        const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
        
        // Use max_completion_tokens for newer models (gpt-5, gpt-5-mini), max_tokens for older ones
        const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
        const requestParams = {
          model: model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          [tokenParam]: 1000
        };
        
        const completion = await litellmService.completion(requestParams);
        response = completion.choices[0].message.content;
      } else {
        response = await openaiService.generateResponse([
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ], {
          temperature: 0.7,
          max_tokens: 1000
        });
      }

      if (!response || !response.trim()) {
        return {
          text: "I found some information but couldn't generate a proper response. Please try rephrasing your question.",
          data: queryResults,
          visualizations: this.getVisualizationsForIntent(intent, queryResults),
          followUps: this.generateFollowUpSuggestions(queryResults, intent, context)
        };
      }

      return {
        text: response.trim(),
        data: queryResults,
        visualizations: this.getVisualizationsForIntent(intent, queryResults),
        followUps: this.generateFollowUpSuggestions(queryResults, intent, context)
      };
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        text: "I encountered an issue while processing your request. Please try again.",
        data: queryResults,
        visualizations: [],
        followUps: []
      };
    }
  }

  /**
   * Get appropriate visualizations based on query intent and results
   */
  getVisualizationsForIntent(intent, queryResults) {
    const visualizations = [];

    switch (intent) {
      case 'organization_hierarchy':
      case 'find_people':
        if (queryResults.people && queryResults.people.length > 3) {
          visualizations.push({
            type: 'organization',
            data: queryResults,
            title: 'Organization Structure'
          });
        }
        break;

      case 'collaboration_analysis':
      case 'network_analysis':
        visualizations.push({
          type: 'collaboration',
          data: queryResults,
          title: 'Collaboration Network'
        });
        break;

      case 'meeting_frequency':
      case 'time_analysis':
        if (queryResults.meetings && queryResults.meetings.length > 0) {
          visualizations.push({
            type: 'timeline',
            data: queryResults,
            title: 'Meeting Timeline'
          });
        }
        break;

      case 'department_analysis':
        visualizations.push({
          type: 'departments',
          data: queryResults,
          title: 'Department Statistics'
        });
        break;

      case 'topic_analysis':
      case 'content_analysis':
        if (queryResults.topics && queryResults.topics.length > 0) {
          visualizations.push({
            type: 'topics',
            data: queryResults,
            title: 'Topic Evolution'
          });
        }
        break;

      case 'find_meetings':
        if (queryResults.meetings && queryResults.meetings.length > 5) {
          visualizations.push({
            type: 'timeline',
            data: queryResults,
            title: 'Meeting Timeline'
          });
        }
        break;

      default:
        // For general queries, add relevant visualizations based on data content
        if (queryResults.meetings && queryResults.meetings.length > 3) {
          visualizations.push({
            type: 'timeline',
            data: queryResults,
            title: 'Meeting Activity'
          });
        }
        if (queryResults.people && queryResults.people.length > 2) {
          visualizations.push({
            type: 'collaboration',
            data: queryResults,
            title: 'Key Collaborators'
          });
        }
    }

    return visualizations;
  }

  /**
   * Build prompt for query processing (legacy method for backward compatibility)
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   */
  buildQueryProcessingPrompt(query, context) {
    // Use enhanced version with empty user context
    return this.buildEnhancedQueryProcessingPrompt(query, context, { queries: [], topics: [], entities: {} });
  }

  /**
   * Build enhanced prompt for query processing with context (Step 5.2 enhancement)
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @param {Object} userContext - User's conversation context
   * @returns {string} - Formatted prompt
   */
  buildEnhancedQueryProcessingPrompt(query, context, userContext) {
    const recentQueries = userContext.queries.slice(0, 3).map(q => 
      `- "${q.original}" (${q.intent})`
    ).join('\n');
    
    const knownEntities = Object.keys(userContext.entities).map(key => 
      `${key}: ${Array.from(userContext.entities[key]).slice(0, 3).join(', ')}`
    ).join('\n');
    
    return `Analyze this meeting intelligence query and extract the intent and parameters. Consider conversation context and optimize for the user's needs.

Current Query: "${query}"

User Context:
- Email: ${context.userEmail || 'Unknown'}
- Organization: ${context.organizationDomain || context.userEmail?.split('@')[1] || 'Unknown'}

Recent Conversation:
${recentQueries || 'No recent queries'}

Known Entities:
${knownEntities || 'No previous entities'}

Please respond with a JSON object containing:
{
  "intent": "one of: find_meetings, get_participants, find_documents, analyze_relationships, get_organization_hierarchy, get_department_stats, find_colleagues, analyze_collaboration, general_query",
  "entities": {
    "people": ["email addresses or names mentioned"],
    "dates": ["specific dates or date ranges"],
    "topics": ["meeting topics or keywords"],
    "locations": ["meeting locations if mentioned"],
    "departments": ["department names or codes"],
    "organizations": ["organization domains or names"]
  },
  "parameters": {
    "limit": 10,
    "sort_by": "date",
    "include_content": false,
    "timeRange": "number of days to look back",
    "includeHierarchy": false,
    "crossDepartment": false,
    "collaborationDepth": 1
  },
  "confidence": 0.8,
  "queryComplexity": "simple|moderate|complex",
  "suggestedFollowups": ["relevant follow-up questions based on intent"]
}

Be precise with entity extraction, consider conversation context, and choose the most appropriate intent including organizational intelligence capabilities.`;
  }

  /**
   * Build original prompt for query processing (original implementation)
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   */
  buildOriginalQueryProcessingPrompt(query, context) {
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
   * Build enhanced prompt for response generation with context awareness (Step 5.2)
   * @param {string} originalQuery - Original query
   * @param {Object} queryResults - Database results
   * @param {Object} context - Additional context
   * @returns {string} - Formatted prompt
   */
  buildResponseGenerationPrompt(originalQuery, queryResults, context) {
    const userContext = this.getConversationContext(context.userEmail);
    const recentTopics = userContext.queries.slice(0, 2).map(q => q.intent).join(', ');
    
    return `Generate a helpful, natural language response to this meeting intelligence query with enhanced context awareness and organizational insights.

Original Query: "${originalQuery}"

Query Results:
${JSON.stringify(queryResults, null, 2)}

Context:
- User: ${context.userEmail || 'Unknown'}
- Organization: ${context.organizationDomain || context.userEmail?.split('@')[1] || 'Unknown'}
- Total results found: ${queryResults.totalResults || 0}
- Recent conversation topics: ${recentTopics || 'None'}
- Query complexity: ${queryResults.complexity || 'moderate'}

Please provide a response that:
1. Directly answers the user's question with specific data points
2. Summarizes key findings and provides actionable insights
3. Highlights interesting patterns, trends, or organizational insights
4. Provides context about collaboration patterns if relevant
5. Suggests 2-3 specific, relevant follow-up questions based on the results
6. Uses a conversational, professional tone
7. Includes organizational context when discussing people or departments

For organizational queries, include:
- Department relationships and hierarchy context
- Collaboration patterns and cross-functional insights
- Meeting frequency and engagement metrics
- Suggestions for improving collaboration or communication

If no results were found:
- Explain possible reasons (time range, access permissions, data availability)
- Suggest alternative queries or different approaches
- Offer to help with related organizational or meeting intelligence questions

Keep the response informative but concise (2-4 paragraphs), and always end with actionable follow-up suggestions.`;
  }

  /**
   * Generate context-aware follow-up suggestions (Step 5.2 enhancement)
   * @param {Object} queryResults - Query results
   * @param {string} intent - Query intent
   * @param {Object} context - User context
   * @returns {Array} - Follow-up suggestions
   */
  generateFollowUpSuggestions(queryResults, intent, context) {
    const suggestions = [];
    
    switch (intent) {
      case 'find_meetings':
        suggestions.push('Who were the key participants in these meetings?');
        suggestions.push('What documents were shared in these meetings?');
        suggestions.push('Show me collaboration patterns from these meetings');
        break;
        
      case 'get_participants':
        suggestions.push('What meetings did these people organize together?');
        suggestions.push('Show me the organizational hierarchy for these participants');
        suggestions.push('Analyze collaboration frequency between these people');
        break;
        
      case 'analyze_relationships':
        suggestions.push('Which departments collaborate most frequently?');
        suggestions.push('Show me recent cross-functional meetings');
        suggestions.push('What are the communication patterns in my organization?');
        break;
        
      case 'get_organization_hierarchy':
        suggestions.push('Show me department statistics and metrics');
        suggestions.push('Who are the most active collaborators across departments?');
        suggestions.push('Analyze meeting patterns by organizational level');
        break;
        
      default:
        suggestions.push('Show me recent meetings in my organization');
        suggestions.push('Who do I collaborate with most frequently?');
        suggestions.push('What are the trending topics in our meetings?');
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Parse the LLM response for query processing
   * @param {string} response - LLM response
   * @param {string} originalQuery - Original query for fallback
   * @returns {Object} - Parsed query object
   */
  parseQueryResponse(response, originalQuery) {
    try {
      // Log the raw response for debugging
      console.log(`[LLMService] Raw LLM response:`, response);
      
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Try to parse JSON response
      const parsed = JSON.parse(cleanResponse);
      
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
      console.warn(`[LLMService] Problematic response:`, response);
      
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
