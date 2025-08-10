/**
 * Unit tests for Query Execution Orchestrator
 */
const queryExecutionOrchestrator = require('../../../../../services/intelligence/execution/queryExecutionOrchestrator');
const llmQueryService = require('../../../../../services/intelligence/llm/llmQueryService');
const iterativeAnalysisService = require('../../../../../services/intelligence/execution/iterativeAnalysisService');
const queryContextManager = require('../../../../../services/intelligence/execution/queryContextManager');

// Mock dependencies
jest.mock('../../../../../services/intelligence/llm/llmQueryService');
jest.mock('../../../../../services/intelligence/execution/iterativeAnalysisService');
jest.mock('../../../../../services/intelligence/execution/queryContextManager');

describe('QueryExecutionOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear orchestrator state
    queryExecutionOrchestrator.activeExecutions.clear();
    queryExecutionOrchestrator.executionHistory.clear();

    // Setup default mocks
    queryContextManager.initializeExecution.mockResolvedValue();
    queryContextManager.updateStepResult.mockResolvedValue();
    queryContextManager.finalizeExecution.mockResolvedValue();
    
    llmQueryService.executeQuery.mockResolvedValue({
      results: [
        { id: 1, title: 'Test Meeting 1', organizer: { email: 'user@test.com' } },
        { id: 2, title: 'Test Meeting 2', organizer: { email: 'user2@test.com' } }
      ],
      metadata: { totalCount: 2 }
    });

    iterativeAnalysisService.analyzeIntermediateResults.mockResolvedValue({
      needsFollowUp: false,
      reason: 'Analysis complete',
      followUpSteps: []
    });
  });

  describe('executeStrategy', () => {
    const mockStrategy = {
      analysis: 'Find recent meetings for user collaboration analysis',
      expectedOutcome: 'List of meetings with collaboration insights',
      complexity: 'medium',
      steps: [
        {
          stepNumber: 1,
          description: 'Find recent meetings',
          queryType: 'find_meetings',
          parameters: { timeframe: 'last_week' },
          dependencies: [],
          estimatedTime: 'fast'
        },
        {
          stepNumber: 2,
          description: 'Get meeting participants',
          queryType: 'get_participants',
          parameters: { meetingIds: 'step1_results' },
          dependencies: [1],
          estimatedTime: 'medium'
        }
      ]
    };

    const mockContext = {
      user: { email: 'test@example.com', name: 'Test User' },
      conversationHistory: []
    };

    test('should execute strategy successfully', async () => {
      const result = await queryExecutionOrchestrator.executeStrategy(mockStrategy, mockContext);

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.metadata.stepsExecuted).toBe(2);
      expect(result.metadata.totalSteps).toBe(2);

      // Verify context manager calls
      expect(queryContextManager.initializeExecution).toHaveBeenCalledWith(
        result.executionId,
        mockStrategy,
        mockContext
      );
      expect(queryContextManager.finalizeExecution).toHaveBeenCalledWith(result.executionId);
    });

    test('should handle step failures gracefully and continue execution', async () => {
      // Override the default mock to fail for individual steps
      llmQueryService.executeQuery.mockReset();
      llmQueryService.executeQuery.mockRejectedValue(new Error('Query execution failed'));
      
      // Ensure context manager mocks are still working
      queryContextManager.initializeExecution.mockResolvedValue();
      queryContextManager.updateStepResult.mockResolvedValue();
      queryContextManager.finalizeExecution.mockResolvedValue();

      const result = await queryExecutionOrchestrator.executeStrategy(mockStrategy, mockContext);

      // The orchestrator should complete successfully even with failed steps
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.metadata.stepsExecuted).toBe(2); // Both steps attempted
      
      // Check that the final results indicate some steps failed
      expect(result.results.failedSteps).toBeGreaterThan(0);
    });

    test('should track execution in history', async () => {
      const result = await queryExecutionOrchestrator.executeStrategy(mockStrategy, mockContext);

      expect(queryExecutionOrchestrator.executionHistory.has(result.executionId)).toBe(true);
      expect(queryExecutionOrchestrator.activeExecutions.has(result.executionId)).toBe(false);
    });
  });

  describe('executeSteps', () => {
    test('should plan execution phases correctly', async () => {
      const steps = [
        { stepNumber: 1, dependencies: [] },
        { stepNumber: 2, dependencies: [1] },
        { stepNumber: 3, dependencies: [] },
        { stepNumber: 4, dependencies: [2, 3] }
      ];

      const phases = queryExecutionOrchestrator.planExecutionPhases(steps);

      expect(phases).toHaveLength(3);
      expect(phases[0]).toHaveLength(2); // Steps 1 and 3 (no dependencies)
      expect(phases[1]).toHaveLength(1); // Step 2 (depends on 1)
      expect(phases[2]).toHaveLength(1); // Step 4 (depends on 2 and 3)
    });

    test('should handle circular dependencies', async () => {
      const steps = [
        { stepNumber: 1, dependencies: [2] },
        { stepNumber: 2, dependencies: [1] }
      ];

      const phases = queryExecutionOrchestrator.planExecutionPhases(steps);

      expect(phases).toHaveLength(1);
      expect(phases[0]).toHaveLength(2); // Both steps in final phase
    });
  });

  describe('executeStep', () => {
    const mockExecution = {
      id: 'test-execution-id',
      strategy: { steps: [] },
      context: { user: { email: 'test@example.com' } },
      intermediateResults: new Map()
    };

    const mockStep = {
      stepNumber: 1,
      description: 'Test step',
      queryType: 'find_meetings',
      parameters: { timeframe: 'last_week' },
      dependencies: []
    };

    test('should execute step successfully', async () => {
      // Add a small delay to ensure duration > 0
      llmQueryService.executeQuery.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
        return {
          results: [
            { id: 1, title: 'Test Meeting 1', organizer: { email: 'user@test.com' } },
            { id: 2, title: 'Test Meeting 2', organizer: { email: 'user2@test.com' } }
          ],
          metadata: { totalCount: 2 }
        };
      });

      const result = await queryExecutionOrchestrator.executeStep(
        mockStep,
        mockExecution,
        { stepResults: [] }
      );

      expect(result.success).toBe(true);
      expect(result.stepNumber).toBe(1);
      expect(result.queryType).toBe('find_meetings');
      expect(result.results).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);

      expect(llmQueryService.executeQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'find_meetings',
          confidence: 0.9
        }),
        expect.objectContaining({
          executionId: 'test-execution-id',
          stepNumber: 1
        })
      );
    });

    test('should handle step execution failure', async () => {
      llmQueryService.executeQuery.mockRejectedValueOnce(new Error('Step failed'));

      const result = await queryExecutionOrchestrator.executeStep(
        mockStep,
        mockExecution,
        { stepResults: [] }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Step failed');
      expect(result.stepNumber).toBe(1);
    });
  });

  describe('resolveStepParameters', () => {
    const mockExecution = {
      id: 'test-execution-id',
      context: { user: { email: 'test@example.com', name: 'Test User' } },
      intermediateResults: new Map([
        [1, {
          success: true,
          queryType: 'find_meetings',
          results: {
            results: [
              { id: 'meeting1', title: 'Test Meeting 1' },
              { id: 'meeting2', title: 'Test Meeting 2' }
            ]
          }
        }]
      ])
    };

    test('should resolve basic parameters', async () => {
      const step = {
        stepNumber: 2,
        parameters: { timeframe: 'last_week', limit: 10 },
        dependencies: []
      };

      const resolved = await queryExecutionOrchestrator.resolveStepParameters(
        step,
        mockExecution,
        { stepResults: [] }
      );

      expect(resolved.timeframe).toBe('last_week');
      expect(resolved.limit).toBe(10);
      expect(resolved.userEmail).toBe('test@example.com');
      expect(resolved.userName).toBe('Test User');
    });

    test('should resolve dependency parameters', async () => {
      const step = {
        stepNumber: 2,
        parameters: { meetingIds: 'step1_results' },
        dependencies: [1]
      };

      const resolved = await queryExecutionOrchestrator.resolveStepParameters(
        step,
        mockExecution,
        { stepResults: [] }
      );

      expect(resolved.meetingIds).toEqual(['meeting1', 'meeting2']);
    });
  });

  describe('extractDependencyData', () => {
    test('should extract meeting IDs from find_meetings results', () => {
      const depResult = {
        queryType: 'find_meetings',
        results: {
          results: [
            { id: 'meeting1', title: 'Test Meeting 1' },
            { id: 'meeting2', title: 'Test Meeting 2' }
          ]
        }
      };

      const extracted = queryExecutionOrchestrator.extractDependencyData(depResult, 'get_participants');

      expect(extracted.meetingIds).toEqual(['meeting1', 'meeting2']);
      expect(extracted.meetings).toHaveLength(2);
    });

    test('should extract participant emails from get_participants results', () => {
      const depResult = {
        queryType: 'get_participants',
        results: {
          results: [
            { email: 'user1@test.com', name: 'User 1' },
            { email: 'user2@test.com', name: 'User 2' }
          ]
        }
      };

      const extracted = queryExecutionOrchestrator.extractDependencyData(depResult, 'analyze_collaboration');

      expect(extracted.participantEmails).toEqual(['user1@test.com', 'user2@test.com']);
      expect(extracted.participants).toHaveLength(2);
    });

    test('should handle empty or invalid results', () => {
      const depResult = {
        queryType: 'find_meetings',
        results: { results: null }
      };

      const extracted = queryExecutionOrchestrator.extractDependencyData(depResult, 'get_participants');

      expect(Object.keys(extracted)).toHaveLength(0);
    });
  });

  describe('performIterativeAnalysis', () => {
    test('should call iterative analysis service', async () => {
      const mockExecution = {
        strategy: { analysis: 'Test strategy' },
        context: { user: { email: 'test@example.com' } }
      };

      const mockResults = {
        stepResults: [
          { success: true, queryType: 'find_meetings', results: { results: [] } }
        ]
      };

      const result = await queryExecutionOrchestrator.performIterativeAnalysis(mockExecution, mockResults);

      expect(iterativeAnalysisService.analyzeIntermediateResults).toHaveBeenCalledWith(
        mockResults.stepResults,
        mockExecution.strategy,
        mockExecution.context
      );

      expect(result.needsFollowUp).toBe(false);
    });

    test('should handle analysis service failure', async () => {
      iterativeAnalysisService.analyzeIntermediateResults.mockRejectedValueOnce(
        new Error('Analysis failed')
      );

      const mockExecution = { strategy: {}, context: {} };
      const mockResults = { stepResults: [] };

      const result = await queryExecutionOrchestrator.performIterativeAnalysis(mockExecution, mockResults);

      expect(result.needsFollowUp).toBe(false);
      expect(result.followUpSteps).toEqual([]);
    });
  });

  describe('getExecutionStatus', () => {
    test('should return status for active execution', () => {
      const executionId = 'test-execution-id';
      queryExecutionOrchestrator.activeExecutions.set(executionId, {
        status: 'running',
        currentStep: 2,
        metadata: { totalSteps: 5 },
        startTime: new Date(Date.now() - 10000) // 10 seconds ago
      });

      const status = queryExecutionOrchestrator.getExecutionStatus(executionId);

      expect(status.id).toBe(executionId);
      expect(status.status).toBe('running');
      expect(status.currentStep).toBe(2);
      expect(status.totalSteps).toBe(5);
      expect(status.progress).toBe(0.4);
      expect(status.duration).toBeGreaterThan(9000);
    });

    test('should return status for historical execution', () => {
      const executionId = 'test-execution-id';
      queryExecutionOrchestrator.executionHistory.set(executionId, {
        status: 'completed',
        currentStep: 5,
        metadata: { totalSteps: 5 },
        duration: 15000
      });

      const status = queryExecutionOrchestrator.getExecutionStatus(executionId);

      expect(status.id).toBe(executionId);
      expect(status.status).toBe('completed');
      expect(status.completed).toBe(true);
      expect(status.duration).toBe(15000);
    });

    test('should return null for unknown execution', () => {
      const status = queryExecutionOrchestrator.getExecutionStatus('unknown-id');
      expect(status).toBeNull();
    });
  });

  describe('cancelExecution', () => {
    test('should cancel active execution', async () => {
      const executionId = 'test-execution-id';
      queryExecutionOrchestrator.activeExecutions.set(executionId, {
        status: 'running',
        currentStep: 2,
        metadata: { totalSteps: 5 }
      });

      const result = await queryExecutionOrchestrator.cancelExecution(executionId);

      expect(result).toBe(true);
      expect(queryExecutionOrchestrator.activeExecutions.has(executionId)).toBe(false);
      expect(queryExecutionOrchestrator.executionHistory.has(executionId)).toBe(true);
      expect(queryContextManager.finalizeExecution).toHaveBeenCalledWith(executionId);
    });

    test('should return false for non-existent execution', async () => {
      const result = await queryExecutionOrchestrator.cancelExecution('unknown-id');
      expect(result).toBe(false);
    });
  });

  describe('utility methods', () => {
    test('should return active executions count', () => {
      queryExecutionOrchestrator.activeExecutions.set('exec1', {});
      queryExecutionOrchestrator.activeExecutions.set('exec2', {});

      const count = queryExecutionOrchestrator.getActiveExecutionsCount();
      expect(count).toBe(2);
    });

    test('should cleanup old execution history', () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

      queryExecutionOrchestrator.executionHistory.set('old-exec', {
        endTime: new Date(oldTime)
      });
      queryExecutionOrchestrator.executionHistory.set('recent-exec', {
        endTime: new Date(recentTime)
      });

      queryExecutionOrchestrator.cleanupHistory();

      expect(queryExecutionOrchestrator.executionHistory.has('old-exec')).toBe(false);
      expect(queryExecutionOrchestrator.executionHistory.has('recent-exec')).toBe(true);
    });
  });
});
