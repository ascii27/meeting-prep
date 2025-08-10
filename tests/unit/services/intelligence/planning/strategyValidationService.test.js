/**
 * Test Suite for StrategyValidationService
 * Tests strategy validation and optimization functionality
 */
const StrategyValidationService = require('../../../../../services/intelligence/planning/strategyValidationService');

describe('StrategyValidationService', () => {
  describe('Strategy Validation', () => {
    test('should validate a well-formed strategy', async () => {
      const strategy = {
        analysis: "Find frequent collaborators",
        complexity: "medium",
        expectedOutcome: "List of collaborators with metrics",
        steps: [
          {
            stepNumber: 1,
            description: "Find collaborators",
            queryType: "find_frequent_collaborators",
            parameters: { timeframe: "recent" },
            dependencies: [],
            estimatedTime: "medium"
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.estimatedPerformance).toBeDefined();
    });

    test('should detect missing required fields', async () => {
      const strategy = {
        // Missing analysis and expectedOutcome
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings"
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('analysis'))).toBe(true);
      expect(result.warnings.some(w => w.includes('expectedOutcome'))).toBe(true);
    });

    test('should detect invalid query types', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "invalid_query_type",
            parameters: {}
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid queryType'))).toBe(true);
    });

    test('should detect circular dependencies', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            dependencies: [2]
          },
          {
            stepNumber: 2,
            queryType: "get_participants",
            dependencies: [1]
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('circular or forward dependency'))).toBe(true);
    });

    test('should warn about performance issues', async () => {
      const strategy = {
        analysis: "Complex analysis",
        steps: Array.from({ length: 12 }, (_, i) => ({
          stepNumber: i + 1,
          queryType: "analyze_collaboration",
          estimatedTime: "slow",
          parameters: {}
        }))
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.warnings.some(w => w.includes('steps'))).toBe(true);
      expect(result.warnings.some(w => w.includes('slow queries'))).toBe(true);
    });

    test('should suggest timeframe filters', async () => {
      const strategy = {
        analysis: "Meeting analysis",
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            parameters: { title: "standup" } // No timeframe
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.suggestions.some(s => s.includes('timeframe filters'))).toBe(true);
    });
  });

  describe('Performance Estimation', () => {
    test('should estimate performance for simple strategy', () => {
      const strategy = {
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            estimatedTime: "fast",
            parameters: { timeframe: "recent" }
          }
        ]
      };

      const performance = StrategyValidationService.estimatePerformance(strategy);

      expect(performance.estimatedTotalTime).toBeLessThan(1000);
      expect(performance.bottleneckSteps).toHaveLength(0);
      expect(performance.parallelizable).toContain(1);
    });

    test('should identify bottlenecks in complex strategy', () => {
      const strategy = {
        steps: [
          {
            stepNumber: 1,
            queryType: "analyze_collaboration",
            estimatedTime: "slow",
            parameters: {} // No timeframe filter
          },
          {
            stepNumber: 2,
            queryType: "find_meetings",
            estimatedTime: "fast",
            parameters: { timeframe: "recent" }
          }
        ]
      };

      const performance = StrategyValidationService.estimatePerformance(strategy);

      expect(performance.bottleneckSteps).toHaveLength(1);
      expect(performance.bottleneckSteps[0].stepNumber).toBe(1);
      expect(performance.resourceIntensive).toHaveLength(1);
    });

    test('should identify parallelizable steps', () => {
      const strategy = {
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            dependencies: []
          },
          {
            stepNumber: 2,
            queryType: "get_participants",
            dependencies: []
          },
          {
            stepNumber: 3,
            queryType: "analyze_collaboration",
            dependencies: [1, 2]
          }
        ]
      };

      const performance = StrategyValidationService.estimatePerformance(strategy);

      expect(performance.parallelizable).toContain(1);
      expect(performance.parallelizable).toContain(2);
      expect(performance.parallelizable).not.toContain(3);
    });
  });

  describe('Optimization Rules', () => {
    test('should identify parallelization opportunities', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            dependencies: []
          },
          {
            stepNumber: 2,
            queryType: "get_participants",
            dependencies: []
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      const parallelOpt = result.optimizations.find(opt => opt.type === 'parallelization');
      expect(parallelOpt).toBeDefined();
      expect(parallelOpt.steps).toEqual([1, 2]);
      expect(parallelOpt.autoApply).toBe(true);
    });

    test('should suggest default timeframes', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            parameters: { title: "standup" }
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      const timeframeOpt = result.optimizations.find(opt => 
        opt.type === 'performance' && opt.parameter === 'timeframe'
      );
      expect(timeframeOpt).toBeDefined();
      expect(timeframeOpt.value).toBe('recent');
      expect(timeframeOpt.autoApply).toBe(true);
    });

    test('should suggest query reordering', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "analyze_collaboration", // Expensive
            parameters: {}
          },
          {
            stepNumber: 2,
            queryType: "find_meetings", // Filtering
            parameters: {}
          }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      const orderOpt = result.optimizations.find(opt => opt.type === 'query_order');
      expect(orderOpt).toBeDefined();
      expect(orderOpt.autoApply).toBe(false);
    });

    test('should warn about resource usage', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          { stepNumber: 1, queryType: "analyze_collaboration", parameters: {} },
          { stepNumber: 2, queryType: "analyze_communication_flow", parameters: {} },
          { stepNumber: 3, queryType: "analyze_topic_trends", parameters: {} }
        ]
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      const resourceOpt = result.optimizations.find(opt => opt.type === 'resource_usage');
      expect(resourceOpt).toBeDefined();
      expect(resourceOpt.steps).toHaveLength(3);
    });
  });

  describe('Strategy Optimization', () => {
    test('should apply automatic optimizations', async () => {
      const strategy = {
        analysis: "Test",
        steps: [
          {
            stepNumber: 1,
            queryType: "find_meetings",
            parameters: { title: "standup" }
          }
        ]
      };

      const validationResult = await StrategyValidationService.validateStrategy(strategy);
      const optimized = await StrategyValidationService.optimizeStrategy(strategy, validationResult);

      expect(optimized.metadata.optimized).toBe(true);
      expect(optimized.metadata.optimizationCount).toBeGreaterThan(0);
      expect(optimized.performanceHints).toBeDefined();
    });

    test('should preserve original strategy if optimization fails', async () => {
      const strategy = { analysis: "Test", steps: [] };
      const validationResult = { optimizations: [] };

      const optimized = await StrategyValidationService.optimizeStrategy(strategy, validationResult);

      expect(optimized.analysis).toBe("Test");
    });
  });

  describe('Query Classification', () => {
    test('should identify expensive queries', () => {
      const expensiveQueries = [
        'analyze_collaboration',
        'analyze_communication_flow',
        'analyze_topic_trends',
        'get_department_insights'
      ];

      expensiveQueries.forEach(queryType => {
        expect(StrategyValidationService.isExpensiveQuery(queryType)).toBe(true);
      });

      expect(StrategyValidationService.isExpensiveQuery('find_meetings')).toBe(false);
    });

    test('should identify filtering queries', () => {
      const filteringQueries = ['find_meetings', 'get_participants', 'find_documents'];

      filteringQueries.forEach(queryType => {
        expect(StrategyValidationService.isFilteringQuery(queryType)).toBe(true);
      });

      expect(StrategyValidationService.isFilteringQuery('analyze_collaboration')).toBe(false);
    });

    test('should identify resource intensive steps', () => {
      const intensiveStep = {
        queryType: 'analyze_collaboration',
        estimatedTime: 'slow',
        parameters: {} // No timeframe
      };

      const lightStep = {
        queryType: 'find_meetings',
        estimatedTime: 'fast',
        parameters: { timeframe: 'recent' }
      };

      expect(StrategyValidationService.isResourceIntensive(intensiveStep)).toBe(true);
      expect(StrategyValidationService.isResourceIntensive(lightStep)).toBe(false);
    });
  });

  describe('Performance Hints Generation', () => {
    test('should generate parallelization hints', () => {
      const strategy = {
        execution: { parallelSteps: [1, 2] },
        steps: [
          { stepNumber: 1, queryType: 'find_meetings' },
          { stepNumber: 2, queryType: 'get_participants' }
        ]
      };

      const hints = StrategyValidationService.generatePerformanceHints(strategy);

      expect(hints.some(hint => hint.includes('parallel'))).toBe(true);
      expect(hints.some(hint => hint.includes('1, 2'))).toBe(true);
    });

    test('should generate caching hints', () => {
      const strategy = {
        steps: [
          { stepNumber: 1, queryType: 'get_participants' },
          { stepNumber: 2, queryType: 'find_frequent_collaborators' }
        ]
      };

      const hints = StrategyValidationService.generatePerformanceHints(strategy);

      expect(hints.some(hint => hint.includes('caching'))).toBe(true);
    });

    test('should generate resource management hints', () => {
      const strategy = {
        steps: [
          { stepNumber: 1, queryType: 'analyze_collaboration', parameters: {} },
          { stepNumber: 2, queryType: 'analyze_topic_trends', parameters: {} }
        ]
      };

      const hints = StrategyValidationService.generatePerformanceHints(strategy);

      expect(hints.some(hint => hint.includes('resource-intensive'))).toBe(true);
    });
  });

  describe('Time Estimation', () => {
    test('should estimate step time based on complexity', () => {
      const fastStep = { estimatedTime: 'fast', queryType: 'find_meetings', parameters: { timeframe: 'recent' } };
      const slowStep = { estimatedTime: 'slow', queryType: 'analyze_collaboration', parameters: {} };

      const fastTime = StrategyValidationService.estimateStepTime(fastStep);
      const slowTime = StrategyValidationService.estimateStepTime(slowStep);

      expect(fastTime).toBeLessThan(slowTime);
      expect(slowTime).toBeGreaterThan(5000); // Should be > 5 seconds for resource intensive
    });

    test('should adjust time for missing filters', () => {
      const withFilter = { 
        estimatedTime: 'medium', 
        queryType: 'find_meetings', 
        parameters: { timeframe: 'recent' } 
      };
      const withoutFilter = { 
        estimatedTime: 'medium', 
        queryType: 'find_meetings', 
        parameters: {} 
      };

      const timeWithFilter = StrategyValidationService.estimateStepTime(withFilter);
      const timeWithoutFilter = StrategyValidationService.estimateStepTime(withoutFilter);

      expect(timeWithoutFilter).toBeGreaterThan(timeWithFilter);
    });
  });

  describe('Error Handling', () => {
    test('should handle validation errors gracefully', async () => {
      // Simulate an error in validation process
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const invalidStrategy = null;

      const result = await StrategyValidationService.validateStrategy(invalidStrategy);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      console.error = originalConsoleError;
    });

    test('should provide meaningful error messages', async () => {
      const strategy = {
        steps: "not an array" // Invalid structure
      };

      const result = await StrategyValidationService.validateStrategy(strategy);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Validation process failed'))).toBe(true);
    });
  });
});
