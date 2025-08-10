/**
 * Query Context Manager
 * Manages execution context, state, and intermediate results for multi-step query strategies
 */

class QueryContextManager {
  constructor() {
    this.executionContexts = new Map();
    this.maxContextAge = 60 * 60 * 1000; // 1 hour
    this.maxContexts = 100;
  }

  /**
   * Initialize execution context for a new strategy execution
   * @param {string} executionId - Unique execution identifier
   * @param {Object} strategy - Query strategy
   * @param {Object} context - Initial context (user, conversation, etc.)
   * @returns {Promise<void>}
   */
  async initializeExecution(executionId, strategy, context) {
    const executionContext = {
      id: executionId,
      strategy,
      userContext: context,
      startTime: new Date(),
      status: 'initialized',
      stepResults: new Map(),
      intermediateData: new Map(),
      entityCache: {
        people: new Map(),
        meetings: new Map(),
        documents: new Map(),
        topics: new Set()
      },
      conversationHistory: context.conversationHistory || [],
      metadata: {
        totalSteps: strategy.steps.length,
        completedSteps: 0,
        estimatedComplexity: strategy.complexity,
        originalQuery: context.originalQuery || strategy.analysis
      }
    };

    this.executionContexts.set(executionId, executionContext);
    
    console.log(`[QueryContextManager] Initialized execution context ${executionId}`);
    
    // Cleanup old contexts if we're at the limit
    if (this.executionContexts.size > this.maxContexts) {
      this.cleanupOldContexts();
    }
  }

  /**
   * Update step result in execution context
   * @param {string} executionId - Execution identifier
   * @param {number} stepNumber - Step number
   * @param {Object} stepResult - Step execution result
   * @returns {Promise<void>}
   */
  async updateStepResult(executionId, stepNumber, stepResult) {
    const context = this.executionContexts.get(executionId);
    if (!context) {
      console.warn(`[QueryContextManager] Context not found for execution ${executionId}`);
      return;
    }

    // Store step result
    context.stepResults.set(stepNumber, stepResult);
    context.metadata.completedSteps = context.stepResults.size;

    // Extract and cache entities from results
    if (stepResult.success && stepResult.results) {
      await this.extractAndCacheEntities(context, stepResult);
    }

    // Update intermediate data for cross-step references
    await this.updateIntermediateData(context, stepNumber, stepResult);

    console.log(`[QueryContextManager] Updated step ${stepNumber} result for execution ${executionId}`);
  }

  /**
   * Extract and cache entities from step results
   * @param {Object} context - Execution context
   * @param {Object} stepResult - Step result
   * @returns {Promise<void>}
   */
  async extractAndCacheEntities(context, stepResult) {
    const results = stepResult.results.results;
    if (!Array.isArray(results)) return;

    results.forEach(item => {
      // Cache people
      if (item.email) {
        context.entityCache.people.set(item.email, {
          email: item.email,
          name: item.name || item.displayName,
          department: item.department,
          role: item.role,
          lastSeen: stepResult.timestamp
        });
      }

      // Cache organizer from meetings
      if (item.organizer && item.organizer.email) {
        context.entityCache.people.set(item.organizer.email, {
          email: item.organizer.email,
          name: item.organizer.name || item.organizer.displayName,
          department: item.organizer.department,
          role: item.organizer.role,
          lastSeen: stepResult.timestamp
        });
      }

      // Cache attendees from meetings
      if (item.attendees && Array.isArray(item.attendees)) {
        item.attendees.forEach(attendee => {
          if (attendee.email) {
            context.entityCache.people.set(attendee.email, {
              email: attendee.email,
              name: attendee.name || attendee.displayName,
              lastSeen: stepResult.timestamp
            });
          }
        });
      }

      // Cache meetings
      if (item.id && (stepResult.queryType === 'find_meetings' || item.title)) {
        context.entityCache.meetings.set(item.id, {
          id: item.id,
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          organizer: item.organizer,
          attendeeCount: item.attendees ? item.attendees.length : 0,
          lastSeen: stepResult.timestamp
        });
      }

      // Cache documents
      if (item.id && stepResult.queryType === 'find_documents') {
        context.entityCache.documents.set(item.id, {
          id: item.id,
          title: item.title || item.name,
          type: item.type,
          createdAt: item.createdAt,
          author: item.author,
          lastSeen: stepResult.timestamp
        });
      }

      // Extract and cache topics
      if (item.title) {
        const topics = this.extractTopics(item.title);
        topics.forEach(topic => context.entityCache.topics.add(topic));
      }
      if (item.description) {
        const topics = this.extractTopics(item.description);
        topics.forEach(topic => context.entityCache.topics.add(topic));
      }
    });
  }

  /**
   * Extract topics from text
   * @param {string} text - Text to extract topics from
   * @returns {Array} - Extracted topics
   */
  extractTopics(text) {
    if (!text || typeof text !== 'string') return [];

    // Simple topic extraction
    const topicPatterns = [
      /\b(standup|scrum|retrospective|planning|review|demo)\b/gi,
      /\b(project|feature|bug|issue|task|epic)\b/gi,
      /\b(design|architecture|technical|development|engineering)\b/gi,
      /\b(marketing|sales|customer|user|client)\b/gi,
      /\b(quarterly|monthly|weekly|daily|sprint)\b/gi,
      /\b(budget|finance|revenue|cost|pricing)\b/gi,
      /\b(hiring|onboarding|training|performance)\b/gi
    ];

    const topics = [];
    topicPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        topics.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Update intermediate data for cross-step references
   * @param {Object} context - Execution context
   * @param {number} stepNumber - Step number
   * @param {Object} stepResult - Step result
   * @returns {Promise<void>}
   */
  async updateIntermediateData(context, stepNumber, stepResult) {
    const dataKey = `step_${stepNumber}`;
    
    if (stepResult.success && stepResult.results) {
      const results = stepResult.results.results;
      
      // Store processed data for easy reference by subsequent steps
      context.intermediateData.set(dataKey, {
        queryType: stepResult.queryType,
        resultCount: Array.isArray(results) ? results.length : 0,
        results: results,
        parameters: stepResult.parameters,
        timestamp: stepResult.timestamp
      });

      // Create cross-references for common data types
      if (stepResult.queryType === 'find_meetings' && Array.isArray(results)) {
        context.intermediateData.set('latest_meetings', results);
        context.intermediateData.set('meeting_ids', results.map(m => m.id).filter(Boolean));
      }

      if (stepResult.queryType === 'get_participants' && Array.isArray(results)) {
        context.intermediateData.set('latest_participants', results);
        context.intermediateData.set('participant_emails', results.map(p => p.email).filter(Boolean));
      }

      if (stepResult.queryType === 'find_frequent_collaborators' && Array.isArray(results)) {
        context.intermediateData.set('latest_collaborators', results);
        context.intermediateData.set('collaborator_emails', results.map(c => c.email).filter(Boolean));
      }
    }
  }

  /**
   * Get execution context
   * @param {string} executionId - Execution identifier
   * @returns {Object|null} - Execution context
   */
  getExecutionContext(executionId) {
    return this.executionContexts.get(executionId) || null;
  }

  /**
   * Get step result from context
   * @param {string} executionId - Execution identifier
   * @param {number} stepNumber - Step number
   * @returns {Object|null} - Step result
   */
  getStepResult(executionId, stepNumber) {
    const context = this.executionContexts.get(executionId);
    if (!context) return null;

    return context.stepResults.get(stepNumber) || null;
  }

  /**
   * Get intermediate data
   * @param {string} executionId - Execution identifier
   * @param {string} dataKey - Data key
   * @returns {any} - Intermediate data
   */
  getIntermediateData(executionId, dataKey) {
    const context = this.executionContexts.get(executionId);
    if (!context) return null;

    return context.intermediateData.get(dataKey) || null;
  }

  /**
   * Get cached entities
   * @param {string} executionId - Execution identifier
   * @param {string} entityType - Entity type (people, meetings, documents, topics)
   * @returns {any} - Cached entities
   */
  getCachedEntities(executionId, entityType) {
    const context = this.executionContexts.get(executionId);
    if (!context || !context.entityCache[entityType]) return null;

    if (entityType === 'topics') {
      return Array.from(context.entityCache.topics);
    }

    // Convert Map to Array for other entity types
    return Array.from(context.entityCache[entityType].values());
  }

  /**
   * Build context summary for LLM prompts
   * @param {string} executionId - Execution identifier
   * @returns {Object} - Context summary
   */
  buildContextSummary(executionId) {
    const context = this.executionContexts.get(executionId);
    if (!context) return null;

    const summary = {
      executionId,
      originalQuery: context.metadata.originalQuery,
      progress: {
        completedSteps: context.metadata.completedSteps,
        totalSteps: context.metadata.totalSteps,
        percentage: Math.round((context.metadata.completedSteps / context.metadata.totalSteps) * 100)
      },
      entities: {
        peopleCount: context.entityCache.people.size,
        meetingsCount: context.entityCache.meetings.size,
        documentsCount: context.entityCache.documents.size,
        topicsCount: context.entityCache.topics.size
      },
      recentResults: []
    };

    // Add recent step results (last 3)
    const stepNumbers = Array.from(context.stepResults.keys()).sort((a, b) => b - a);
    for (let i = 0; i < Math.min(3, stepNumbers.length); i++) {
      const stepNumber = stepNumbers[i];
      const result = context.stepResults.get(stepNumber);
      if (result) {
        summary.recentResults.push({
          step: stepNumber,
          queryType: result.queryType,
          description: result.description,
          success: result.success,
          resultCount: Array.isArray(result.results?.results) ? result.results.results.length : 0
        });
      }
    }

    return summary;
  }

  /**
   * Add conversation context
   * @param {string} executionId - Execution identifier
   * @param {Object} conversationEntry - Conversation entry
   * @returns {Promise<void>}
   */
  async addConversationContext(executionId, conversationEntry) {
    const context = this.executionContexts.get(executionId);
    if (!context) return;

    context.conversationHistory.push({
      ...conversationEntry,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10 conversation entries
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }
  }

  /**
   * Get conversation history
   * @param {string} executionId - Execution identifier
   * @returns {Array} - Conversation history
   */
  getConversationHistory(executionId) {
    const context = this.executionContexts.get(executionId);
    return context ? context.conversationHistory : [];
  }

  /**
   * Finalize execution context
   * @param {string} executionId - Execution identifier
   * @returns {Promise<void>}
   */
  async finalizeExecution(executionId) {
    const context = this.executionContexts.get(executionId);
    if (!context) return;

    context.status = 'finalized';
    context.endTime = new Date();
    context.duration = context.endTime - context.startTime;

    console.log(`[QueryContextManager] Finalized execution context ${executionId}`);
  }

  /**
   * Cleanup old execution contexts
   */
  cleanupOldContexts() {
    const cutoff = Date.now() - this.maxContextAge;
    let cleanedCount = 0;

    for (const [id, context] of this.executionContexts) {
      const contextAge = context.endTime ? context.endTime.getTime() : context.startTime.getTime();
      if (contextAge < cutoff) {
        this.executionContexts.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[QueryContextManager] Cleaned up ${cleanedCount} old execution contexts`);
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const activeContexts = Array.from(this.executionContexts.values())
      .filter(ctx => ctx.status !== 'finalized');
    
    const finalizedContexts = Array.from(this.executionContexts.values())
      .filter(ctx => ctx.status === 'finalized');

    return {
      totalContexts: this.executionContexts.size,
      activeContexts: activeContexts.length,
      finalizedContexts: finalizedContexts.length,
      averageStepsPerExecution: finalizedContexts.length > 0 
        ? finalizedContexts.reduce((sum, ctx) => sum + ctx.metadata.completedSteps, 0) / finalizedContexts.length 
        : 0,
      averageExecutionTime: finalizedContexts.length > 0
        ? finalizedContexts.reduce((sum, ctx) => sum + (ctx.duration || 0), 0) / finalizedContexts.length
        : 0
    };
  }

  /**
   * Clear all contexts (for testing)
   */
  clearAllContexts() {
    this.executionContexts.clear();
    console.log('[QueryContextManager] Cleared all execution contexts');
  }

  /**
   * Set configuration
   * @param {Object} config - Configuration options
   */
  setConfiguration(config) {
    if (config.maxContextAge) this.maxContextAge = config.maxContextAge;
    if (config.maxContexts) this.maxContexts = config.maxContexts;
  }
}

module.exports = new QueryContextManager();
