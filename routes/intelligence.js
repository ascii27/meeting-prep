/**
 * Intelligence API Routes
 * Provides endpoints for accessing meeting intelligence data
 */
const express = require('express');
const router = express.Router();
const intelligenceService = require('../services/intelligenceService');
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

module.exports = router;
