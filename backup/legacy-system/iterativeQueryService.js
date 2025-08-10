/**
 * Simplified Iterative Query Service
 * Implements a clean 3-stage process for intelligent query handling
 */

const llmService = require('./llm/llmService');
const simplifiedLLMQueryService = require('./llm/simplifiedLLMQueryService');
const litellmService = require('../litellmService');
const aiConfig = require('../../config/aiConfig');
const fs = require('fs').promises;
const path = require('path');

class IterativeQueryService {
  constructor() {
    this.maxIterations = 3;
    this.databaseCapabilities = null;
  }

  /**
   * Initialize the service and load database capabilities
   */
  async initialize() {
    if (!this.databaseCapabilities) {
      try {
        const capabilitiesPath = path.join(__dirname, '../../docs/simplified-tools.md');
        this.databaseCapabilities = await fs.readFile(capabilitiesPath, 'utf8');
        console.log('[IterativeQueryService] Database capabilities loaded');
      } catch (error) {
        console.error('[IterativeQueryService] Failed to load database capabilities:', error);
        this.databaseCapabilities = 'Database capabilities not available';
      }
    }
  }

  /**
   * Process a user query using the iterative 3-stage approach
   * @param {string} userQuery - The user's question
   * @param {Object} context - User context (email, etc.)
   * @returns {Object} - Final response with answer and metadata
   */
  async processQuery(userQuery, context = {}) {
    await this.initialize();
    
    console.log(`[IterativeQueryService] Starting iterative processing for: "${userQuery}"`);
    
    let iteration = 1;
    let collectedResults = [];
    let finalAnswer = null;
    
    while (iteration <= this.maxIterations && !finalAnswer) {
      console.log(`[IterativeQueryService] === Iteration ${iteration} ===`);
      
      if (iteration === 1) {
        // Stage 1: Initial strategy planning
        const strategy = await this.getInitialStrategy(userQuery, context);
        if (strategy.finalAnswer) {
          finalAnswer = strategy.finalAnswer;
          break;
        }
        
        // Execute the queries from the strategy
        const results = await this.executeQueries(strategy.queries, context);
        collectedResults.push(...results);
        
      } else {
        // Stage 2+: Iterative refinement
        const nextStep = await this.getNextStep(userQuery, collectedResults, context);
        if (nextStep.finalAnswer) {
          finalAnswer = nextStep.finalAnswer;
          break;
        }
        
        // Execute additional queries if needed
        if (nextStep.queries && nextStep.queries.length > 0) {
          const results = await this.executeQueries(nextStep.queries, context);
          collectedResults.push(...results);
        }
      }
      
      iteration++;
    }
    
    // If we hit max iterations without a final answer, generate one from collected results
    if (!finalAnswer) {
      console.log('[IterativeQueryService] Max iterations reached, generating final answer from collected results');
      finalAnswer = await this.generateFinalAnswer(userQuery, collectedResults, context);
    }
    
    return {
      query: userQuery,
      answer: finalAnswer,
      iterations: iteration - 1,
      resultsCollected: collectedResults.length,
      metadata: {
        processedAt: new Date().toISOString(),
        user: context.userEmail,
        systemUsed: 'Simplified Iterative Query Service'
      }
    };
  }

  /**
   * Stage 1: Get initial strategy from LLM
   */
  async getInitialStrategy(userQuery, context) {
    const prompt = `
# Query Analysis Request

## User Question
"${userQuery}"

## Available Database Tools
${this.databaseCapabilities}

## User Context
- Email: ${context.userEmail || 'unknown'}
- Current date: ${new Date().toISOString().split('T')[0]}

## Task
Analyze the user's question and determine what queries need to be executed to answer it.

You have two options:

**Option 1: Provide Queries**
If you need to query the database, respond with:
\`\`\`json
{
  "needsQueries": true,
  "reasoning": "Why queries are needed",
  "queries": [
    {
      "type": "find_meetings|get_participants|analyze_collaboration|etc",
      "description": "What this query will find",
      "parameters": {
        "key": "value pairs for the query"
      }
    }
  ]
}
\`\`\`

**Option 2: Direct Answer**
If you can answer directly without queries, respond with:
\`\`\`json
{
  "needsQueries": false,
  "finalAnswer": "Your complete answer to the user's question"
}
\`\`\`

CRITICAL: You MUST respond with ONLY the JSON object wrapped in \`\`\`json code blocks. 
DO NOT include any explanatory text, conversational responses, or commentary outside the JSON.
Your entire response should be the JSON code block and nothing else.`;

    console.log('[IterativeQueryService] 📤 Requesting initial strategy from LLM');
    console.log('[IterativeQueryService] 🔍 Full prompt being sent:');
    console.log('--- PROMPT START ---');
    console.log(prompt);
    console.log('--- PROMPT END ---');
    console.log('[IterativeQueryService] 🔍 System prompt:', 'You are a query planning assistant. You MUST respond with ONLY valid JSON wrapped in ```json code blocks. Do not include any explanations, commentary, or conversational text outside the JSON.');
    
    // Call LiteLLM directly instead of going through llmService.generateResponse
    const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
    const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
    
    console.log('[IterativeQueryService] 🔍 Using model:', model);
    console.log('[IterativeQueryService] 🔍 Token parameter:', tokenParam);
    
    const requestParams = {
      model: model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a query planning assistant. You MUST respond with ONLY valid JSON wrapped in ```json code blocks. Do not include any explanations, commentary, or conversational text outside the JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: aiConfig.litellm.defaultParams.temperature,
      [tokenParam]: aiConfig.litellm.defaultParams.maxTokens
    };
    
    console.log('[IterativeQueryService] 🔍 Request params:', JSON.stringify(requestParams, null, 2));
    
    const completion = await litellmService.completion(requestParams);
    
    console.log('[IterativeQueryService] 🔍 Raw completion response:', JSON.stringify(completion, null, 2));
    
    const response = completion.choices[0].message.content;
    
    const responseText = typeof response === 'object' && response.text ? response.text : response;
    console.log('[IterativeQueryService] 📥 FULL LLM strategy response:');
    console.log('--- RESPONSE START ---');
    console.log(responseText);
    console.log('--- RESPONSE END ---');
    
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      const strategy = JSON.parse(jsonText);
      
      if (strategy.needsQueries) {
        return { queries: strategy.queries || [] };
      } else {
        return { finalAnswer: strategy.finalAnswer };
      }
    } catch (error) {
      console.error('[IterativeQueryService] Failed to parse strategy:', error);
      // Fallback: assume we need a basic meeting query
      return {
        queries: [{
          type: 'find_meetings',
          description: 'Find relevant meetings',
          parameters: { userEmail: context.userEmail, timeframe: 'recent' }
        }]
      };
    }
  }

  /**
   * Stage 2+: Get next step based on collected results
   */
  async getNextStep(userQuery, collectedResults, context) {
    const resultsText = this.formatResultsForLLM(collectedResults);
    
    const prompt = `# Query Refinement Request

## Original User Question
"${userQuery}"

## Results Collected So Far
${resultsText}

## Available Query Functions

### find_meetings
- **Input**: timeframe, optional person email
- **Output**: List of meetings with titles, dates, participants

### find_people
- **Input**: name or email (partial matches work)
- **Output**: Person details and contact info

### get_meeting_participants
- **Input**: meeting identifier or search criteria
- **Output**: List of attendees for specific meetings

### get_meeting_content
- **Input**: timeframe, person name/email, meeting title keywords
- **Output**: Meeting documents, summaries, and full content for analysis
- **Use for**: Questions about meeting summaries, what was discussed, action items, decisions made

### analyze_collaboration
- **Input**: person email or department
- **Output**: Who they work with most, meeting patterns

## Task
Based on the results collected so far, determine if you can now answer the user's question or if you need more data.

**Option 1: Need More Queries**
\`\`\`json
{
  "needsMoreQueries": true,
  "reasoning": "Why more queries are needed",
  "queries": [
    {
      "type": "query_type",
      "description": "What this query will find",
      "parameters": {}
    }
  ]
}
\`\`\`

**Option 2: Ready to Answer**
\`\`\`json
{
  "needsMoreQueries": false,
  "finalAnswer": "Your complete answer based on all the collected results"
}
\`\`\`

CRITICAL: You MUST respond with ONLY the JSON object wrapped in \`\`\`json code blocks. 
DO NOT include any explanatory text, conversational responses, or commentary outside the JSON.
Your entire response should be the JSON code block and nothing else.`;

    console.log('[IterativeQueryService] 📤 Requesting next step from LLM');
    console.log('[IterativeQueryService] 🔍 Full next step prompt being sent:');
    console.log('--- NEXT STEP PROMPT START ---');
    console.log(prompt);
    console.log('--- NEXT STEP PROMPT END ---');
    console.log('[IterativeQueryService] 🔍 Next step system prompt:', 'You are a query refinement assistant. You MUST respond with ONLY valid JSON wrapped in ```json code blocks. Do not include any explanations, commentary, or conversational text outside the JSON.');
    
    // Call LiteLLM directly instead of going through llmService.generateResponse
    const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
    const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
    
    const completion = await litellmService.completion({
      model: model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a query refinement assistant. You MUST respond with ONLY valid JSON wrapped in ```json code blocks. Do not include any explanations, commentary, or conversational text outside the JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: aiConfig.litellm.defaultParams.temperature,
      [tokenParam]: aiConfig.litellm.defaultParams.maxTokens
    });
    
    const response = completion.choices[0].message.content;
    
    const responseText = typeof response === 'object' && response.text ? response.text : response;
    console.log('[IterativeQueryService] 📥 FULL LLM next step response:');
    console.log('--- NEXT STEP RESPONSE START ---');
    console.log(responseText);
    console.log('--- NEXT STEP RESPONSE END ---');
    
    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : responseText;
      const nextStep = JSON.parse(jsonText);
      
      if (nextStep.needsMoreQueries) {
        return { queries: nextStep.queries || [] };
      } else {
        return { finalAnswer: nextStep.finalAnswer };
      }
    } catch (error) {
      console.error('[IterativeQueryService] Failed to parse next step:', error);
      // If we can't parse, generate final answer from what we have
      return { finalAnswer: await this.generateFinalAnswer(userQuery, collectedResults, context) };
    }
  }

  /**
   * Execute a list of queries and collect results
   */
  async executeQueries(queries, context) {
    const results = [];
    
    for (const query of queries) {
      try {
        console.log(`[IterativeQueryService] 🔍 Executing query: ${query.tool || query.type} - ${query.description}`);
        
        // Use simplified tools instead of legacy query service
        const toolName = query.tool || query.type;
        const parameters = query.parameters || {};
        
        const queryResult = await simplifiedLLMQueryService.executeQuery(
          toolName, 
          parameters, 
          context
        );
        
        results.push({
          query: query,
          result: queryResult,
          timestamp: new Date().toISOString()
        });
        
        console.log(`[IterativeQueryService] ✅ Query completed: ${queryResult.result?.count || 0} results`);
        
      } catch (error) {
        console.error(`[IterativeQueryService] ❌ Query failed:`, error);
        results.push({
          query: query,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Format collected results for LLM consumption
   */
  formatResultsForLLM(collectedResults) {
    if (collectedResults.length === 0) {
      return 'No results collected yet.';
    }
    
    let formatted = '';
    collectedResults.forEach((item, index) => {
      formatted += `\n### Result ${index + 1}: ${item.query.description}\n`;
      
      if (item.error) {
        formatted += `❌ Error: ${item.error}\n`;
      } else if (item.result) {
        formatted += `✅ Found ${item.result.totalResults || 0} results\n`;
        
        // Include ALL data for proper analysis
        if (item.result.data && Array.isArray(item.result.data) && item.result.data.length > 0) {
          formatted += 'Complete results:\n';
          item.result.data.forEach((dataItem, i) => {
            if (dataItem.title) {
              formatted += `${i + 1}. ${dataItem.title}`;
              if (dataItem.startTime) {
                const date = new Date(dataItem.startTime);
                formatted += ` - ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
              }
              if (dataItem.participants && dataItem.participants.length > 0) {
                formatted += ` (${dataItem.participants.length} participants)`;
              }
              formatted += '\n';
            }
          });
        }
      }
    });
    
    return formatted;
  }

  /**
   * Generate final answer when max iterations reached
   */
  async generateFinalAnswer(userQuery, collectedResults, context) {
    const resultsText = this.formatResultsForLLM(collectedResults);
    
    const prompt = `
# Final Answer Generation

## User Question
"${userQuery}"

## All Collected Results
${resultsText}

## Task
Provide a comprehensive answer to the user's question based on all the collected results. Be helpful and specific.

If no relevant results were found, explain why and suggest alternative approaches.

Respond with a natural, conversational answer (not JSON).`;

    console.log('[IterativeQueryService] 📤 Generating final answer from collected results');
    
    // Call LiteLLM directly instead of going through llmService.generateResponse
    const model = aiConfig.litellm.fallbackModels[0] || 'gpt-4';
    const tokenParam = model.includes('gpt-5') ? 'max_completion_tokens' : 'max_tokens';
    
    const completion = await litellmService.completion({
      model: model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant providing final answers based on collected data. Provide clear, comprehensive answers in natural language.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: aiConfig.litellm.defaultParams.temperature,
      [tokenParam]: Math.max(aiConfig.litellm.defaultParams.maxTokens, 1500)  // Use config value or 1500, whichever is higher for final answers
    });
    
    const finalAnswer = completion.choices[0].message.content;
    console.log('[IterativeQueryService] ✅ Final answer generated:', finalAnswer.substring(0, 100) + '...');
    
    return finalAnswer;
  }
}

module.exports = IterativeQueryService;
