/**
 * Query Execution Orchestrator
 * Manages execution of complex, multi-step query strategies with dependency resolution
 */
const llmQueryService = require('../llm/llmQueryService');
const iterativeAnalysisService = require('./iterativeAnalysisService');
const queryContextManager = require('./queryContextManager');
const { v4: uuidv4 } = require('uuid');

class QueryExecutionOrchestrator {
  constructor() {
    this.activeExecutions = new Map();
    this.executionHistory = new Map();
    this.maxConcurrentExecutions = 10;
    this.maxExecutionTime = 300000; // 5 minutes
  }

  /**
   * Execute a complete query strategy with multi-step orchestration
   * @param {Object} strategy - Validated query strategy from Phase 1
   * @param {Object} context - Execution context (user, conversation, etc.)
   * @returns {Promise<Object>} - Complete execution results
   */
  async executeStrategy(strategy, context = {}) {
    const executionId = uuidv4();
    const execution = {
      id: executionId,
      strategy,
      context,
      startTime: new Date(),
      status: 'running',
      currentStep: 0,
      results: [],
      intermediateResults: new Map(),
      errors: [],
      metadata: {
        totalSteps: strategy.steps.length,
        estimatedComplexity: strategy.complexity || 'medium',
        parallelizable: strategy.execution?.parallelSteps || []
      }
    };

    try {
      // Register execution
      this.activeExecutions.set(executionId, execution);
      console.log(`[QueryExecutionOrchestrator] Starting execution ${executionId} with ${execution.metadata.totalSteps} steps`);

      // Initialize context manager for this execution
      await queryContextManager.initializeExecution(executionId, strategy, context);

      // Execute strategy steps
      const results = await this.executeSteps(execution);

      // Finalize execution
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.finalResults = results;

      console.log(`[QueryExecutionOrchestrator] Execution ${executionId} completed in ${execution.duration}ms`);

      // Move to history and cleanup
      this.executionHistory.set(executionId, execution);
      this.activeExecutions.delete(executionId);
      await queryContextManager.finalizeExecution(executionId);

      return {
        executionId,
        success: true,
        results: results.finalResults,
        intermediateResults: results.intermediateResults,
        metadata: {
          duration: execution.duration,
          stepsExecuted: execution.currentStep,
          totalSteps: execution.metadata.totalSteps,
          iterationsPerformed: results.iterationCount || 0
        }
      };

    } catch (error) {
      console.error(`[QueryExecutionOrchestrator] Execution ${executionId} failed:`, error);
      
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error.message;

      this.executionHistory.set(executionId, execution);
      this.activeExecutions.delete(executionId);
      await queryContextManager.finalizeExecution(executionId);

      return {
        executionId,
        success: false,
        error: error.message,
        partialResults: execution.results,
        metadata: {
          failedAtStep: execution.currentStep,
          totalSteps: execution.metadata.totalSteps
        }
      };
    }
  }

  /**
   * Execute strategy steps with dependency resolution and parallelization
   * @param {Object} execution - Execution context
   * @returns {Promise<Object>} - Execution results
   */
  async executeSteps(execution) {
    const { strategy } = execution;
    const results = {
      stepResults: [],
      intermediateResults: [],
      finalResults: null,
      iterationCount: 0
    };

    // Group steps by execution phase (considering dependencies)
    const executionPhases = this.planExecutionPhases(strategy.steps);
    
    console.log(`[QueryExecutionOrchestrator] Planned ${executionPhases.length} execution phases`);

    // Execute phases sequentially, steps within phases in parallel where possible
    for (let phaseIndex = 0; phaseIndex < executionPhases.length; phaseIndex++) {
      const phase = executionPhases[phaseIndex];
      console.log(`[QueryExecutionOrchestrator] Executing phase ${phaseIndex + 1} with ${phase.length} steps`);

      const phaseResults = await this.executePhase(phase, execution, results);
      results.stepResults.push(...phaseResults);

      // Update execution progress
      execution.currentStep = phaseIndex + 1;
      execution.results = results.stepResults;

      // Check if we need iterative analysis after this phase
      if (phaseIndex < executionPhases.length - 1) {
        const analysisResult = await this.performIterativeAnalysis(execution, results);
        if (analysisResult.needsFollowUp) {
          results.iterationCount++;
          // Add follow-up steps to remaining phases if needed
          const followUpSteps = analysisResult.followUpSteps;
          if (followUpSteps && followUpSteps.length > 0) {
            executionPhases.push(followUpSteps);
            console.log(`[QueryExecutionOrchestrator] Added ${followUpSteps.length} follow-up steps`);
          }
        }
      }
    }

    // Generate final results
    results.finalResults = await this.synthesizeFinalResults(execution, results);

    return results;
  }

  /**
   * Execute a single phase (group of independent steps)
   * @param {Array} steps - Steps to execute in this phase
   * @param {Object} execution - Execution context
   * @param {Object} previousResults - Results from previous phases
   * @returns {Promise<Array>} - Phase execution results
   */
  async executePhase(steps, execution, previousResults) {
    const phaseResults = [];

    // Determine if steps can be executed in parallel
    const canParallelize = steps.length > 1 && 
                          execution.metadata.parallelizable.some(stepNum => 
                            steps.some(step => step.stepNumber === stepNum)
                          );

    if (canParallelize) {
      console.log(`[QueryExecutionOrchestrator] Executing ${steps.length} steps in parallel`);
      
      // Execute steps in parallel
      const promises = steps.map(step => this.executeStep(step, execution, previousResults));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          phaseResults.push(result.value);
        } else {
          console.error(`[QueryExecutionOrchestrator] Step ${steps[index].stepNumber} failed:`, result.reason);
          phaseResults.push({
            stepNumber: steps[index].stepNumber,
            success: false,
            error: result.reason.message,
            results: null
          });
        }
      });
    } else {
      // Execute steps sequentially
      for (const step of steps) {
        try {
          const stepResult = await this.executeStep(step, execution, previousResults);
          phaseResults.push(stepResult);
        } catch (error) {
          console.error(`[QueryExecutionOrchestrator] Step ${step.stepNumber} failed:`, error);
          phaseResults.push({
            stepNumber: step.stepNumber,
            success: false,
            error: error.message,
            results: null
          });
        }
      }
    }

    return phaseResults;
  }

  /**
   * Execute a single query step
   * @param {Object} step - Step to execute
   * @param {Object} execution - Execution context
   * @param {Object} previousResults - Results from previous steps
   * @returns {Promise<Object>} - Step execution result
   */
  async executeStep(step, execution, previousResults) {
    const startTime = Date.now();
    
    console.log(`[QueryExecutionOrchestrator] Executing step ${step.stepNumber}: ${step.description}`);

    try {
      // Resolve step parameters with context and previous results
      const resolvedParameters = await this.resolveStepParameters(step, execution, previousResults);
      
      // Create query context for this step
      const stepContext = {
        ...execution.context,
        executionId: execution.id,
        stepNumber: step.stepNumber,
        previousResults: previousResults.stepResults,
        resolvedParameters
      };

      // Execute the query through the LLM query service
      const queryResult = await llmQueryService.executeQuery({
        intent: step.queryType,
        entities: resolvedParameters,
        confidence: 0.9 // High confidence since this is a planned step
      }, stepContext);

      const duration = Date.now() - startTime;

      const stepResult = {
        stepNumber: step.stepNumber,
        queryType: step.queryType,
        description: step.description,
        success: true,
        results: queryResult,
        parameters: resolvedParameters,
        duration,
        timestamp: new Date().toISOString()
      };

      // Store intermediate results for context
      execution.intermediateResults.set(step.stepNumber, stepResult);
      await queryContextManager.updateStepResult(execution.id, step.stepNumber, stepResult);

      console.log(`[QueryExecutionOrchestrator] Step ${step.stepNumber} completed in ${duration}ms`);

      return stepResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[QueryExecutionOrchestrator] Step ${step.stepNumber} failed after ${duration}ms:`, error);

      return {
        stepNumber: step.stepNumber,
        queryType: step.queryType,
        description: step.description,
        success: false,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Resolve step parameters using context and previous results
   * @param {Object} step - Step to resolve parameters for
   * @param {Object} execution - Execution context
   * @param {Object} previousResults - Results from previous steps
   * @returns {Promise<Object>} - Resolved parameters
   */
  async resolveStepParameters(step, execution, previousResults) {
    const resolved = { ...step.parameters };

    // Resolve dependencies on previous step results
    if (step.dependencies && step.dependencies.length > 0) {
      for (const depStepNumber of step.dependencies) {
        const depResult = execution.intermediateResults.get(depStepNumber);
        if (depResult && depResult.success) {
          // Extract relevant data from dependency results
          const depData = this.extractDependencyData(depResult, step.queryType);
          Object.assign(resolved, depData);
        }
      }
    }

    // Resolve parameter references (e.g., "step1_results")
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string' && value.includes('step') && value.includes('_results')) {
        const stepRef = parseInt(value.match(/step(\d+)/)?.[1]);
        if (stepRef) {
          const refResult = execution.intermediateResults.get(stepRef);
          if (refResult && refResult.success) {
            resolved[key] = refResult.results;
          }
        }
      }
    }

    // Add context-based parameters
    if (execution.context.user) {
      resolved.userEmail = execution.context.user.email;
      resolved.userName = execution.context.user.name;
    }

    return resolved;
  }

  /**
   * Extract relevant data from dependency results based on query type
   * @param {Object} depResult - Dependency step result
   * @param {string} targetQueryType - Target query type that needs the data
   * @returns {Object} - Extracted data
   */
  extractDependencyData(depResult, targetQueryType) {
    const extracted = {};

    if (!depResult.results || !depResult.results.results) {
      return extracted;
    }

    const results = depResult.results.results;

    // Extract based on dependency result type and target query type
    switch (depResult.queryType) {
      case 'find_meetings':
        if (Array.isArray(results)) {
          extracted.meetingIds = results.map(m => m.id).filter(Boolean);
          extracted.meetings = results;
        }
        break;

      case 'get_participants':
        if (Array.isArray(results)) {
          extracted.participantEmails = results.map(p => p.email).filter(Boolean);
          extracted.participants = results;
        }
        break;

      case 'find_frequent_collaborators':
        if (Array.isArray(results)) {
          extracted.collaboratorEmails = results.map(c => c.email).filter(Boolean);
          extracted.collaborators = results;
        }
        break;

      default:
        // Generic extraction
        if (Array.isArray(results)) {
          extracted.previousResults = results;
        } else {
          extracted.previousData = results;
        }
    }

    return extracted;
  }

  /**
   * Plan execution phases based on step dependencies
   * @param {Array} steps - Strategy steps
   * @returns {Array} - Array of execution phases (arrays of steps)
   */
  planExecutionPhases(steps) {
    const phases = [];
    const executed = new Set();
    const remaining = [...steps];

    while (remaining.length > 0) {
      const phase = [];
      
      // Find steps that can be executed (all dependencies satisfied)
      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];
        const canExecute = !step.dependencies || 
                          step.dependencies.every(dep => executed.has(dep));
        
        if (canExecute) {
          phase.push(step);
          executed.add(step.stepNumber);
          remaining.splice(i, 1);
        }
      }

      if (phase.length === 0) {
        // Circular dependency or invalid dependency - break the cycle
        console.warn('[QueryExecutionOrchestrator] Circular dependency detected, executing remaining steps');
        phases.push(remaining);
        break;
      }

      phases.push(phase);
    }

    return phases;
  }

  /**
   * Perform iterative analysis to determine if follow-up queries are needed
   * @param {Object} execution - Execution context
   * @param {Object} results - Current results
   * @returns {Promise<Object>} - Analysis result with follow-up recommendations
   */
  async performIterativeAnalysis(execution, results) {
    try {
      const analysis = await iterativeAnalysisService.analyzeIntermediateResults(
        results.stepResults,
        execution.strategy,
        execution.context
      );

      return analysis;
    } catch (error) {
      console.error('[QueryExecutionOrchestrator] Iterative analysis failed:', error);
      return { needsFollowUp: false, followUpSteps: [] };
    }
  }

  /**
   * Synthesize final results from all step results
   * @param {Object} execution - Execution context
   * @param {Object} results - All execution results
   * @returns {Promise<Object>} - Synthesized final results
   */
  async synthesizeFinalResults(execution, results) {
    // For now, return a structured summary of all results
    // This will be enhanced in Phase 3 with advanced synthesis
    return {
      summary: `Executed ${results.stepResults.length} steps for strategy: ${execution.strategy.analysis}`,
      stepResults: results.stepResults,
      successfulSteps: results.stepResults.filter(r => r.success).length,
      failedSteps: results.stepResults.filter(r => !r.success).length,
      totalDuration: results.stepResults.reduce((sum, r) => sum + (r.duration || 0), 0),
      iterationCount: results.iterationCount
    };
  }

  /**
   * Get execution status
   * @param {string} executionId - Execution ID
   * @returns {Object} - Execution status
   */
  getExecutionStatus(executionId) {
    const active = this.activeExecutions.get(executionId);
    if (active) {
      return {
        id: executionId,
        status: active.status,
        currentStep: active.currentStep,
        totalSteps: active.metadata.totalSteps,
        progress: active.currentStep / active.metadata.totalSteps,
        duration: Date.now() - active.startTime.getTime()
      };
    }

    const historical = this.executionHistory.get(executionId);
    if (historical) {
      return {
        id: executionId,
        status: historical.status,
        completed: true,
        duration: historical.duration,
        stepsExecuted: historical.currentStep,
        totalSteps: historical.metadata.totalSteps
      };
    }

    return null;
  }

  /**
   * Cancel an active execution
   * @param {string} executionId - Execution ID to cancel
   * @returns {boolean} - Whether cancellation was successful
   */
  async cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();
    
    this.executionHistory.set(executionId, execution);
    this.activeExecutions.delete(executionId);
    await queryContextManager.finalizeExecution(executionId);

    console.log(`[QueryExecutionOrchestrator] Execution ${executionId} cancelled`);
    return true;
  }

  /**
   * Get active executions count
   * @returns {number} - Number of active executions
   */
  getActiveExecutionsCount() {
    return this.activeExecutions.size;
  }

  /**
   * Cleanup old execution history
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupHistory(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge;
    
    for (const [id, execution] of this.executionHistory) {
      if (execution.endTime && execution.endTime.getTime() < cutoff) {
        this.executionHistory.delete(id);
      }
    }
  }
}

module.exports = new QueryExecutionOrchestrator();
