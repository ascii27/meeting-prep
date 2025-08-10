/**
 * Test Suite for QueryPlanningService
 * Tests intelligent query strategy generation and validation
 */
const QueryPlanningService = require('../../../../../services/intelligence/planning/queryPlanningService');
const fs = require('fs').promises;
const path = require('path');

// Mock LLM service
jest.mock('../../../../../services/intelligence/llm/llmService', () => ({
  generateResponse: jest.fn()
}));

const llmService = require('../../../../../services/intelligence/llm/llmService');

describe('QueryPlanningService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset initialization state
    QueryPlanningService.initialized = false;
  });

  describe('Initialization', () => {
    test('should initialize successfully with database capabilities', async () => {
      // Mock file system read
      jest.spyOn(fs, 'readFile').mockResolvedValue('# Database Capabilities\nMocked content');
      
      await QueryPlanningService.initialize();
      
      expect(QueryPlanningService.initialized).toBe(true);
      expect(QueryPlanningService.databaseCapabilities).toContain('Database Capabilities');
    });

    test('should handle initialization failure gracefully', async () => {
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));
      
      await expect(QueryPlanningService.initialize()).rejects.toThrow('File not found');
    });
  });

  describe('Strategy Creation', () => {
    beforeEach(async () => {
      // Mock successful initialization
      jest.spyOn(fs, 'readFile').mockResolvedValue('# Database Capabilities\nMocked content');
      await QueryPlanningService.initialize();
    });

    test('should create strategy for simple collaboration query', async () => {
      const mockStrategy = {
        analysis: "User wants to find frequent collaborators",
        complexity: "medium",
        steps: [
          {
            stepNumber: 1,
            description: "Find frequent collaborators",
            queryType: "find_frequent_collaborators",
            parameters: { timeframe: "recent" },
            dependencies: [],
            estimatedTime: "medium"
          }
        ],
        expectedOutcome: "List of frequent collaborators with collaboration metrics"
      };

      llmService.generateResponse.mockResolvedValue(JSON.stringify(mockStrategy));

      const result = await QueryPlanningService.createQueryStrategy(
        "Who are my most frequent collaborators?",
        { user: { email: 'test@example.com' } }
      );

      expect(result.strategy.analysis).toBe(mockStrategy.analysis);
      expect(result.strategy.steps).toHaveLength(1);
      expect(result.strategy.steps[0].queryType).toBe('find_frequent_collaborators');
      expect(result.estimatedSteps).toBe(1);
    });

    test('should create multi-step strategy for complex query', async () => {
      const mockStrategy = {
        analysis: "Complex analysis requiring multiple steps",
        complexity: "high",
        steps: [
          {
            stepNumber: 1,
            description: "Find engineering team members",
            queryType: "get_participants",
            parameters: { emailDomain: "engineering" },
            dependencies: [],
            estimatedTime: "fast"
          },
          {
            stepNumber: 2,
            description: "Analyze cross-department collaboration",
            queryType: "analyze_collaboration",
            parameters: { participants: "step1_results" },
            dependencies: [1],
            estimatedTime: "slow"
          }
        ],
        expectedOutcome: "Cross-department collaboration analysis"
      };

      llmService.generateResponse.mockResolvedValue(JSON.stringify(mockStrategy));

      const result = await QueryPlanningService.createQueryStrategy(
        "How does engineering collaborate with other departments?",
        { user: { email: 'eng@example.com' } }
      );

      expect(result.strategy.steps).toHaveLength(2);
      expect(result.strategy.steps[1].dependencies).toContain(1);
      expect(result.estimatedComplexity).toBe('high');
    });

    test('should handle LLM response wrapped in markdown', async () => {
      const mockStrategy = {
        analysis: "Test analysis",
        complexity: "low",
        steps: [
          {
            stepNumber: 1,
            description: "Simple query",
            queryType: "find_meetings",
            parameters: {},
            dependencies: [],
            estimatedTime: "fast"
          }
        ]
      };

      const wrappedResponse = `Here's the strategy:\n\`\`\`json\n${JSON.stringify(mockStrategy)}\n\`\`\``;
      llmService.generateResponse.mockResolvedValue(wrappedResponse);

      const result = await QueryPlanningService.createQueryStrategy("Find my meetings");

      expect(result.strategy.analysis).toBe(mockStrategy.analysis);
      expect(result.strategy.steps).toHaveLength(1);
    });

    test('should handle invalid LLM response gracefully', async () => {
      llmService.generateResponse.mockResolvedValue('Invalid JSON response');

      await expect(
        QueryPlanningService.createQueryStrategy("Test query")
      ).rejects.toThrow('Failed to create query strategy');
    });
  });

  describe('Strategy Validation', () => {
    test('should validate strategy with correct structure', async () => {
      const strategy = {
        analysis: "Test analysis",
        complexity: "medium",
        steps: [
          {
            stepNumber: 1,
            description: "Test step",
            queryType: "find_meetings",
            parameters: { timeframe: "recent" },
            dependencies: [],
            estimatedTime: "fast"
          }
        ]
      };

      const validated = await QueryPlanningService.validateStrategy(strategy);

      expect(validated.steps).toHaveLength(1);
      expect(validated.steps[0].stepNumber).toBe(1);
      expect(validated.optimizations).toBeDefined();
    });

    test('should fix invalid query types', async () => {
      const strategy = {
        analysis: "Test analysis",
        complexity: "medium",
        steps: [
          {
            stepNumber: 1,
            description: "Test step",
            queryType: "invalid_query_type",
            parameters: {},
            dependencies: [],
            estimatedTime: "fast"
          }
        ]
      };

      const validated = await QueryPlanningService.validateStrategy(strategy);

      expect(validated.steps[0].queryType).toBe('general_query');
    });

    test('should clean up invalid dependencies', async () => {
      const strategy = {
        analysis: "Test analysis",
        complexity: "medium",
        steps: [
          {
            stepNumber: 1,
            description: "First step",
            queryType: "find_meetings",
            parameters: {},
            dependencies: [],
            estimatedTime: "fast"
          },
          {
            stepNumber: 2,
            description: "Second step",
            queryType: "get_participants",
            parameters: {},
            dependencies: [1, 3, 2], // Invalid: 3 doesn't exist, 2 is self-reference
            estimatedTime: "fast"
          }
        ]
      };

      const validated = await QueryPlanningService.validateStrategy(strategy);

      expect(validated.steps[1].dependencies).toEqual([1]);
    });
  });

  describe('Complexity Estimation', () => {
    test('should estimate low complexity for simple strategies', () => {
      const strategy = {
        steps: [
          { estimatedTime: 'fast', queryType: 'find_meetings' }
        ]
      };

      const complexity = QueryPlanningService.estimateComplexity(strategy);
      expect(complexity).toBe('low');
    });

    test('should estimate high complexity for complex strategies', () => {
      const strategy = {
        steps: [
          { estimatedTime: 'slow', queryType: 'analyze_collaboration' },
          { estimatedTime: 'medium', queryType: 'find_meetings' },
          { estimatedTime: 'slow', queryType: 'analyze_communication_flow' },
          { estimatedTime: 'fast', queryType: 'get_participants' },
          { estimatedTime: 'medium', queryType: 'analyze_topic_trends' }
        ]
      };

      const complexity = QueryPlanningService.estimateComplexity(strategy);
      expect(complexity).toBe('high');
    });
  });

  describe('Query Type Validation', () => {
    test('should validate correct query types', () => {
      const validTypes = [
        'find_meetings', 'get_participants', 'analyze_collaboration',
        'find_frequent_collaborators', 'analyze_topic_trends'
      ];

      validTypes.forEach(type => {
        expect(QueryPlanningService.isValidQueryType(type)).toBe(true);
      });
    });

    test('should reject invalid query types', () => {
      const invalidTypes = [
        'invalid_query', 'delete_meetings', 'hack_database'
      ];

      invalidTypes.forEach(type => {
        expect(QueryPlanningService.isValidQueryType(type)).toBe(false);
      });
    });
  });

  describe('Optimization Generation', () => {
    test('should suggest timeframe filters when missing', () => {
      const strategy = {
        steps: [
          {
            stepNumber: 1,
            queryType: 'find_meetings',
            parameters: { title: 'standup' } // No timeframe
          }
        ]
      };

      const optimizations = QueryPlanningService.generateOptimizations(strategy);
      
      const timeframeOpt = optimizations.find(opt => opt.type === 'performance');
      expect(timeframeOpt).toBeDefined();
      expect(timeframeOpt.suggestion).toContain('timeframe filters');
    });

    test('should identify parallelizable steps', () => {
      const strategy = {
        steps: [
          {
            stepNumber: 1,
            queryType: 'find_meetings',
            parameters: { timeframe: 'recent' }, // Add parameters to avoid timeframe optimization
            dependencies: []
          },
          {
            stepNumber: 2,
            queryType: 'get_participants',
            parameters: { timeframe: 'recent' }, // Add parameters to avoid timeframe optimization
            dependencies: []
          },
          {
            stepNumber: 3,
            queryType: 'analyze_collaboration',
            parameters: { timeframe: 'recent' },
            dependencies: [1, 2]
          }
        ]
      };

      const optimizations = QueryPlanningService.generateOptimizations(strategy);
      
      const parallelOpt = optimizations.find(opt => opt.suggestion && opt.suggestion.includes('parallel'));
      expect(parallelOpt).toBeDefined();
      expect(parallelOpt.suggestion).toContain('parallel');
    });
  });

  describe('Prompt Building', () => {
    beforeEach(async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue('# Database Capabilities\nMocked content');
      await QueryPlanningService.initialize();
    });

    test('should build comprehensive strategy planning prompt', () => {
      const context = {
        user: { email: 'test@example.com', name: 'Test User' },
        conversationHistory: [
          { query: 'Previous query', response: 'Previous response' }
        ]
      };

      const prompt = QueryPlanningService.buildStrategyPlanningPrompt(
        'Who are my collaborators?',
        context
      );

      expect(prompt).toContain('Who are my collaborators?');
      expect(prompt).toContain('test@example.com');
      expect(prompt).toContain('Previous query');
      expect(prompt).toContain('Database Capabilities');
      expect(prompt).toContain('JSON object');
    });

    test('should handle missing context gracefully', () => {
      const prompt = QueryPlanningService.buildStrategyPlanningPrompt(
        'Test query',
        {}
      );

      expect(prompt).toContain('Test query');
      expect(prompt).toContain('Database Capabilities');
      expect(prompt).not.toContain('undefined');
    });
  });

  describe('Conversation History Formatting', () => {
    test('should format conversation history correctly', () => {
      const history = [
        { query: 'First query', response: 'First response with a very long text that should be truncated' },
        { query: 'Second query', response: 'Second response' },
        { query: 'Third query', response: 'Third response' }
      ];

      const formatted = QueryPlanningService.formatConversationHistory(history);

      expect(formatted).toContain('1. Q: "First query"');
      expect(formatted).toContain('2. Q: "Second query"');
      expect(formatted).toContain('3. Q: "Third query"');
      expect(formatted).toContain('...');
    });

    test('should limit to last 3 conversations', () => {
      const history = [
        { query: 'Old query 1', response: 'Old response 1' },
        { query: 'Old query 2', response: 'Old response 2' },
        { query: 'Recent query 1', response: 'Recent response 1' },
        { query: 'Recent query 2', response: 'Recent response 2' },
        { query: 'Recent query 3', response: 'Recent response 3' }
      ];

      const formatted = QueryPlanningService.formatConversationHistory(history);

      expect(formatted).not.toContain('Old query');
      expect(formatted).toContain('Recent query 1');
      expect(formatted).toContain('Recent query 2');
      expect(formatted).toContain('Recent query 3');
    });
  });
});
