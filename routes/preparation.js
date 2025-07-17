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
    console.log(`[API] GET /api/preparation/${meetingId} - Fetching preparation materials`);
    
    // Get user's OAuth tokens from session
    const tokens = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    };
    
    // Get preparation materials
    console.log(`[API] Calling meetingPrepService.prepareMeetingMaterials for meeting ${meetingId}`);
    const prepMaterials = await meetingPrepService.prepareMeetingMaterials(meetingId, tokens);
    
    console.log(`[API] Successfully retrieved preparation materials for meeting ${meetingId}`);
    
    // Get user notes if available
    const userNotes = meetingPrepService.getUserNotes(meetingId);
    
    // Combine preparation materials with user notes
    const response = {
      ...prepMaterials,
      userNotes
    };
    
    console.log(`[API] Returning response for meeting ${meetingId}: ${JSON.stringify(response)}`);
    res.json(response);
  } catch (error) {
    console.error('Error getting meeting preparation:', error);
    console.log(`[API] Error response for meeting ${req.params.meetingId}: ${error.message}`);
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
    console.log(`[API] POST /api/preparation/${meetingId}/analyze - Triggering document analysis`);
    
    // Get user's OAuth tokens from session
    const tokens = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    };
    
    // Clear cache to force re-analysis but preserve document cache
    // We'll explicitly refresh documents below
    meetingPrepService.clearPrepCache(meetingId, true);
    
    // First, explicitly fetch all documents for the meeting to ensure we have the latest
    console.log(`[API] Fetching all documents for meeting ${meetingId}`);
    const calendarService = require('../services/calendarService');
    const documentService = require('../services/documentService');
    
    // Get the full event details to ensure we have all attachments
    const event = await calendarService.getEventById(meetingId, tokens);
    if (!event) {
      throw new Error('Meeting event not found');
    }
    
    // Force refresh document cache by clearing it first
    console.log(`[API] Clearing document cache to force refresh`);
    documentService.clearDocumentCache(meetingId);
    
    // Get all documents and their content (this will populate the cache)
    const documents = await documentService.getDocumentsForEvent(event, tokens);
    console.log(`[API] Found ${documents ? documents.length : 0} documents for meeting ${meetingId}`);
    
    if (documents && documents.length > 0) {
      console.log(`[API] Pre-fetching content for all ${documents.length} documents`);
      await Promise.all(documents.map(doc => 
        documentService.getDocumentContent(doc.id, tokens)
          .then(content => console.log(`[API] Successfully pre-fetched content for document ${doc.id}`))
          .catch(err => console.error(`[API] Error pre-fetching content for document ${doc.id}:`, err))
      ));
    }
    
    // Now that we've pre-fetched all documents, generate the analysis
    console.log(`[API] All documents fetched, generating analysis`);
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
 * @route   GET /api/preparation/:meetingId/status
 * @desc    Check if preparation materials exist for a meeting
 * @access  Private
 */
router.get('/:meetingId/status', ensureAuth, (req, res) => {
  try {
    const meetingId = req.params.meetingId;
    console.log(`[API] GET /api/preparation/${meetingId}/status - Checking if materials exist`);
    
    // Check if preparation materials exist in cache
    const exists = meetingPrepService.checkPrepExists(meetingId);
    
    console.log(`[API] Materials exist for meeting ${meetingId}: ${exists}`);
    res.json({ exists });
  } catch (error) {
    console.error('Error checking preparation status:', error);
    res.status(500).json({ error: 'Failed to check preparation status' });
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
