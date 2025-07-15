const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const meetingPrepService = require('../services/meetingPrepService');

/**
 * @route   GET /api/preparation/:meetingId
 * @desc    Get AI-generated preparation materials for a meeting
 * @access  Private
 */
router.get('/:meetingId', ensureAuth, async (req, res) => {
  try {
    const meetingId = req.params.meetingId;
    
    // Get user's OAuth tokens from session
    const tokens = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    };
    
    // Get preparation materials
    const prepMaterials = await meetingPrepService.prepareMeetingMaterials(meetingId, tokens);
    
    // Get user notes if available
    const userNotes = meetingPrepService.getUserNotes(meetingId);
    
    // Combine preparation materials with user notes
    const response = {
      ...prepMaterials,
      userNotes
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting meeting preparation:', error);
    res.status(500).json({ error: 'Failed to get meeting preparation materials' });
  }
});

/**
 * @route   POST /api/preparation/:meetingId/analyze
 * @desc    Manually trigger analysis for a meeting
 * @access  Private
 */
router.post('/:meetingId/analyze', ensureAuth, async (req, res) => {
  try {
    const meetingId = req.params.meetingId;
    
    // Clear cache to force re-analysis
    meetingPrepService.clearPrepCache(meetingId);
    
    // Get user's OAuth tokens from session
    const tokens = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    };
    
    // Get fresh preparation materials
    const prepMaterials = await meetingPrepService.prepareMeetingMaterials(meetingId, tokens);
    
    // Get user notes if available
    const userNotes = meetingPrepService.getUserNotes(meetingId);
    
    // Combine preparation materials with user notes
    const response = {
      ...prepMaterials,
      userNotes
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error analyzing meeting:', error);
    res.status(500).json({ error: 'Failed to analyze meeting' });
  }
});

/**
 * @route   POST /api/preparation/:meetingId/notes
 * @desc    Save user notes for a meeting
 * @access  Private
 */
router.post('/:meetingId/notes', ensureAuth, (req, res) => {
  try {
    const meetingId = req.params.meetingId;
    const { notes } = req.body;
    
    if (!notes) {
      return res.status(400).json({ error: 'Notes are required' });
    }
    
    // Save user notes
    const success = meetingPrepService.saveUserNotes(meetingId, notes);
    
    if (success) {
      res.json({ success: true, message: 'Notes saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save notes' });
    }
  } catch (error) {
    console.error('Error saving notes:', error);
    res.status(500).json({ error: 'Failed to save notes' });
  }
});

module.exports = router;
