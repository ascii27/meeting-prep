/**
 * Unit tests for Query Context Manager
 */
const queryContextManager = require('../../../../../services/intelligence/execution/queryContextManager');

describe('QueryContextManager', () => {
  beforeEach(() => {
    // Clear all contexts before each test
    queryContextManager.clearAllContexts();
  });

  describe('initializeExecution', () => {
    const mockStrategy = {
      analysis: 'Test strategy analysis',
      steps: [
        { stepNumber: 1, queryType: 'find_meetings' },
        { stepNumber: 2, queryType: 'get_participants' }
      ],
      complexity: 'medium'
    };

    const mockContext = {
      user: { email: 'test@example.com', name: 'Test User' },
      conversationHistory: [
        { query: 'Previous query', response: 'Previous response' }
      ],
      originalQuery: 'Find collaboration patterns'
    };

    test('should initialize execution context successfully', async () => {
      const executionId = 'test-execution-id';

      await queryContextManager.initializeExecution(executionId, mockStrategy, mockContext);

      const context = queryContextManager.getExecutionContext(executionId);

      expect(context).toBeDefined();
      expect(context.id).toBe(executionId);
      expect(context.strategy).toEqual(mockStrategy);
      expect(context.userContext).toEqual(mockContext);
      expect(context.status).toBe('initialized');
      expect(context.metadata.totalSteps).toBe(2);
      expect(context.metadata.originalQuery).toBe('Find collaboration patterns');
      expect(context.conversationHistory).toHaveLength(1);
    });

    test('should initialize entity cache correctly', async () => {
      const executionId = 'test-execution-id';

      await queryContextManager.initializeExecution(executionId, mockStrategy, mockContext);

      const context = queryContextManager.getExecutionContext(executionId);

      expect(context.entityCache.people).toBeInstanceOf(Map);
      expect(context.entityCache.meetings).toBeInstanceOf(Map);
      expect(context.entityCache.documents).toBeInstanceOf(Map);
      expect(context.entityCache.topics).toBeInstanceOf(Set);
    });
  });

  describe('updateStepResult', () => {
    const executionId = 'test-execution-id';
    const mockStrategy = {
      steps: [{ stepNumber: 1, queryType: 'find_meetings' }],
      complexity: 'medium'
    };

    beforeEach(async () => {
      await queryContextManager.initializeExecution(executionId, mockStrategy, {});
    });

    test('should update step result successfully', async () => {
      const stepResult = {
        stepNumber: 1,
        queryType: 'find_meetings',
        success: true,
        results: {
          results: [
            {
              id: 'meeting1',
              title: 'Team Standup',
              organizer: { email: 'lead@test.com' },
              attendees: [
                { email: 'dev1@test.com', name: 'Dev 1' },
                { email: 'dev2@test.com', name: 'Dev 2' }
              ]
            }
          ]
        },
        timestamp: new Date().toISOString()
      };

      await queryContextManager.updateStepResult(executionId, 1, stepResult);

      const storedResult = queryContextManager.getStepResult(executionId, 1);
      expect(storedResult).toEqual(stepResult);

      const context = queryContextManager.getExecutionContext(executionId);
      expect(context.metadata.completedSteps).toBe(1);
    });

    test('should extract and cache entities from results', async () => {
      const stepResult = {
        stepNumber: 1,
        queryType: 'find_meetings',
        success: true,
        results: {
          results: [
            {
              id: 'meeting1',
              title: 'Team Standup Meeting',
              organizer: { email: 'lead@test.com', name: 'Team Lead' },
              attendees: [
                { email: 'dev1@test.com', name: 'Dev 1' },
                { email: 'dev2@test.com', name: 'Dev 2' }
              ]
            }
          ]
        },
        timestamp: new Date().toISOString()
      };

      await queryContextManager.updateStepResult(executionId, 1, stepResult);

      const people = queryContextManager.getCachedEntities(executionId, 'people');
      const meetings = queryContextManager.getCachedEntities(executionId, 'meetings');
      const topics = queryContextManager.getCachedEntities(executionId, 'topics');

      expect(people).toHaveLength(3); // organizer + 2 attendees
      expect(people.find(p => p.email === 'lead@test.com')).toBeDefined();
      expect(people.find(p => p.email === 'dev1@test.com')).toBeDefined();

      expect(meetings).toHaveLength(1);
      expect(meetings[0].id).toBe('meeting1');
      expect(meetings[0].title).toBe('Team Standup Meeting');

      expect(topics).toContain('standup');
    });

    test('should update intermediate data for cross-references', async () => {
      const stepResult = {
        stepNumber: 1,
        queryType: 'find_meetings',
        success: true,
        results: {
          results: [
            { id: 'meeting1', title: 'Meeting 1' },
            { id: 'meeting2', title: 'Meeting 2' }
          ]
        },
        parameters: { timeframe: 'last_week' },
        timestamp: new Date().toISOString()
      };

      await queryContextManager.updateStepResult(executionId, 1, stepResult);

      const stepData = queryContextManager.getIntermediateData(executionId, 'step_1');
      expect(stepData.queryType).toBe('find_meetings');
      expect(stepData.resultCount).toBe(2);

      const meetingIds = queryContextManager.getIntermediateData(executionId, 'meeting_ids');
      expect(meetingIds).toEqual(['meeting1', 'meeting2']);

      const latestMeetings = queryContextManager.getIntermediateData(executionId, 'latest_meetings');
      expect(latestMeetings).toHaveLength(2);
    });

    test('should handle non-existent execution gracefully', async () => {
      const stepResult = { stepNumber: 1, success: true };

      await queryContextManager.updateStepResult('non-existent-id', 1, stepResult);

      // Should not throw error, just log warning
      expect(queryContextManager.getStepResult('non-existent-id', 1)).toBeNull();
    });
  });

  describe('extractTopics', () => {
    test('should extract meeting-related topics', () => {
      const text = 'Daily Standup Meeting for Project Alpha';
      const topics = queryContextManager.extractTopics(text);

      expect(topics).toContain('standup');
      expect(topics).toContain('project');
    });

    test('should extract technical topics', () => {
      const text = 'Architecture Review and Technical Design Sprint';
      const topics = queryContextManager.extractTopics(text);

      expect(topics).toContain('architecture');
      expect(topics).toContain('technical');
      expect(topics).toContain('design');
      expect(topics).toContain('sprint');
    });

    test('should extract business topics', () => {
      const text = 'Quarterly Budget Review and Revenue Planning';
      const topics = queryContextManager.extractTopics(text);

      expect(topics).toContain('quarterly');
      expect(topics).toContain('budget');
      expect(topics).toContain('revenue');
    });

    test('should handle empty or invalid text', () => {
      expect(queryContextManager.extractTopics('')).toEqual([]);
      expect(queryContextManager.extractTopics(null)).toEqual([]);
      expect(queryContextManager.extractTopics(undefined)).toEqual([]);
    });

    test('should remove duplicate topics', () => {
      const text = 'Project planning project review project update';
      const topics = queryContextManager.extractTopics(text);

      expect(topics.filter(t => t === 'project')).toHaveLength(1);
    });
  });

  describe('buildContextSummary', () => {
    const executionId = 'test-execution-id';
    const mockStrategy = {
      steps: [
        { stepNumber: 1, queryType: 'find_meetings' },
        { stepNumber: 2, queryType: 'get_participants' }
      ]
    };

    beforeEach(async () => {
      await queryContextManager.initializeExecution(executionId, mockStrategy, {
        originalQuery: 'Find team collaboration patterns'
      });
    });

    test('should build context summary correctly', async () => {
      // Add some step results
      await queryContextManager.updateStepResult(executionId, 1, {
        stepNumber: 1,
        queryType: 'find_meetings',
        description: 'Find recent meetings',
        success: true,
        results: {
          results: [
            { id: 'meeting1', title: 'Meeting 1' },
            { id: 'meeting2', title: 'Meeting 2' }
          ]
        }
      });

      const summary = queryContextManager.buildContextSummary(executionId);

      expect(summary.executionId).toBe(executionId);
      expect(summary.originalQuery).toBe('Find team collaboration patterns');
      expect(summary.progress.completedSteps).toBe(1);
      expect(summary.progress.totalSteps).toBe(2);
      expect(summary.progress.percentage).toBe(50);
      expect(summary.entities.meetingsCount).toBe(2);
      expect(summary.recentResults).toHaveLength(1);
      expect(summary.recentResults[0].step).toBe(1);
      expect(summary.recentResults[0].resultCount).toBe(2);
    });

    test('should return null for non-existent execution', () => {
      const summary = queryContextManager.buildContextSummary('non-existent-id');
      expect(summary).toBeNull();
    });

    test('should limit recent results to last 3 steps', async () => {
      // Add 5 step results
      for (let i = 1; i <= 5; i++) {
        await queryContextManager.updateStepResult(executionId, i, {
          stepNumber: i,
          queryType: 'test_query',
          success: true,
          results: { results: [] }
        });
      }

      const summary = queryContextManager.buildContextSummary(executionId);

      expect(summary.recentResults).toHaveLength(3);
      expect(summary.recentResults[0].step).toBe(5); // Most recent first
      expect(summary.recentResults[1].step).toBe(4);
      expect(summary.recentResults[2].step).toBe(3);
    });
  });

  describe('conversation management', () => {
    const executionId = 'test-execution-id';
    const mockStrategy = { steps: [] };

    beforeEach(async () => {
      await queryContextManager.initializeExecution(executionId, mockStrategy, {});
    });

    test('should add conversation context', async () => {
      const conversationEntry = {
        query: 'Test query',
        response: 'Test response',
        intent: 'find_meetings'
      };

      await queryContextManager.addConversationContext(executionId, conversationEntry);

      const history = queryContextManager.getConversationHistory(executionId);

      expect(history).toHaveLength(1);
      expect(history[0].query).toBe('Test query');
      expect(history[0].timestamp).toBeDefined();
    });

    test('should limit conversation history to 10 entries', async () => {
      // Add 15 conversation entries
      for (let i = 1; i <= 15; i++) {
        await queryContextManager.addConversationContext(executionId, {
          query: `Query ${i}`,
          response: `Response ${i}`
        });
      }

      const history = queryContextManager.getConversationHistory(executionId);

      expect(history).toHaveLength(10);
      expect(history[0].query).toBe('Query 6'); // Should keep last 10
      expect(history[9].query).toBe('Query 15');
    });

    test('should return empty history for non-existent execution', () => {
      const history = queryContextManager.getConversationHistory('non-existent-id');
      expect(history).toEqual([]);
    });
  });

  describe('finalization and cleanup', () => {
    const executionId = 'test-execution-id';
    const mockStrategy = { steps: [] };

    test('should finalize execution context', async () => {
      await queryContextManager.initializeExecution(executionId, mockStrategy, {});

      await queryContextManager.finalizeExecution(executionId);

      const context = queryContextManager.getExecutionContext(executionId);
      expect(context.status).toBe('finalized');
      expect(context.endTime).toBeDefined();
      expect(context.duration).toBeDefined();
    });

    test('should cleanup old contexts', async () => {
      // Set short max age for testing
      queryContextManager.setConfiguration({ maxContextAge: 1000 }); // 1 second

      await queryContextManager.initializeExecution('old-execution', mockStrategy, {});
      await queryContextManager.finalizeExecution('old-execution');

      // Wait for context to become old
      await new Promise(resolve => setTimeout(resolve, 1100));

      await queryContextManager.initializeExecution('new-execution', mockStrategy, {});

      queryContextManager.cleanupOldContexts();

      expect(queryContextManager.getExecutionContext('old-execution')).toBeNull();
      expect(queryContextManager.getExecutionContext('new-execution')).toBeDefined();
    });
  });

  describe('statistics and monitoring', () => {
    test('should provide execution statistics', async () => {
      const mockStrategy = { steps: [] };

      // Create some executions
      await queryContextManager.initializeExecution('exec1', mockStrategy, {});
      await queryContextManager.initializeExecution('exec2', mockStrategy, {});
      await queryContextManager.finalizeExecution('exec1');

      const stats = queryContextManager.getStatistics();

      expect(stats.totalContexts).toBe(2);
      expect(stats.activeContexts).toBe(1);
      expect(stats.finalizedContexts).toBe(1);
    });

    test('should calculate average metrics', async () => {
      const mockStrategy = { steps: [{ stepNumber: 1 }] };

      await queryContextManager.initializeExecution('exec1', mockStrategy, {});
      await queryContextManager.updateStepResult('exec1', 1, {
        stepNumber: 1,
        success: true,
        results: { results: [] }
      });

      // Simulate some execution time by setting start time in the past
      const context = queryContextManager.getExecutionContext('exec1');
      context.startTime = new Date(Date.now() - 5000); // 5 seconds ago
      
      await queryContextManager.finalizeExecution('exec1');

      const stats = queryContextManager.getStatistics();

      expect(stats.averageStepsPerExecution).toBe(1);
      expect(stats.averageExecutionTime).toBeGreaterThan(4000); // Should be around 5000ms
      expect(stats.averageExecutionTime).toBeLessThan(6000);
    });
  });

  describe('data retrieval methods', () => {
    const executionId = 'test-execution-id';
    const mockStrategy = { steps: [] };

    beforeEach(async () => {
      await queryContextManager.initializeExecution(executionId, mockStrategy, {});
    });

    test('should return null for non-existent data', () => {
      expect(queryContextManager.getStepResult('non-existent', 1)).toBeNull();
      expect(queryContextManager.getIntermediateData('non-existent', 'key')).toBeNull();
      expect(queryContextManager.getCachedEntities('non-existent', 'people')).toBeNull();
    });

    test('should return null for non-existent step result', () => {
      expect(queryContextManager.getStepResult(executionId, 999)).toBeNull();
    });

    test('should return null for non-existent intermediate data', () => {
      expect(queryContextManager.getIntermediateData(executionId, 'non-existent-key')).toBeNull();
    });

    test('should return null for invalid entity type', () => {
      expect(queryContextManager.getCachedEntities(executionId, 'invalid-type')).toBeNull();
    });
  });

  describe('configuration', () => {
    test('should set configuration options', () => {
      const config = {
        maxContextAge: 120000, // 2 minutes
        maxContexts: 50
      };

      queryContextManager.setConfiguration(config);

      // Configuration is internal, so we test indirectly
      expect(() => queryContextManager.setConfiguration(config)).not.toThrow();
    });
  });
});
