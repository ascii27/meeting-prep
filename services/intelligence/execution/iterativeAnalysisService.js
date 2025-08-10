/**
 * Iterative Analysis Service
 * Analyzes intermediate results and generates follow-up queries for comprehensive responses
 */
const llmService = require('../llm/llmService');

class IterativeAnalysisService {
  constructor() {
    this.analysisThresholds = {
      minResultsForAnalysis: 1,
      maxFollowUpSteps: 3,
      confidenceThreshold: 0.7,
      completenessThreshold: 0.8
    };
  }

  /**
   * Analyze intermediate results to determine if follow-up queries are needed
   * @param {Array} stepResults - Results from executed steps
   * @param {Object} strategy - Original query strategy
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Analysis result with follow-up recommendations
   */
  async analyzeIntermediateResults(stepResults, strategy, context) {
    try {
      console.log(`[IterativeAnalysisService] Analyzing ${stepResults.length} step results`);

      // Filter successful results for analysis
      const successfulResults = stepResults.filter(result => result.success);
      
      if (successfulResults.length < this.analysisThresholds.minResultsForAnalysis) {
        return {
          needsFollowUp: false,
          reason: 'Insufficient successful results for analysis',
          followUpSteps: [],
          analysisConfidence: 0
        };
      }

      // Perform comprehensive analysis
      const analysis = await this.performComprehensiveAnalysis(successfulResults, strategy, context);
      
      // Determine if follow-up is needed
      const followUpDecision = this.evaluateFollowUpNeed(analysis, strategy);
      
      // Generate follow-up steps if needed
      let followUpSteps = [];
      if (followUpDecision.needsFollowUp) {
        followUpSteps = await this.generateFollowUpSteps(analysis, strategy, context);
      }

      const result = {
        needsFollowUp: followUpDecision.needsFollowUp,
        reason: followUpDecision.reason,
        followUpSteps,
        analysis: analysis.summary,
        confidence: analysis.confidence,
        completeness: analysis.completeness,
        insights: analysis.insights
      };

      console.log(`[IterativeAnalysisService] Analysis complete: ${result.needsFollowUp ? 'Follow-up needed' : 'No follow-up required'}`);

      return result;

    } catch (error) {
      console.error('[IterativeAnalysisService] Analysis failed:', error);
      return {
        needsFollowUp: false,
        reason: `Analysis failed: ${error.message}`,
        followUpSteps: [],
        error: error.message
      };
    }
  }

  /**
   * Perform comprehensive analysis of step results
   * @param {Array} results - Successful step results
   * @param {Object} strategy - Original strategy
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} - Comprehensive analysis
   */
  async performComprehensiveAnalysis(results, strategy, context) {
    // Aggregate data from all results
    const aggregatedData = this.aggregateResultData(results);
    
    // Build analysis prompt for LLM
    const analysisPrompt = this.buildAnalysisPrompt(results, strategy, context, aggregatedData);
    
    // Get LLM analysis
    const llmAnalysis = await llmService.generateResponse(analysisPrompt, {}, {
      ...context,
      systemPrompt: this.getAnalysisSystemPrompt()
    });

    // Parse LLM response
    const parsedAnalysis = this.parseLLMAnalysis(llmAnalysis);
    
    // Calculate metrics
    const metrics = this.calculateAnalysisMetrics(results, aggregatedData);
    
    return {
      summary: parsedAnalysis.summary || 'Analysis completed',
      insights: parsedAnalysis.insights || [],
      gaps: parsedAnalysis.gaps || [],
      confidence: parsedAnalysis.confidence || metrics.confidence, // Use LLM confidence if available
      completeness: parsedAnalysis.completeness || metrics.completeness, // Use LLM completeness if available
      dataQuality: metrics.dataQuality,
      aggregatedData,
      recommendations: parsedAnalysis.recommendations || []
    };
  }

  /**
   * Aggregate data from all step results
   * @param {Array} results - Step results
   * @returns {Object} - Aggregated data
   */
  aggregateResultData(results) {
    const aggregated = {
      totalResults: 0,
      resultsByType: {},
      entities: {
        people: new Set(),
        meetings: new Set(),
        documents: new Set(),
        topics: new Set()
      },
      timeRanges: [],
      patterns: []
    };

    results.forEach(result => {
      if (!result.results || !result.results.results) return;

      const data = result.results.results;
      const queryType = result.queryType;

      // Count results by type
      if (Array.isArray(data)) {
        aggregated.totalResults += data.length;
        aggregated.resultsByType[queryType] = (aggregated.resultsByType[queryType] || 0) + data.length;

        // Extract entities based on query type
        this.extractEntitiesFromResults(data, queryType, aggregated.entities);
      }

      // Extract time ranges if available
      if (result.parameters && (result.parameters.timeframe || result.parameters.startDate)) {
        aggregated.timeRanges.push({
          queryType,
          timeframe: result.parameters.timeframe,
          startDate: result.parameters.startDate,
          endDate: result.parameters.endDate
        });
      }
    });

    // Convert sets to arrays for serialization
    Object.keys(aggregated.entities).forEach(key => {
      aggregated.entities[key] = Array.from(aggregated.entities[key]);
    });

    return aggregated;
  }

  /**
   * Extract entities from query results
   * @param {Array} data - Query result data
   * @param {string} queryType - Type of query
   * @param {Object} entities - Entity sets to populate
   */
  extractEntitiesFromResults(data, queryType, entities) {
    data.forEach(item => {
      // Extract people
      if (item.email) entities.people.add(item.email);
      if (item.organizer?.email) entities.people.add(item.organizer.email);
      if (item.attendees) {
        item.attendees.forEach(attendee => {
          if (attendee.email) entities.people.add(attendee.email);
        });
      }

      // Extract meetings
      if (item.id && (queryType === 'find_meetings' || item.title)) {
        entities.meetings.add(item.id);
      }

      // Extract documents
      if (item.id && queryType === 'find_documents') {
        entities.documents.add(item.id);
      }

      // Extract topics from titles and descriptions
      if (item.title) {
        const topics = this.extractTopicsFromText(item.title);
        topics.forEach(topic => entities.topics.add(topic));
      }
      if (item.description) {
        const topics = this.extractTopicsFromText(item.description);
        topics.forEach(topic => entities.topics.add(topic));
      }
    });
  }

  /**
   * Extract topics from text using simple keyword extraction
   * @param {string} text - Text to extract topics from
   * @returns {Array} - Extracted topics
   */
  extractTopicsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    // Simple topic extraction - look for common meeting keywords
    const topicPatterns = [
      /\b(standup|scrum|retrospective|planning|review)\b/gi,
      /\b(project|feature|bug|issue|task)\b/gi,
      /\b(design|architecture|technical|development)\b/gi,
      /\b(marketing|sales|customer|user)\b/gi,
      /\b(quarterly|monthly|weekly|daily)\b/gi
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
   * Build analysis prompt for LLM
   * @param {Array} results - Step results
   * @param {Object} strategy - Original strategy
   * @param {Object} context - Execution context
   * @param {Object} aggregatedData - Aggregated data
   * @returns {string} - Analysis prompt
   */
  buildAnalysisPrompt(results, strategy, context, aggregatedData) {
    const resultsSummary = results.map(r => ({
      step: r.stepNumber,
      type: r.queryType,
      description: r.description,
      resultCount: Array.isArray(r.results?.results) ? r.results.results.length : 0,
      success: r.success
    }));

    return `
# Intermediate Results Analysis

## Original Strategy
**Analysis**: ${strategy.analysis}
**Expected Outcome**: ${strategy.expectedOutcome}
**Complexity**: ${strategy.complexity}

## Executed Steps Summary
${JSON.stringify(resultsSummary, null, 2)}

## Aggregated Data
- **Total Results**: ${aggregatedData.totalResults}
- **People Found**: ${aggregatedData.entities.people.length}
- **Meetings Found**: ${aggregatedData.entities.meetings.length}
- **Documents Found**: ${aggregatedData.entities.documents.length}
- **Topics Identified**: ${aggregatedData.entities.topics.length}

## Results by Query Type
${JSON.stringify(aggregatedData.resultsByType, null, 2)}

## Task
Analyze these intermediate results and determine:

1. **Completeness**: Are the results sufficient to answer the original question?
2. **Gaps**: What information might be missing or incomplete?
3. **Insights**: What patterns or insights can be derived from the current data?
4. **Follow-up Needs**: What additional queries would provide more comprehensive answers?

## Response Format
Respond with a JSON object:

\`\`\`json
{
  "summary": "Brief analysis of the current results",
  "completeness": 0.8,
  "insights": [
    "Key insight 1",
    "Key insight 2"
  ],
  "gaps": [
    "Missing information 1",
    "Missing information 2"
  ],
  "recommendations": [
    "Recommendation for additional analysis"
  ],
  "needsFollowUp": true,
  "followUpReason": "Specific reason why follow-up is needed"
}
\`\`\`

Focus on providing actionable insights and specific recommendations for follow-up queries.
`;
  }

  /**
   * Get system prompt for analysis
   * @returns {string} - System prompt
   */
  getAnalysisSystemPrompt() {
    return `You are an expert data analyst specializing in organizational intelligence and meeting data analysis. Your role is to analyze intermediate query results and determine if additional information is needed to provide comprehensive answers.

Key principles:
1. **Thoroughness**: Identify gaps in data that could improve the final answer
2. **Relevance**: Focus on follow-up queries that directly address the original question
3. **Efficiency**: Avoid unnecessary queries that don't add significant value
4. **Context Awareness**: Consider the original strategy and expected outcomes

You have access to meeting data, participant information, collaboration patterns, and organizational insights. Always provide specific, actionable recommendations.`;
  }

  /**
   * Parse LLM analysis response
   * @param {string|Object} response - LLM response
   * @returns {Object} - Parsed analysis
   */
  parseLLMAnalysis(response) {
    try {
      let responseText = typeof response === 'object' && response.text 
        ? response.text 
        : response;

      // Extract JSON from response if wrapped in markdown
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      const parsed = JSON.parse(responseText);
      
      return {
        summary: parsed.summary || 'Analysis completed',
        completeness: parsed.completeness || 0.5,
        insights: parsed.insights || [],
        gaps: parsed.gaps || [],
        recommendations: parsed.recommendations || [],
        needsFollowUp: parsed.needsFollowUp || false,
        followUpReason: parsed.followUpReason || ''
      };

    } catch (error) {
      console.error('[IterativeAnalysisService] Failed to parse LLM analysis:', error);
      return {
        summary: 'Analysis parsing failed',
        completeness: 0.5,
        insights: [],
        gaps: ['Analysis parsing error'],
        recommendations: [],
        needsFollowUp: false,
        followUpReason: 'Unable to determine follow-up needs'
      };
    }
  }

  /**
   * Calculate analysis metrics
   * @param {Array} results - Step results
   * @param {Object} aggregatedData - Aggregated data
   * @returns {Object} - Analysis metrics
   */
  calculateAnalysisMetrics(results, aggregatedData) {
    const successRate = results.length > 0 ? 
      results.filter(r => r.success).length / results.length : 0;
    const dataRichness = aggregatedData.totalResults > 0 ? 
      Math.min(aggregatedData.totalResults / 10, 1) : 0; // Normalize to 0-1
    
    const entityDiversity = Object.values(aggregatedData.entities)
      .reduce((sum, entities) => sum + (entities.length > 0 ? 1 : 0), 0) / 4;

    return {
      confidence: (successRate + dataRichness) / 2,
      completeness: (dataRichness + entityDiversity) / 2,
      dataQuality: successRate,
      entityDiversity
    };
  }

  /**
   * Evaluate if follow-up queries are needed
   * @param {Object} analysis - Comprehensive analysis
   * @param {Object} strategy - Original strategy
   * @returns {Object} - Follow-up decision
   */
  evaluateFollowUpNeed(analysis, strategy) {
    const reasons = [];

    // Check completeness threshold
    if (analysis.completeness < this.analysisThresholds.completenessThreshold) {
      reasons.push(`Low completeness score: ${analysis.completeness.toFixed(2)}`);
    }

    // Check confidence threshold
    if (analysis.confidence < this.analysisThresholds.confidenceThreshold) {
      reasons.push(`Low confidence score: ${analysis.confidence.toFixed(2)}`);
    }

    // Check for identified gaps
    if (analysis.gaps && analysis.gaps.length > 0) {
      reasons.push(`${analysis.gaps.length} gaps identified`);
    }

    // Check strategy complexity - high complexity strategies may need more iterations
    if (strategy.complexity === 'high' && analysis.completeness < 0.9) {
      reasons.push('High complexity strategy requires additional analysis');
    }

    const needsFollowUp = reasons.length > 0;

    return {
      needsFollowUp,
      reason: needsFollowUp ? reasons.join('; ') : 'Analysis appears complete'
    };
  }

  /**
   * Generate follow-up query steps
   * @param {Object} analysis - Comprehensive analysis
   * @param {Object} strategy - Original strategy
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} - Follow-up steps
   */
  async generateFollowUpSteps(analysis, strategy, context) {
    try {
      const followUpPrompt = this.buildFollowUpPrompt(analysis, strategy, context);
      
      const llmResponse = await llmService.generateResponse(followUpPrompt, {}, {
        ...context,
        systemPrompt: this.getFollowUpSystemPrompt()
      });

      const followUpSteps = this.parseFollowUpSteps(llmResponse);
      
      // Limit number of follow-up steps
      return followUpSteps.slice(0, this.analysisThresholds.maxFollowUpSteps);

    } catch (error) {
      console.error('[IterativeAnalysisService] Follow-up generation failed:', error);
      return [];
    }
  }

  /**
   * Build follow-up generation prompt
   * @param {Object} analysis - Analysis results
   * @param {Object} strategy - Original strategy
   * @param {Object} context - Execution context
   * @returns {string} - Follow-up prompt
   */
  buildFollowUpPrompt(analysis, strategy, context) {
    return `
# Follow-up Query Generation

## Original Strategy
**Analysis**: ${strategy.analysis}
**Expected Outcome**: ${strategy.expectedOutcome}

## Current Analysis Results
**Completeness**: ${analysis.completeness.toFixed(2)}
**Confidence**: ${analysis.confidence.toFixed(2)}

## Identified Gaps
${analysis.gaps.map(gap => `- ${gap}`).join('\n')}

## Recommendations
${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Available Query Types
- find_meetings: Find meetings with specific criteria
- get_participants: Find people and participants
- find_documents: Find documents and files
- analyze_collaboration: Analyze collaboration patterns
- find_frequent_collaborators: Find key collaborators
- analyze_meeting_patterns: Analyze meeting timing patterns
- get_department_insights: Department-specific analytics
- analyze_topic_trends: Topic and content analysis
- find_meeting_conflicts: Scheduling conflict detection
- get_productivity_insights: Productivity metrics
- analyze_communication_flow: Communication patterns

## Task
Generate 1-3 follow-up query steps that would address the identified gaps and improve the completeness of the analysis.

## Response Format
\`\`\`json
{
  "followUpSteps": [
    {
      "stepNumber": "next_available_number",
      "description": "What this step accomplishes",
      "queryType": "appropriate_query_type",
      "parameters": {
        "key": "value pairs for the query"
      },
      "dependencies": [],
      "estimatedTime": "fast|medium|slow",
      "purpose": "Why this step is needed to address gaps"
    }
  ]
}
\`\`\`

Focus on queries that directly address the gaps and provide the most value for completing the original analysis.
`;
  }

  /**
   * Get system prompt for follow-up generation
   * @returns {string} - System prompt
   */
  getFollowUpSystemPrompt() {
    return `You are an expert query strategist specializing in iterative analysis and follow-up query generation. Your role is to identify the most valuable additional queries that would improve the completeness and quality of organizational intelligence analysis.

Key principles:
1. **Gap-focused**: Target specific gaps identified in the analysis
2. **Value-driven**: Prioritize queries that add the most value
3. **Efficient**: Minimize the number of additional queries needed
4. **Contextual**: Consider the original strategy and user intent

Always generate practical, executable follow-up steps that directly address identified gaps.`;
  }

  /**
   * Parse follow-up steps from LLM response
   * @param {string|Object} response - LLM response
   * @returns {Array} - Parsed follow-up steps
   */
  parseFollowUpSteps(response) {
    try {
      let responseText = typeof response === 'object' && response.text 
        ? response.text 
        : response;

      // Extract JSON from response if wrapped in markdown - more flexible regex
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        responseText = jsonMatch[1];
      }

      const parsed = JSON.parse(responseText);
      
      return parsed.followUpSteps || [];

    } catch (error) {
      console.error('[IterativeAnalysisService] Failed to parse follow-up steps:', error);
      return [];
    }
  }

  /**
   * Set analysis thresholds
   * @param {Object} thresholds - New threshold values
   */
  setAnalysisThresholds(thresholds) {
    this.analysisThresholds = { ...this.analysisThresholds, ...thresholds };
  }

  /**
   * Get current analysis thresholds
   * @returns {Object} - Current thresholds
   */
  getAnalysisThresholds() {
    return { ...this.analysisThresholds };
  }
}

module.exports = IterativeAnalysisService;
