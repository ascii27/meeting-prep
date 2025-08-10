/**
 * Intelligence API Routes
 * Primary API for meeting intelligence queries using simplified graph database tools
 */

const express = require('express');
const router = express.Router();
const simplifiedIterativeQueryService = require('../services/intelligence/simplifiedIterativeQueryService');
const simplifiedLLMQueryService = require('../services/intelligence/llm/simplifiedLLMQueryService');
const { ensureAuth } = require('../middleware/auth');

/**
 * Process a query using simplified tools
 */
router.post('/query', ensureAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`[Intelligence API] Processing query: "${query}"`);
    
    const context = {
      userEmail: req.user.email,
      userId: req.user.id
    };
    
    const startTime = Date.now();
    
    // Process query using simplified iterative service
    const result = await simplifiedIterativeQueryService.processQuery(query, context);
    
    const duration = Date.now() - startTime;
    
    console.log(`[Intelligence API] Query completed in ${duration}ms`);
    
    res.json({
      success: true,
      query: query,
      response: result.response,
      metadata: {
        iterations: result.metadata.iterations,
        resultsCollected: result.metadata.resultsCollected,
        duration: duration
      }
      // Removed debug.results to reduce payload size
    });
    
  } catch (error) {
    console.error('[Intelligence API] Error processing query:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      query: req.body.query
    });
  }
});

/**
 * Test individual tools directly
 */
router.post('/test-tool', ensureAuth, async (req, res) => {
  try {
    const { tool, parameters } = req.body;
    
    if (!tool) {
      return res.status(400).json({ error: 'Tool name is required' });
    }
    
    console.log(`[Intelligence API] Testing tool: ${tool}`);
    
    const context = {
      userEmail: req.user.email,
      userId: req.user.id
    };
    
    const result = await simplifiedLLMQueryService.executeQuery(tool, parameters || {}, context);
    
    res.json({
      success: true,
      tool: tool,
      parameters: parameters,
      result: result
    });
    
  } catch (error) {
    console.error('[Intelligence API] Error testing tool:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tool: req.body.tool
    });
  }
});

/**
 * Get available tools and their descriptions
 */
router.get('/tools', (req, res) => {
  try {
    const tools = simplifiedLLMQueryService.getAvailableTools();
    
    res.json({
      success: true,
      tools: tools,
      count: Object.keys(tools).length
    });
    
  } catch (error) {
    console.error('[Intelligence API] Error getting tools:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get tool suggestion for a query
 */
router.post('/suggest-tool', (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const suggestion = simplifiedLLMQueryService.suggestTool(query);
    
    res.json({
      success: true,
      query: query,
      suggestion: suggestion
    });
    
  } catch (error) {
    console.error('[Intelligence API] Error suggesting tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
