/**
 * Unit tests for Enhanced LLM Service - Step 5.2
 */
const llmService = require('../../../../services/intelligence/llm/llmService');
const openaiService = require('../../../../services/openaiService');
const litellmService = require('../../../../services/litellmService');

// Mock the AI services
jest.mock('../../../../services/openaiService');
jest.mock('../../../../services/litellmService');

// Mock the AI config
jest.mock('../../../../config/aiConfig', () => ({
  service: 'litellm',
  litellm: {
    fallbackModels: ['gpt-4']
  }
}));

describe('Enhanced LLM Service - Step 5.2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear conversation history
    llmService.conversationHistory.clear();
  });

  describe('Query Optimization Rules', () => {
    it('should initialize optimization rules correctly', () => {
      const rules = llmService.queryOptimizationRules;
      
      expect(rules.timeRangeDefaults).toBeDefined();
      expect(rules.timeRangeDefaults['recent']).toBe(30);
      expect(rules.timeRangeDefaults['last week']).toBe(7);
      
      expect(rules.resultLimits).toBeDefined();
      expect(rules.resultLimits['meetings']).toBe(20);
      expect(rules.resultLimits['participants']).toBe(50);
      
      expect(rules.priorityKeywords).toBeDefined();
      expect(rules.priorityKeywords['urgent'].boost).toBe(1.5);
    });
  });

  describe('Conversation Context Management', () => {
    it('should create new conversation context for new user', () => {
      const context = llmService.getConversationContext('test@example.com');
      
      expect(context).toBeDefined();
      expect(context.queries).toEqual([]);
      expect(context.topics).toEqual([]);
      expect(context.entities).toEqual({});
      expect(context.lastActivity).toBeDefined();
    });

    it('should return empty context for no email', () => {
      const context = llmService.getConversationContext(null);
      
      expect(context.queries).toEqual([]);
      expect(context.topics).toEqual([]);
      expect(context.entities).toEqual({});
    });

    it('should update conversation context with new query', () => {
      const userEmail = 'test@example.com';
      const query = 'Show me recent meetings';
      const processedQuery = {
        intent: 'find_meetings',
        entities: { people: ['john@test.com'], topics: ['planning'] },
        parameters: { limit: 10 }
      };

      llmService.updateConversationContext(userEmail, query, processedQuery);
      
      const context = llmService.getConversationContext(userEmail);
      expect(context.queries).toHaveLength(1);
      expect(context.queries[0].original).toBe(query);
      expect(context.queries[0].intent).toBe('find_meetings');
      expect(context.entities.people).toBeDefined();
      expect(Array.from(context.entities.people)).toContain('john@test.com');
    });

    it('should limit conversation history to 10 queries', () => {
      const userEmail = 'test@example.com';
      
      // Add 15 queries
      for (let i = 0; i < 15; i++) {
        llmService.updateConversationContext(userEmail, `query ${i}`, {
          intent: 'find_meetings',
          entities: {},
          parameters: {}
        });
      }
      
      const context = llmService.getConversationContext(userEmail);
      expect(context.queries).toHaveLength(10);
      expect(context.queries[0].original).toBe('query 14'); // Most recent
    });
  });

  describe('Query Optimization', () => {
    it('should optimize query with time range keywords', () => {
      const query = {
        intent: 'find_meetings',
        originalQuery: 'Show me meetings from last week',
        parameters: { limit: 5 },
        entities: {}
      };
      const context = { userEmail: 'test@example.com' };

      const optimized = llmService.optimizeQuery(query, context);
      
      expect(optimized.parameters.timeRange).toBe(7); // last week = 7 days
      expect(optimized.parameters.organizationDomain).toBe('example.com');
    });

    it('should optimize result limits based on intent type', () => {
      const query = {
        intent: 'get_participants',
        originalQuery: 'Who attended meetings',
        parameters: {},
        entities: {}
      };
      const context = { userEmail: 'test@example.com' };

      const optimized = llmService.optimizeQuery(query, context);
      
      expect(optimized.parameters.limit).toBe(50); // participants limit
    });

    it('should apply priority-based sorting', () => {
      const query = {
        intent: 'find_meetings',
        originalQuery: 'Show me urgent meetings',
        parameters: {},
        entities: {}
      };
      const context = { userEmail: 'test@example.com' };

      const optimized = llmService.optimizeQuery(query, context);
      
      expect(optimized.parameters.sort_by).toBe('priority');
      expect(optimized.parameters.boost).toBe(1.5);
    });
  });

  describe('Enhanced Query Processing', () => {
    it('should process query with conversation context', async () => {
      const mockResponse = JSON.stringify({
        intent: 'find_meetings',
        entities: { people: ['john@test.com'] },
        parameters: { limit: 10 },
        confidence: 0.9,
        queryComplexity: 'moderate',
        suggestedFollowups: ['Who attended these meetings?']
      });

      litellmService.completion.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      });

      const result = await llmService.processQuery('Show me recent meetings', {
        userEmail: 'test@example.com'
      });

      expect(result.intent).toBe('find_meetings');
      expect(result.parameters.timeRange).toBe(30); // 'recent' optimization
      expect(result.parameters.organizationDomain).toBe('example.com');
      expect(litellmService.completion).toHaveBeenCalled();
    });

    it('should build enhanced prompt with conversation context', () => {
      const userEmail = 'test@example.com';
      
      // Add some conversation history
      llmService.updateConversationContext(userEmail, 'Previous query', {
        intent: 'find_meetings',
        entities: { people: ['jane@test.com'] },
        parameters: {}
      });

      const prompt = llmService.buildEnhancedQueryProcessingPrompt(
        'Show me documents',
        { userEmail, organizationDomain: 'example.com' },
        llmService.getConversationContext(userEmail)
      );

      expect(prompt).toContain('Previous query');
      expect(prompt).toContain('find_meetings');
      expect(prompt).toContain('jane@test.com');
      expect(prompt).toContain('get_organization_hierarchy');
      expect(prompt).toContain('analyze_collaboration');
    });
  });

  describe('Context-Aware Follow-up Generation', () => {
    it('should generate follow-ups for find_meetings intent', () => {
      const suggestions = llmService.generateFollowUpSuggestions(
        { totalResults: 5 },
        'find_meetings',
        { userEmail: 'test@example.com' }
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('participants');
      expect(suggestions[1]).toContain('documents');
      expect(suggestions[2]).toContain('collaboration');
    });

    it('should generate follow-ups for organizational queries', () => {
      const suggestions = llmService.generateFollowUpSuggestions(
        { totalResults: 10 },
        'get_organization_hierarchy',
        { userEmail: 'test@example.com' }
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('department statistics');
      expect(suggestions[1]).toContain('collaborators');
      expect(suggestions[2]).toContain('organizational level');
    });

    it('should generate default follow-ups for unknown intents', () => {
      const suggestions = llmService.generateFollowUpSuggestions(
        { totalResults: 0 },
        'unknown_intent',
        { userEmail: 'test@example.com' }
      );

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toContain('recent meetings');
      expect(suggestions[1]).toContain('collaborate');
      expect(suggestions[2]).toContain('trending topics');
    });
  });

  describe('Enhanced Response Generation', () => {
    it('should generate context-aware response', async () => {
      const userEmail = 'test@example.com';
      
      // Add conversation context
      llmService.updateConversationContext(userEmail, 'Previous query', {
        intent: 'find_meetings',
        entities: {},
        parameters: {}
      });

      litellmService.completion.mockResolvedValue({
        choices: [{ message: { content: 'Enhanced response with organizational context' } }]
      });

      const response = await llmService.generateResponse(
        'Show me team meetings',
        { totalResults: 5, complexity: 'moderate' },
        { userEmail, organizationDomain: 'example.com' }
      );

      expect(response).toBe('Enhanced response with organizational context');
      expect(litellmService.completion).toHaveBeenCalled();
      
      const callArgs = litellmService.completion.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;
      expect(prompt).toContain('organizational insights');
      expect(prompt).toContain('collaboration patterns');
      expect(prompt).toContain('example.com');
    });

    it('should handle empty responses with fallback', async () => {
      litellmService.completion.mockResolvedValue({
        choices: [{ message: { content: '' } }]
      });

      const response = await llmService.generateResponse(
        'Test query',
        { totalResults: 0 },
        { userEmail: 'test@example.com' }
      );

      expect(response).toContain('having trouble generating a response');
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy buildQueryProcessingPrompt method', () => {
      const prompt = llmService.buildQueryProcessingPrompt(
        'Show me meetings',
        { userEmail: 'test@example.com' }
      );

      expect(prompt).toContain('Show me meetings');
      expect(prompt).toContain('test@example.com');
      expect(prompt).toContain('get_organization_hierarchy');
    });

    it('should maintain existing getAvailableIntents functionality', () => {
      const intents = llmService.getAvailableIntents();
      
      expect(intents).toBeDefined();
      expect(intents.find_meetings).toBeDefined();
      expect(intents.get_participants).toBeDefined();
      expect(intents.analyze_relationships).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM service errors gracefully', async () => {
      litellmService.completion.mockRejectedValue(new Error('API Error'));

      await expect(llmService.processQuery('test query', {}))
        .rejects.toThrow('Failed to process query: API Error');
    });

    it('should handle response generation errors gracefully', async () => {
      litellmService.completion.mockRejectedValue(new Error('Response Error'));

      await expect(llmService.generateResponse('test', {}, {}))
        .rejects.toThrow('Failed to generate response: Response Error');
    });

    it('should handle invalid JSON responses with fallback parsing', async () => {
      litellmService.completion.mockResolvedValue({
        choices: [{ message: { content: 'Invalid JSON response' } }]
      });

      const result = await llmService.processQuery('test query', {});
      
      // Should fall back to basic intent detection
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBe(0.3); // Fallback confidence
    });
  });
});
