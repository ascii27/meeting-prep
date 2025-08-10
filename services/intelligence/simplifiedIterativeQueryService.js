/**
 * Simplified Iterative Query Service
 * Clean, focused approach to intelligent query planning with simplified tools
 */

const simplifiedLLMQueryService = require('./llm/simplifiedLLMQueryService');
const litellmService = require('../litellmService');
const fs = require('fs').promises;
const path = require('path');

class SimplifiedIterativeQueryService {
  constructor() {
    this.maxIterations = 3;
    this.toolsDocumentation = null;
  }

  /**
   * Initialize the service and load simplified tools documentation
   */
  async initialize() {
    if (!this.toolsDocumentation) {
      try {
        const toolsPath = path.join(__dirname, '../docs/simplified-tools.md');
        this.toolsDocumentation = await fs.readFile(toolsPath, 'utf8');
        console.log('[SimplifiedIterativeQueryService] Simplified tools documentation loaded');
      } catch (error) {
        console.error('[SimplifiedIterativeQueryService] Failed to load tools documentation:', error);
        this.toolsDocumentation = 'Tools documentation not available';
      }
    }
  }

  /**
   * Process a user query using simplified tools
   * @param {string} userQuery - The user's question
   * @param {Object} context - User context (email, etc.)
   * @returns {Object} - Final response with answer and metadata
   */
  async processQuery(userQuery, context = {}) {
    await this.initialize();
    
    console.log(`[SimplifiedIterativeQueryService] Processing query: "${userQuery}"`);
    
    let iteration = 1;
    let collectedResults = [];
    let finalAnswer = null;
    
    while (iteration <= this.maxIterations && !finalAnswer) {
      console.log(`[SimplifiedIterativeQueryService] === Iteration ${iteration} ===`);
      
      try {
        if (iteration === 1) {
          // First iteration: Plan strategy and execute initial queries
          const strategy = await this.planStrategy(userQuery, context, collectedResults);
          
          if (strategy.queries && strategy.queries.length > 0) {
            // Execute the planned queries
            for (const query of strategy.queries) {
              console.log(`[SimplifiedIterativeQueryService] Executing: ${query.tool}`);
              const result = await simplifiedLLMQueryService.executeQuery(
                query.tool, 
                query.parameters, 
                context
              );
              
              collectedResults.push({
                iteration: iteration,
                query: query,
                result: result,
                description: query.description
              });
            }
          }
        } else {
          // Subsequent iterations: Analyze results and decide next steps
          const nextStep = await this.analyzeAndPlanNextStep(userQuery, collectedResults, context);
          
          if (nextStep.needsMoreQueries && nextStep.queries) {
            // Execute additional queries
            for (const query of nextStep.queries) {
              console.log(`[SimplifiedIterativeQueryService] Executing follow-up: ${query.tool}`);
              const result = await simplifiedLLMQueryService.executeQuery(
                query.tool, 
                query.parameters, 
                context
              );
              
              collectedResults.push({
                iteration: iteration,
                query: query,
                result: result,
                description: query.description
              });
            }
          } else {
            // Ready for final answer
            finalAnswer = await this.generateFinalAnswer(userQuery, collectedResults, context);
            break;
          }
        }
        
        iteration++;
        
      } catch (error) {
        console.error(`[SimplifiedIterativeQueryService] Error in iteration ${iteration}:`, error);
        break;
      }
    }
    
    // Generate final answer if not already done
    if (!finalAnswer) {
      console.log('[SimplifiedIterativeQueryService] Max iterations reached, generating final answer');
      finalAnswer = await this.generateFinalAnswer(userQuery, collectedResults, context);
    }
    
    const duration = Date.now() - (this.startTime || Date.now());
    
    return {
      response: finalAnswer,
      metadata: {
        iterations: iteration - 1,
        resultsCollected: collectedResults.length,
        hasAnswer: !!finalAnswer,
        duration: duration
      },
      results: collectedResults
    };
  }

  /**
   * Plan initial strategy for the user query
   * @param {string} userQuery - User's question
   * @param {Object} context - User context
   * @param {Array} collectedResults - Previous results
   * @returns {Object} - Strategy with planned queries
   */
  async planStrategy(userQuery, context, collectedResults) {
    const systemPrompt = `You are an intelligent query planner for a meeting intelligence system.

CRITICAL: You MUST ONLY use these 5 exact tool names:
- find_meetings
- find_documents  
- find_people
- get_meeting_details
- analyze_patterns

DO NOT use any other tool names like "meeting_intelligence_search" or similar.

AVAILABLE TOOLS:
${this.toolsDocumentation}

RULES:
1. Return ONLY valid JSON
2. Use ONLY the 5 tool names listed above
3. Plan 1-2 queries maximum for the first iteration
4. Provide simple, clear parameters
5. Focus on getting core information needed

Response format:
{
  "reasoning": "Brief explanation of approach",
  "queries": [
    {
      "tool": "find_meetings",
      "description": "What this query will accomplish",
      "parameters": {
        "person": "name",
        "timeframe": "last week"
      }
    }
  ]
}`;

    const userPrompt = `User Query: "${userQuery}"
User Email: ${context.userEmail || 'unknown'}

Plan the best approach to answer this query using the available tools.`;

    try {
      console.log('[SimplifiedIterativeQueryService] Planning strategy...');
      
      const response = await litellmService.completion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });
      
      const responseText = response.choices[0].message.content.trim();
      console.log('[SimplifiedIterativeQueryService] Strategy response:', responseText);
      
      // Parse JSON response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      
      const strategy = JSON.parse(jsonText);
      console.log('[SimplifiedIterativeQueryService] Planned strategy:', strategy);
      
      return strategy;
      
    } catch (error) {
      console.error('[SimplifiedIterativeQueryService] Error planning strategy:', error);
      
      // Fallback: suggest a tool based on query analysis
      const suggestion = simplifiedLLMQueryService.suggestTool(userQuery);
      return {
        reasoning: `Fallback strategy: ${suggestion.reasoning}`,
        queries: [{
          tool: suggestion.tool,
          description: `Execute ${suggestion.tool} based on query analysis`,
          parameters: suggestion.suggested_parameters
        }]
      };
    }
  }

  /**
   * Analyze results and plan next steps
   * @param {string} userQuery - Original user query
   * @param {Array} collectedResults - Results from previous iterations
   * @param {Object} context - User context
   * @returns {Object} - Next step plan
   */
  async analyzeAndPlanNextStep(userQuery, collectedResults, context) {
    const systemPrompt = `You are analyzing query results to determine next steps.

AVAILABLE TOOLS:
${this.toolsDocumentation}

Analyze the collected results and determine if more queries are needed or if you can provide a final answer.

Response format:
{
  "needsMoreQueries": true/false,
  "reasoning": "Why you need more queries or why you're ready for final answer",
  "queries": [
    {
      "tool": "tool_name",
      "description": "What this query will accomplish",
      "parameters": {...}
    }
  ]
}`;

    const resultsText = collectedResults.map(r => 
      `Query: ${r.query.tool} - ${r.description}\nResult: ${JSON.stringify(r.result, null, 2)}`
    ).join('\n\n');

    const userPrompt = `Original Query: "${userQuery}"

Collected Results:
${resultsText}

Analyze these results and determine next steps.`;

    try {
      const response = await litellmService.completion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      });
      
      const responseText = response.choices[0].message.content.trim();
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      
      return JSON.parse(jsonText);
      
    } catch (error) {
      console.error('[SimplifiedIterativeQueryService] Error analyzing next steps:', error);
      return {
        needsMoreQueries: false,
        reasoning: 'Error in analysis, proceeding to final answer'
      };
    }
  }

  /**
   * Generate final answer based on collected results
   * @param {string} userQuery - Original user query
   * @param {Array} collectedResults - All collected results
   * @param {Object} context - User context
   * @returns {string} - Final answer
   */
  async generateFinalAnswer(userQuery, collectedResults, context) {
    const systemPrompt = `You are a meeting intelligence assistant providing final answers based on query results.

Provide a comprehensive, helpful answer based on the collected data. Be specific and include relevant details from the results.

If no relevant data was found, explain what was searched and suggest alternative approaches.

Keep the response conversational and helpful.`;

    const resultsText = collectedResults.map(r => 
      `Query: ${r.query.tool} - ${r.description}\nResult: ${JSON.stringify(r.result, null, 2)}`
    ).join('\n\n');

    const userPrompt = `Original Question: "${userQuery}"

Collected Data:
${resultsText}

Provide a comprehensive answer based on this information.`;

    try {
      const response = await litellmService.completion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      });
      
      return response.choices[0].message.content.trim();
      
    } catch (error) {
      console.error('[SimplifiedIterativeQueryService] Error generating final answer:', error);
      return 'I encountered an error while generating the final answer. Please try your query again.';
    }
  }
}

module.exports = new SimplifiedIterativeQueryService();
