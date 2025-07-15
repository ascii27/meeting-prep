/**
 * Document routes
 * Handles API routes for document operations
 */

const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const documentService = require('../services/documentService');

/**
 * @desc    Get documents for a specific event
 * @route   GET /api/documents/events/:eventId/documents
 * @access  Private
 */
router.get('/events/:eventId/documents', ensureAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Get the event from the session or fetch it
    const events = req.session.events || [];
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Get documents for the event
    const documents = await documentService.getDocumentsForEvent(event, req.user);
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error fetching documents for event:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch documents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @desc    Get a specific document by ID
 * @route   GET /api/documents/:documentId
 * @access  Private
 */
router.get('/documents/:documentId', ensureAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Fetch the document
    const document = await documentService.getDocumentById(documentId, req.user);
    
    // Extract and format the document content
    const formattedDocument = documentService.extractDocumentContent(document);
    
    res.json({
      success: true,
      data: formattedDocument
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
