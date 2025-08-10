/**
 * Strategy Validation Service
 * Validates and optimizes query strategies for performance and correctness
 */

class StrategyValidationService {
  constructor() {
    this.validationRules = new Map();
    this.optimizationRules = new Map();
    this.performanceThresholds = {
      maxSteps: 10,
      maxSlowQueries: 3,
      maxEstimatedTime: 30000, // 30 seconds
      recommendedTimeframe: 30 * 24 * 60 * 60 * 1000 // 30 days in ms
    };
    
    this.initializeValidationRules();
    this.initializeOptimizationRules();
  }

  /**
   * Validate a complete query strategy
   * @param {Object} strategy - Strategy to validate
   * @returns {Object} - Validation result with errors, warnings, and suggestions
   */
  async validateStrategy(strategy) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      optimizations: [],
      estimatedPerformance: {}
    };

    try {
      // Run all validation rules
      for (const [ruleName, rule] of this.validationRules) {
        const ruleResult = await rule(strategy);
        if (ruleResult.errors) result.errors.push(...ruleResult.errors);
        if (ruleResult.warnings) result.warnings.push(...ruleResult.warnings);
        if (ruleResult.suggestions) result.suggestions.push(...ruleResult.suggestions);
      }

      // Run optimization rules
      for (const [ruleName, rule] of this.optimizationRules) {
        const optimizations = await rule(strategy);
        if (optimizations.length > 0) {
          result.optimizations.push(...optimizations);
        }
      }

      // Calculate performance estimates
      result.estimatedPerformance = this.estimatePerformance(strategy);

      // Set overall validity
      result.isValid = result.errors.length === 0;

      console.log(`[StrategyValidationService] Validation complete: ${result.isValid ? 'VALID' : 'INVALID'}`);
      console.log(`[StrategyValidationService] Errors: ${result.errors.length}, Warnings: ${result.warnings.length}, Optimizations: ${result.optimizations.length}`);

      return result;

    } catch (error) {
      console.error('[StrategyValidationService] Validation failed:', error);
      return {
        isValid: false,
        errors: [`Validation process failed: ${error.message}`],
        warnings: [],
        suggestions: [],
        optimizations: [],
        estimatedPerformance: {}
      };
    }
  }

  /**
   * Optimize a strategy based on validation results
   * @param {Object} strategy - Original strategy
   * @param {Object} validationResult - Results from validation
   * @returns {Object} - Optimized strategy
   */
  async optimizeStrategy(strategy, validationResult) {
    let optimizedStrategy = JSON.parse(JSON.stringify(strategy)); // Deep clone

    try {
      // Apply automatic optimizations
      for (const optimization of validationResult.optimizations) {
        if (optimization.autoApply) {
          optimizedStrategy = await this.applyOptimization(optimizedStrategy, optimization);
        }
      }

      // Add performance hints
      optimizedStrategy.performanceHints = this.generatePerformanceHints(optimizedStrategy);

      // Add execution metadata
      optimizedStrategy.metadata = {
        optimized: true,
        optimizationCount: validationResult.optimizations.filter(o => o.autoApply).length,
        estimatedPerformance: validationResult.estimatedPerformance,
        validationTimestamp: new Date().toISOString()
      };

      console.log(`[StrategyValidationService] Strategy optimized with ${optimizedStrategy.metadata.optimizationCount} automatic improvements`);

      return optimizedStrategy;

    } catch (error) {
      console.error('[StrategyValidationService] Optimization failed:', error);
      return strategy; // Return original if optimization fails
    }
  }

  /**
   * Estimate performance characteristics of a strategy
   * @param {Object} strategy - Strategy to analyze
   * @returns {Object} - Performance estimates
   */
  estimatePerformance(strategy) {
    const performance = {
      estimatedTotalTime: 0,
      bottleneckSteps: [],
      parallelizable: [],
      resourceIntensive: [],
      complexity: strategy.complexity || 'medium'
    };

    // Analyze each step
    strategy.steps.forEach((step, index) => {
      const stepTime = this.estimateStepTime(step);
      performance.estimatedTotalTime += stepTime;

      // Identify bottlenecks
      if (stepTime > 5000) { // > 5 seconds
        performance.bottleneckSteps.push({
          stepNumber: step.stepNumber,
          estimatedTime: stepTime,
          reason: this.getBottleneckReason(step)
        });
      }

      // Identify parallelizable steps
      if (!step.dependencies || step.dependencies.length === 0) {
        performance.parallelizable.push(step.stepNumber);
      }

      // Identify resource-intensive operations
      if (this.isResourceIntensive(step)) {
        performance.resourceIntensive.push({
          stepNumber: step.stepNumber,
          reason: this.getResourceIntensiveReason(step)
        });
      }
    });

    return performance;
  }

  /**
   * Initialize validation rules
   */
  initializeValidationRules() {
    // Rule: Check for required fields
    this.validationRules.set('required_fields', (strategy) => {
      const errors = [];
      const warnings = [];

      if (!strategy.steps || !Array.isArray(strategy.steps)) {
        errors.push('Strategy must contain a steps array');
      }

      if (!strategy.analysis) {
        warnings.push('Strategy should include an analysis field');
      }

      if (!strategy.expectedOutcome) {
        warnings.push('Strategy should specify expectedOutcome');
      }

      return { errors, warnings };
    });

    // Rule: Validate step structure
    this.validationRules.set('step_structure', (strategy) => {
      const errors = [];
      const warnings = [];

      if (strategy.steps && Array.isArray(strategy.steps)) {
        strategy.steps.forEach((step, index) => {
          if (!step.queryType) {
            errors.push(`Step ${index + 1} missing queryType`);
          }

          if (!step.description) {
            warnings.push(`Step ${index + 1} missing description`);
          }

          if (!step.parameters) {
            warnings.push(`Step ${index + 1} missing parameters`);
          }

          // Validate dependencies
          if (step.dependencies) {
            step.dependencies.forEach(dep => {
              if (dep >= (step.stepNumber || index + 1)) {
                errors.push(`Step ${step.stepNumber || index + 1} has invalid dependency on step ${dep} (circular or forward dependency)`);
              }
            });
          }
        });
      }

      return { errors, warnings };
    });

    // Rule: Check for performance issues
    this.validationRules.set('performance_check', (strategy) => {
      const warnings = [];
      const suggestions = [];

      if (strategy.steps.length > this.performanceThresholds.maxSteps) {
        warnings.push(`Strategy has ${strategy.steps.length} steps, consider consolidating (max recommended: ${this.performanceThresholds.maxSteps})`);
      }

      const slowQueries = strategy.steps.filter(step => step.estimatedTime === 'slow').length;
      if (slowQueries > this.performanceThresholds.maxSlowQueries) {
        warnings.push(`Strategy has ${slowQueries} slow queries, consider optimization (max recommended: ${this.performanceThresholds.maxSlowQueries})`);
      }

      // Check for missing timeframe filters
      const hasTimeframeFilter = strategy.steps.some(step => 
        step.parameters && (step.parameters.timeframe || step.parameters.startDate || step.parameters.endDate)
      );

      if (!hasTimeframeFilter) {
        suggestions.push('Consider adding timeframe filters to improve performance and relevance');
      }

      return { warnings, suggestions };
    });

    // Rule: Validate query types
    this.validationRules.set('query_type_validation', (strategy) => {
      const errors = [];
      const validQueryTypes = [
        'find_meetings', 'get_participants', 'find_documents', 'analyze_relationships',
        'general_query', 'analyze_collaboration', 'find_frequent_collaborators',
        'analyze_meeting_patterns', 'get_department_insights', 'analyze_topic_trends',
        'find_meeting_conflicts', 'get_productivity_insights', 'analyze_communication_flow'
      ];

      strategy.steps.forEach((step, index) => {
        if (!validQueryTypes.includes(step.queryType)) {
          errors.push(`Step ${index + 1} has invalid queryType: ${step.queryType}`);
        }
      });

      return { errors };
    });
  }

  /**
   * Initialize optimization rules
   */
  initializeOptimizationRules() {
    // Rule: Identify parallelizable steps
    this.optimizationRules.set('parallelization', (strategy) => {
      const optimizations = [];
      if (strategy.steps && Array.isArray(strategy.steps)) {
        const independentSteps = strategy.steps.filter(step => 
          !step.dependencies || step.dependencies.length === 0
        );

        if (independentSteps.length > 1) {
          optimizations.push({
            type: 'parallelization',
            description: `Steps ${independentSteps.map(s => s.stepNumber || s.index + 1).join(', ')} can be executed in parallel`,
            impact: 'high',
            autoApply: true,
            steps: independentSteps.map((s, index) => s.stepNumber || index + 1)
          });
        }
      }

      return optimizations;
    });

    // Rule: Add default timeframe filters
    this.optimizationRules.set('default_timeframes', (strategy) => {
      const optimizations = [];
      
      if (strategy.steps && Array.isArray(strategy.steps)) {
        strategy.steps.forEach((step, index) => {
          if (['find_meetings', 'analyze_collaboration', 'analyze_meeting_patterns'].includes(step.queryType)) {
            if (step.parameters && !step.parameters.timeframe && !step.parameters.startDate) {
              optimizations.push({
                type: 'performance',
                description: `Add default timeframe filter to step ${step.stepNumber || index + 1}`,
                impact: 'medium',
                autoApply: true,
                stepNumber: step.stepNumber || index + 1,
                parameter: 'timeframe',
                value: 'recent'
              });
            }
          }
        });
      }

      return optimizations;
    });

    // Rule: Optimize query order
    this.optimizationRules.set('query_order', (strategy) => {
      const optimizations = [];
      
      // Check if expensive queries come before filtering queries
      for (let i = 0; i < strategy.steps.length - 1; i++) {
        const currentStep = strategy.steps[i];
        const nextStep = strategy.steps[i + 1];
        
        if (this.isExpensiveQuery(currentStep.queryType) && this.isFilteringQuery(nextStep.queryType)) {
          optimizations.push({
            type: 'query_order',
            description: `Consider moving filtering step ${nextStep.stepNumber} before expensive step ${currentStep.stepNumber}`,
            impact: 'medium',
            autoApply: false,
            suggestion: `Reorder steps ${currentStep.stepNumber} and ${nextStep.stepNumber}`
          });
        }
      }

      return optimizations;
    });

    // Rule: Resource usage optimization
    this.optimizationRules.set('resource_usage', (strategy) => {
      const optimizations = [];
      const resourceIntensiveSteps = strategy.steps.filter(step => this.isResourceIntensive(step));

      if (resourceIntensiveSteps.length > 2) {
        optimizations.push({
          type: 'resource_usage',
          description: 'Multiple resource-intensive steps detected, consider batching or caching',
          impact: 'high',
          autoApply: false,
          steps: resourceIntensiveSteps.map(s => s.stepNumber)
        });
      }

      return optimizations;
    });
  }

  /**
   * Apply an optimization to a strategy
   * @param {Object} strategy - Strategy to optimize
   * @param {Object} optimization - Optimization to apply
   * @returns {Object} - Optimized strategy
   */
  async applyOptimization(strategy, optimization) {
    const optimized = { ...strategy };

    switch (optimization.type) {
      case 'performance':
        if (optimization.parameter && optimization.stepNumber) {
          const step = optimized.steps.find(s => s.stepNumber === optimization.stepNumber);
          if (step) {
            step.parameters[optimization.parameter] = optimization.value;
          }
        }
        break;

      case 'parallelization':
        // Add parallelization metadata
        if (!optimized.execution) optimized.execution = {};
        optimized.execution.parallelSteps = optimization.steps;
        break;
    }

    return optimized;
  }

  /**
   * Estimate execution time for a single step
   * @param {Object} step - Query step
   * @returns {number} - Estimated time in milliseconds
   */
  estimateStepTime(step) {
    const baseTime = {
      fast: 100,
      medium: 1000,
      slow: 5000
    };

    let time = baseTime[step.estimatedTime] || baseTime.medium;

    // Adjust based on query type
    if (this.isResourceIntensive(step)) {
      time *= 2;
    }

    // Adjust based on parameters
    if (step.parameters && !step.parameters.timeframe && !step.parameters.startDate) {
      time *= 1.5; // No time filtering
    }

    return time;
  }

  /**
   * Check if a query type is expensive
   * @param {string} queryType - Query type to check
   * @returns {boolean} - Whether the query is expensive
   */
  isExpensiveQuery(queryType) {
    const expensiveQueries = [
      'analyze_collaboration', 'analyze_communication_flow', 
      'analyze_topic_trends', 'get_department_insights'
    ];
    return expensiveQueries.includes(queryType);
  }

  /**
   * Check if a query type is for filtering
   * @param {string} queryType - Query type to check
   * @returns {boolean} - Whether the query is for filtering
   */
  isFilteringQuery(queryType) {
    const filteringQueries = ['find_meetings', 'get_participants', 'find_documents'];
    return filteringQueries.includes(queryType);
  }

  /**
   * Check if a step is resource intensive
   * @param {Object} step - Step to check
   * @returns {boolean} - Whether the step is resource intensive
   */
  isResourceIntensive(step) {
    const intensiveQueries = [
      'analyze_collaboration', 'analyze_communication_flow',
      'analyze_topic_trends', 'get_department_insights'
    ];
    
    return intensiveQueries.includes(step.queryType) || 
           step.estimatedTime === 'slow' ||
           (step.parameters && !step.parameters.timeframe && !step.parameters.startDate);
  }

  /**
   * Get reason for bottleneck
   * @param {Object} step - Step causing bottleneck
   * @returns {string} - Reason for bottleneck
   */
  getBottleneckReason(step) {
    if (this.isResourceIntensive(step)) {
      return 'Resource-intensive query type';
    }
    if (!step.parameters.timeframe && !step.parameters.startDate) {
      return 'Missing timeframe filter';
    }
    return 'Complex analysis operation';
  }

  /**
   * Get reason for resource intensity
   * @param {Object} step - Resource intensive step
   * @returns {string} - Reason for resource intensity
   */
  getResourceIntensiveReason(step) {
    if (step.queryType.includes('analyze_')) {
      return 'Complex analysis operation';
    }
    if (!step.parameters.timeframe) {
      return 'No timeframe filtering';
    }
    return 'Large dataset operation';
  }

  /**
   * Generate performance hints for execution
   * @param {Object} strategy - Strategy to analyze
   * @returns {Array} - Performance hints
   */
  generatePerformanceHints(strategy) {
    const hints = [];

    // Check for parallelizable steps
    if (strategy.execution && strategy.execution.parallelSteps) {
      hints.push(`Execute steps ${strategy.execution.parallelSteps.join(', ')} in parallel for better performance`);
    }

    // Check for caching opportunities
    const cachableSteps = strategy.steps.filter(step => 
      ['get_participants', 'find_frequent_collaborators'].includes(step.queryType)
    );
    
    if (cachableSteps.length > 0) {
      hints.push('Consider caching participant and collaborator data for repeated queries');
    }

    // Resource management hints
    const resourceIntensiveCount = strategy.steps.filter(step => this.isResourceIntensive(step)).length;
    if (resourceIntensiveCount > 1) {
      hints.push('Space out resource-intensive queries to avoid overwhelming the database');
    }

    return hints;
  }
}

module.exports = new StrategyValidationService();
