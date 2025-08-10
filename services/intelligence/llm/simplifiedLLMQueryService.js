/**
 * Simplified LLM Query Service
 * Clean interface between LLM and graph database tools
 */

const simplifiedGraphTools = require('../graph/simplifiedGraphTools');

class SimplifiedLLMQueryService {
  constructor() {
    // Map of available tools that LLM can use
    this.availableTools = {
      find_meetings: simplifiedGraphTools.tools.find_meetings,
      find_documents: simplifiedGraphTools.tools.find_documents,
      find_people: simplifiedGraphTools.tools.find_people,
      get_meeting_details: simplifiedGraphTools.tools.get_meeting_details,
      analyze_patterns: simplifiedGraphTools.tools.analyze_patterns
    };
  }

  /**
   * Execute a query using the specified tool
   * @param {string} toolName - Name of the tool to use
   * @param {Object} parameters - Parameters for the tool
   * @param {Object} context - User context (email, etc.)
   * @returns {Promise<Object>} - Tool execution results
   */
  async executeQuery(toolName, parameters = {}, context = {}) {
    try {
      console.log(`[SimplifiedLLMQueryService] Executing tool: ${toolName}`);
      console.log(`[SimplifiedLLMQueryService] Parameters:`, JSON.stringify(parameters, null, 2));
      
      // Validate tool exists
      if (!this.availableTools[toolName]) {
        throw new Error(`Unknown tool: ${toolName}. Available tools: ${Object.keys(this.availableTools).join(', ')}`);
      }
      
      // Execute the tool
      const tool = this.availableTools[toolName];
      let result;
      
      if (toolName === 'get_meeting_details') {
        // Special case: get_meeting_details takes meeting_id as direct parameter
        result = await tool(parameters.meeting_id || parameters.id);
      } else if (toolName === 'analyze_patterns') {
        // Special case: analyze_patterns takes type and criteria
        result = await tool(parameters.type, parameters.criteria || {});
      } else {
        // Standard case: pass parameters object
        result = await tool(parameters);
      }
      
      console.log(`[SimplifiedLLMQueryService] Tool ${toolName} completed. Results: ${result.count || 'N/A'} items`);
      
      return {
        success: true,
        tool: toolName,
        parameters: parameters,
        result: result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[SimplifiedLLMQueryService] Error executing tool ${toolName}:`, error);
      
      return {
        success: false,
        tool: toolName,
        parameters: parameters,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get list of available tools and their descriptions
   * @returns {Object} - Tool descriptions for LLM
   */
  getAvailableTools() {
    return {
      find_meetings: {
        description: "Find meetings based on person, timeframe, or keywords",
        parameters: ["person", "timeframe", "keywords", "limit"],
        use_cases: ["Find meetings with specific person", "Get meetings from timeframe", "Search by keywords"]
      },
      find_documents: {
        description: "Find documents and their content from meetings",
        parameters: ["meeting_id", "person", "keywords", "limit"],
        use_cases: ["Get documents from specific meeting", "Find documents by person", "Search document content"]
      },
      find_people: {
        description: "Find people and their meeting participation",
        parameters: ["name", "meeting_keywords", "timeframe", "limit"],
        use_cases: ["Find specific person", "Get meeting participants", "Analyze participation patterns"]
      },
      get_meeting_details: {
        description: "Get complete details for a specific meeting",
        parameters: ["meeting_id"],
        use_cases: ["Get full meeting info", "See all attendees and documents", "Complete meeting analysis"]
      },
      analyze_patterns: {
        description: "Analyze patterns in meetings, documents, or collaboration",
        parameters: ["type", "criteria"],
        use_cases: ["Collaboration analysis", "Meeting frequency analysis", "Document trends"]
      }
    };
  }

  /**
   * Parse natural language query and suggest appropriate tool
   * @param {string} query - User's natural language query
   * @returns {Object} - Suggested tool and parameters
   */
  suggestTool(query) {
    const lowerQuery = query.toLowerCase();
    
    // Meeting content queries
    if (lowerQuery.includes('discussed') || lowerQuery.includes('talked about') || lowerQuery.includes('content')) {
      return {
        tool: 'find_documents',
        reasoning: 'Query asks about meeting content/discussions',
        suggested_parameters: this.extractParameters(query, 'content')
      };
    }
    
    // Specific meeting details
    if (lowerQuery.includes('meeting details') || lowerQuery.includes('who attended') || lowerQuery.includes('full details')) {
      return {
        tool: 'get_meeting_details',
        reasoning: 'Query asks for complete meeting information',
        suggested_parameters: this.extractParameters(query, 'details')
      };
    }
    
    // People/participant queries
    if (lowerQuery.includes('who') || lowerQuery.includes('participants') || lowerQuery.includes('attendees')) {
      return {
        tool: 'find_people',
        reasoning: 'Query asks about people or participants',
        suggested_parameters: this.extractParameters(query, 'people')
      };
    }
    
    // Pattern analysis
    if (lowerQuery.includes('how often') || lowerQuery.includes('patterns') || lowerQuery.includes('trends')) {
      return {
        tool: 'analyze_patterns',
        reasoning: 'Query asks for pattern or trend analysis',
        suggested_parameters: this.extractParameters(query, 'patterns')
      };
    }
    
    // Default to finding meetings
    return {
      tool: 'find_meetings',
      reasoning: 'General meeting search query',
      suggested_parameters: this.extractParameters(query, 'meetings')
    };
  }

  /**
   * Extract parameters from natural language query
   * @param {string} query - User's query
   * @param {string} type - Type of extraction (content, details, people, patterns, meetings)
   * @returns {Object} - Extracted parameters
   */
  extractParameters(query, type) {
    const params = {};
    
    // Extract person names (common patterns)
    const personMatches = query.match(/with\s+(\w+)|(\w+)'s\s+|meeting\s+(\w+)/gi);
    if (personMatches) {
      const person = personMatches[0].replace(/with\s+|'s\s+|meeting\s+/gi, '').trim();
      if (person && person.length > 1) {
        params.person = person;
      }
    }
    
    // Extract timeframe
    if (query.includes('yesterday')) params.timeframe = 'yesterday';
    else if (query.includes('last week')) params.timeframe = 'last week';
    else if (query.includes('last month')) params.timeframe = 'last month';
    else if (query.includes('today')) params.timeframe = 'today';
    
    // Extract specific date patterns (YYYY-MM-DD)
    const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      params.timeframe = dateMatch[0];
    }
    
    // Extract meeting keywords
    if (query.includes('1:1') || query.includes('one-on-one')) params.keywords = '1:1';
    else if (query.includes('standup')) params.keywords = 'standup';
    else if (query.includes('sync')) params.keywords = 'sync';
    else if (query.includes('all hands')) params.keywords = 'all hands';
    
    // Type-specific parameter extraction
    switch (type) {
      case 'patterns':
        if (query.includes('collaboration')) params.type = 'collaboration';
        else if (query.includes('frequency')) params.type = 'meeting_frequency';
        else if (query.includes('document')) params.type = 'document_trends';
        params.criteria = { person: params.person, timeframe: params.timeframe };
        break;
        
      case 'content':
        // For content queries, we want documents
        break;
        
      case 'details':
        // For details, we need a meeting_id (would need to be provided by previous query)
        break;
    }
    
    return params;
  }
}

module.exports = new SimplifiedLLMQueryService();
