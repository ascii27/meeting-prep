/**
 * Intelligence API Routes
 * Provides endpoints for accessing meeting intelligence data
 */
const express = require('express');
const router = express.Router();
const intelligenceService = require('../services/intelligenceService');
const llmQueryService = require('../services/intelligence/llm/llmQueryService');
const { ensureAuth } = require('../middleware/auth');

/**
 * @route GET /api/intelligence/status
 * @description Get the status of the intelligence processing
 * @access Private
 */
router.get('/status', ensureAuth, async (req, res) => {
  try {
    const status = intelligenceService.getProcessingStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting intelligence status:', error);
    res.status(500).json({ error: 'Failed to get intelligence status' });
  }
});

/**
 * @route POST /api/intelligence/process
 * @description Start processing the user's calendar data
 * @access Private
 */
router.post('/process', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    
    if (!user.tokens) {
      return res.status(400).json({ error: 'User tokens not available' });
    }
    
    const result = await intelligenceService.startCalendarProcessing(
      user.tokens,
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error starting intelligence processing:', error);
    res.status(500).json({ error: 'Failed to start intelligence processing' });
  }
});

/**
 * @route GET /api/intelligence/meetings
 * @description Get recent meetings
 * @access Private
 */
router.get('/meetings', ensureAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 10, 10);
    const meetings = await intelligenceService.getRecentMeetings(limit);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting recent meetings:', error);
    res.status(500).json({ error: 'Failed to get recent meetings' });
  }
});

/**
 * @route GET /api/intelligence/meetings/:id/participants
 * @description Get participants for a specific meeting
 * @access Private
 */
router.get('/meetings/:id/participants', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const participants = await intelligenceService.getMeetingParticipants(id);
    res.json(participants);
  } catch (error) {
    console.error('Error getting meeting participants:', error);
    res.status(500).json({ error: 'Failed to get meeting participants' });
  }
});

/**
 * @route GET /api/intelligence/people
 * @description Get meetings for a person (defaults to current user)
 * @access Private
 */
router.get('/people', ensureAuth, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;
    const limit = parseInt(req.query.limit || 10, 10);
    const meetings = await intelligenceService.getMeetingsForPerson(email, limit);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting meetings for person:', error);
    res.status(500).json({ error: 'Failed to get meetings for person' });
  }
});

/**
 * @route POST /api/intelligence/query
 * @description Process natural language queries about meeting intelligence
 * @access Private
 */
router.post('/query', ensureAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Query is required and must be a non-empty string' 
      });
    }
    
    // Build context for the query
    const context = {
      userEmail: req.user.email,
      userId: req.user.id,
      userName: req.user.displayName || req.user.email.split('@')[0]
    };
    
    console.log(`[Intelligence API] Processing natural language query from ${context.userEmail}: "${query}"`);
    
    // Process the query using the LLM query service
    const result = await llmQueryService.processQuery(query.trim(), context);
    
    // Add metadata to the response
    result.metadata = {
      processedAt: new Date().toISOString(),
      user: context.userEmail,
      processingTime: Date.now() - Date.now() // This would be calculated properly in production
    };
    
    console.log(`[Intelligence API] Query processed successfully. Intent: ${result.intent}, Results: ${result.results?.totalResults || 0}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error processing natural language query:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/intelligence/query/intents
 * @description Get available query intents and examples
 * @access Private
 */
router.get('/query/intents', ensureAuth, async (req, res) => {
  try {
    const llmService = require('../services/intelligence/llm/llmService');
    const intents = llmService.getAvailableIntents();
    res.json(intents);
  } catch (error) {
    console.error('Error getting available intents:', error);
    res.status(500).json({ error: 'Failed to get available intents' });
  }
});

module.exports = router;
