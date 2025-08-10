/**
 * Query Planning Service
 * Enables LLM to create intelligent multi-step query strategies
 */
const llmService = require('../llm/llmService');
const fs = require('fs').promises;
const path = require('path');

class QueryPlanningService {
  constructor() {
    this.databaseCapabilities = null;
    this.strategyTemplates = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the service by loading database capabilities documentation
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load database capabilities documentation
      const capabilitiesPath = path.join(__dirname, '../../../docs/database-capabilities.md');
      this.databaseCapabilities = await fs.readFile(capabilitiesPath, 'utf8');
      
      // Initialize strategy templates
      this.initializeStrategyTemplates();
      
      this.initialized = true;
      console.log('[QueryPlanningService] Initialized successfully');
    } catch (error) {
      console.error('[QueryPlanningService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create an intelligent query strategy for a complex user question
   * @param {string} userQuery - The user's natural language query
   * @param {Object} context - Additional context (user info, conversation history, etc.)
   * @returns {Promise<Object>} - Comprehensive query strategy
   */
  async createQueryStrategy(userQuery, context = {}) {
    try {
      await this.initialize();

      console.log('[QueryPlanningService] Creating strategy for:', userQuery);
      
      // Store current query and context for fallback strategy
      this.currentUserQuery = userQuery;
      this.currentContext = context;

      const strategyPrompt = this.buildStrategyPlanningPrompt(userQuery, context);
      const systemPrompt = this.getStrategyPlanningSystemPrompt();
      
      console.log('[QueryPlanningService] 📤 Sending prompt to LLM:');
      console.log('[QueryPlanningService] System prompt length:', systemPrompt.length);
      console.log('[QueryPlanningService] User prompt preview:', strategyPrompt.substring(0, 300) + '...');
      
      const strategyResponse = await llmService.generateResponse(strategyPrompt, {}, {
        ...context,
        systemPrompt: systemPrompt
      });

      console.log('[QueryPlanningService] Raw LLM response:', strategyResponse);
      console.log('[QueryPlanningService] Response type:', typeof strategyResponse);

      // Parse and validate the strategy
      const strategy = this.parseStrategyResponse(strategyResponse);
      const validatedStrategy = await this.validateStrategy(strategy);

      return {
        userQuery,
        strategy: validatedStrategy,
        estimatedSteps: validatedStrategy.steps.length,
        estimatedComplexity: this.estimateComplexity(validatedStrategy),
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[QueryPlanningService] Strategy creation failed:', error);
      throw new Error(`Failed to create query strategy: ${error.message}`);
    }
  }

  /**
   * Build the strategy planning prompt for the LLM
   * @param {string} userQuery - User's query
   * @param {Object} context - Additional context
   * @returns {string} - Complete prompt for strategy planning
   */
  buildStrategyPlanningPrompt(userQuery, context) {
    const conversationContext = context.conversationHistory 
      ? `\n\nConversation History:\n${this.formatConversationHistory(context.conversationHistory)}`
      : '';

    const userContext = context.user 
      ? `\n\nUser Context:\n- Email: ${context.user.email}\n- Name: ${context.user.name}`
      : '';

    return `
# Query Strategy Planning Request

## User Query
"${userQuery}"

## Database Capabilities
${this.databaseCapabilities}

## Context
${userContext}${conversationContext}

## Task
Create a comprehensive multi-step query strategy to answer the user's question. The strategy should:

1. **Break down the complex question** into logical components
2. **Identify required data sources** and query types needed
3. **Plan the sequence of queries** with dependencies
4. **Consider follow-up analysis** that might be needed
5. **Optimize for performance** using the database capabilities guide

## Strategy Format
Respond with a JSON object containing:

\`\`\`json
{
  "analysis": "Brief analysis of what the user is asking for",
  "complexity": "low|medium|high",
  "steps": [
    {
      "stepNumber": 1,
      "description": "What this step accomplishes",
      "queryType": "find_meetings|get_participants|analyze_collaboration|etc.",
      "parameters": {
        "key": "value pairs for the query"
      },
      "dependencies": [],
      "estimatedTime": "fast|medium|slow",
      "purpose": "Why this step is needed"
    }
  ],
  "expectedOutcome": "What the final result should provide to the user",
  "followUpQuestions": ["Suggested follow-up questions based on expected results"]
}
\`\`\`

## Examples of Good Strategies

### Simple Query Example
User: "Who attended my meetings last week?"
Strategy: Single step with find_meetings filtered by user and timeframe

### Complex Query Example  
User: "Who are my most frequent collaborators and what topics do we usually discuss?"
Strategy: 
1. Find frequent collaborators (analyze_collaboration)
2. Find meetings with those collaborators (find_meetings) 
3. Analyze meeting topics (analyze_topic_trends)
4. Synthesize collaboration + topic analysis

### Multi-Department Analysis Example
User: "How does engineering collaborate with other departments?"
Strategy:
1. Identify engineering team members (get_participants with email domain filter)
2. Find cross-department meetings (analyze_collaboration with department filter)
3. Analyze communication patterns (analyze_communication_flow)
4. Generate insights on collaboration effectiveness

Remember: Start with simple, indexed queries and build complexity. Use timeframe filters early. Consider performance implications.

CRITICAL INSTRUCTION: You MUST respond with ONLY the JSON strategy object wrapped in \`\`\`json code blocks. 

❌ DO NOT write conversational responses like "I looked for meetings..." or "I found..."
❌ DO NOT provide explanations or commentary
❌ DO NOT analyze the data or provide results
✅ DO provide ONLY the JSON strategy for how to query the data

Your response should look exactly like this:
\`\`\`json
{
  "analysis": "Brief analysis of what the user is asking for",
  "complexity": "low",
  "steps": [...],
  "expectedOutcome": "What the final result should provide",
  "followUpQuestions": [...]
}
\`\`\`

RESPOND WITH JSON ONLY. NO OTHER TEXT.
`;
  }

  /**
   * Create a simple strategy when LLM returns conversational response
   * @param {string} query - Original user query
   * @param {Object} context - User context for filtering
   * @returns {Object} - Simple strategy object
   */
  createSimpleStrategy(query, context = {}) {
    // Analyze the query to determine the appropriate strategy
    const queryLower = query.toLowerCase();
    
    let queryType = 'find_meetings'; // Default
    let parameters = {};
    let description = 'Find relevant meetings';
    
    // Determine query type based on keywords
    if (queryLower.includes('meeting') || queryLower.includes('week') || queryLower.includes('today') || queryLower.includes('schedule')) {
      queryType = 'find_meetings';
      description = 'Find meetings based on timeframe';
      
      // Add timeframe parameters
      if (queryLower.includes('week') || queryLower.includes('this week')) {
        parameters.timeframe = 'this_week';
      } else if (queryLower.includes('today')) {
        parameters.timeframe = 'today';
      } else if (queryLower.includes('tomorrow')) {
        parameters.timeframe = 'tomorrow';
      } else if (queryLower.includes('august')) {
        parameters.timeframe = 'august';
      } else if (queryLower.includes('month') || queryLower.includes('this month')) {
        parameters.timeframe = 'this_month';
      } else if (queryLower.includes('last month')) {
        parameters.timeframe = 'last_month';
      } else {
        parameters.timeframe = 'recent';
      }
      
      // Add user context for filtering
      if (context.userEmail) {
        parameters.userEmail = context.userEmail;
      }
    } else if (queryLower.includes('people') || queryLower.includes('participant') || queryLower.includes('who')) {
      queryType = 'get_participants';
      description = 'Find people and participants';
    } else if (queryLower.includes('document') || queryLower.includes('file')) {
      queryType = 'find_documents';
      description = 'Find documents and files';
    } else if (queryLower.includes('collaborat')) {
      queryType = 'analyze_collaboration';
      description = 'Analyze collaboration patterns';
    }
    
    return {
      analysis: `Simple strategy for: ${query}`,
      complexity: 'low',
      steps: [
        {
          stepNumber: 1,
          description: description,
          queryType: queryType,
          parameters: parameters,
          dependencies: [],
          estimatedTime: 'fast',
          purpose: 'Respond to user query with relevant data'
        }
      ],
      expectedOutcome: 'Provide relevant information based on user query',
      followUpQuestions: ['Would you like more details?', 'Any specific timeframe?']
    };
  }

  /**
   * Get the system prompt for strategy planning
   * @returns {string} - System prompt
   */
  getStrategyPlanningSystemPrompt() {
    return `You are an expert database query strategist for an organizational intelligence system. Your role is to analyze complex user questions and create efficient, multi-step query strategies.

CRITICAL: You MUST respond ONLY with valid JSON. Do not include any explanatory text, conversation, or natural language responses. Only return the JSON strategy object.

Key Principles:
1. **Efficiency First**: Start with indexed lookups, apply filters early
2. **Logical Progression**: Each step should build on previous results  
3. **Performance Awareness**: Consider query complexity and execution time
4. **Comprehensive Coverage**: Ensure the strategy will fully answer the user's question
5. **Fallback Planning**: Consider what to do if intermediate steps return no results

You have access to a Neo4j graph database with Person, Meeting, and Document nodes, plus 13 different query types ranging from simple lookups to complex organizational analysis.

RESPONSE FORMAT: Respond ONLY with valid JSON wrapped in \`\`\`json code blocks. No other text is allowed.`;
  }

  /**
   * Parse the LLM's strategy response
   * @param {string|Object} response - LLM response
   * @returns {Object} - Parsed strategy object
   */
  parseStrategyResponse(response) {
    try {
      // Handle both string and object responses
      let responseText = typeof response === 'object' && response.text 
        ? response.text 
        : response;

      console.log('[QueryPlanningService] Parsing response text:', responseText);

      // If the response text looks like a conversational response, it means the LLM
      // didn't follow our JSON format instructions. This is the core issue we need to fix.
      if (responseText && typeof responseText === 'string' && 
          (responseText.startsWith('I found') || 
           responseText.startsWith('I looked') || 
           responseText.startsWith('I searched') ||
           responseText.includes('couldn\'t generate') ||
           responseText.includes('can happen for a few common reasons') ||
           !responseText.trim().startsWith('{'))) {
        console.log('[QueryPlanningService] ❌ LLM FAILED TO RETURN JSON STRATEGY!');
        console.log('[QueryPlanningService] Expected JSON strategy, but got conversational response:');
        console.log('[QueryPlanningService] Response preview:', responseText.substring(0, 200) + '...');
        throw new Error('LLM returned conversational response instead of required JSON strategy format');
      }

      // Extract JSON from response if it's wrapped in markdown
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      const strategy = JSON.parse(responseText);
      
      // Validate required fields
      if (!strategy.steps || !Array.isArray(strategy.steps)) {
        throw new Error('Strategy must contain a steps array');
      }

      if (!strategy.analysis || !strategy.complexity) {
        throw new Error('Strategy must contain analysis and complexity fields');
      }

      return strategy;

    } catch (error) {
      console.error('[QueryPlanningService] Failed to parse strategy response:', error);
      throw new Error(`Invalid strategy format: ${error.message}`);
    }
  }

  /**
   * Validate and optimize a query strategy
   * @param {Object} strategy - Strategy to validate
   * @returns {Promise<Object>} - Validated and optimized strategy
   */
  async validateStrategy(strategy) {
    const validatedStrategy = { ...strategy };
    
    // Validate each step
    validatedStrategy.steps = strategy.steps.map((step, index) => {
      const validatedStep = { ...step };
      
      // Ensure step number is correct
      validatedStep.stepNumber = index + 1;
      
      // Validate query type
      if (!this.isValidQueryType(step.queryType)) {
        console.warn(`[QueryPlanningService] Invalid query type: ${step.queryType}, defaulting to general_query`);
        validatedStep.queryType = 'general_query';
      }
      
      // Ensure required fields exist
      validatedStep.parameters = validatedStep.parameters || {};
      validatedStep.dependencies = validatedStep.dependencies || [];
      validatedStep.estimatedTime = validatedStep.estimatedTime || 'medium';
      
      // Validate dependencies
      validatedStep.dependencies = validatedStep.dependencies.filter(dep => 
        dep > 0 && dep < validatedStep.stepNumber
      );
      
      return validatedStep;
    });

    // Add optimization suggestions
    validatedStrategy.optimizations = this.generateOptimizations(validatedStrategy);
    
    return validatedStrategy;
  }

  /**
   * Estimate the complexity of a query strategy
   * @param {Object} strategy - Strategy to analyze
   * @returns {string} - Complexity level (low|medium|high)
   */
  estimateComplexity(strategy) {
    const stepCount = strategy.steps.length;
    const hasSlowQueries = strategy.steps.some(step => step.estimatedTime === 'slow');
    const hasComplexAnalysis = strategy.steps.some(step => 
      ['analyze_collaboration', 'analyze_communication_flow', 'analyze_topic_trends'].includes(step.queryType)
    );

    if (stepCount <= 2 && !hasSlowQueries) {
      return 'low';
    } else if (stepCount <= 4 && !hasComplexAnalysis) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Check if a query type is valid
   * @param {string} queryType - Query type to validate
   * @returns {boolean} - Whether the query type is valid
   */
  isValidQueryType(queryType) {
    const validTypes = [
      'find_meetings', 'get_participants', 'find_documents', 'analyze_relationships',
      'general_query', 'analyze_collaboration', 'find_frequent_collaborators',
      'analyze_meeting_patterns', 'get_department_insights', 'analyze_topic_trends',
      'find_meeting_conflicts', 'get_productivity_insights', 'analyze_communication_flow'
    ];
    
    return validTypes.includes(queryType);
  }

  /**
   * Generate optimization suggestions for a strategy
   * @param {Object} strategy - Strategy to optimize
   * @returns {Array} - Array of optimization suggestions
   */
  generateOptimizations(strategy) {
    const optimizations = [];
    
    // Check for missing timeframe filters
    const hasTimeframeFilter = strategy.steps.some(step => 
      step.parameters && (step.parameters.timeframe || step.parameters.startDate || step.parameters.endDate)
    );
    
    if (!hasTimeframeFilter) {
      optimizations.push({
        type: 'performance',
        suggestion: 'Consider adding timeframe filters to improve query performance',
        impact: 'medium'
      });
    }
    
    // Check for potential parallelization
    const independentSteps = strategy.steps.filter(step => 
      !step.dependencies || step.dependencies.length === 0
    );
    
    if (independentSteps.length > 1) {
      optimizations.push({
        type: 'performance',
        suggestion: `Steps ${independentSteps.map((s, index) => s.stepNumber || index + 1).join(', ')} can be executed in parallel`,
        impact: 'high'
      });
    }
    
    // Check for overly complex single steps
    const complexSteps = strategy.steps.filter(step => step.estimatedTime === 'slow');
    if (complexSteps.length > 0) {
      optimizations.push({
        type: 'complexity',
        suggestion: 'Consider breaking down slow queries into smaller, more focused steps',
        impact: 'medium'
      });
    }
    
    return optimizations;
  }

  /**
   * Initialize strategy templates for common patterns
   */
  initializeStrategyTemplates() {
    // Template for collaboration analysis
    this.strategyTemplates.set('collaboration_analysis', {
      pattern: /collaborat|work.*(with|together)|team.*work|partner/i,
      template: {
        complexity: 'medium',
        steps: [
          {
            queryType: 'find_frequent_collaborators',
            purpose: 'Identify key collaboration relationships'
          },
          {
            queryType: 'analyze_collaboration',
            purpose: 'Analyze collaboration patterns and strength'
          }
        ]
      }
    });

    // Template for meeting analysis
    this.strategyTemplates.set('meeting_analysis', {
      pattern: /meeting.*pattern|when.*meet|meeting.*frequency/i,
      template: {
        complexity: 'low',
        steps: [
          {
            queryType: 'find_meetings',
            purpose: 'Find relevant meetings'
          },
          {
            queryType: 'analyze_meeting_patterns',
            purpose: 'Analyze meeting timing and frequency patterns'
          }
        ]
      }
    });
  }

  /**
   * Format conversation history for context
   * @param {Array} history - Conversation history
   * @returns {string} - Formatted history
   */
  formatConversationHistory(history) {
    return history.slice(-3).map((item, index) => 
      `${index + 1}. Q: "${item.query}" A: "${item.response?.substring(0, 100)}..."`
    ).join('\n');
  }
}

module.exports = QueryPlanningService;
