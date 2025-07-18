/**
 * Meeting History Routes
 * Handles API routes for accessing meeting history
 */
const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const { meetingRepository, meetingSummaryRepository } = require('../repositories');
const dataStorageService = require('../services/dataStorageService');

/**
 * @route   GET /api/history
 * @desc    Get user's meeting history
 * @access  Private
 */
router.get('/', ensureAuth, async (req, res) => {
  try {
    console.log(`[API] GET /api/history - Fetching meeting history for user ${req.user.googleId}`);
    
    // Get meetings from the database
    const meetings = await meetingRepository.findByUserId(req.user.googleId, {
      order: [['startTime', 'DESC']],
      limit: 50 // Limit to most recent 50 meetings
    });
    
    console.log(`[API] Found ${meetings.length} meetings in history for user ${req.user.googleId}`);
    
    // Format the response
    const history = meetings.map(meeting => ({
      id: meeting.id,
      googleEventId: meeting.googleEventId,
      title: meeting.title,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      hasSummary: meeting.hasSummary,
      attendees: meeting.attendees?.length || 0,
      attachments: meeting.attachments?.length || 0
    }));
    
    res.json({ history });
  } catch (error) {
    console.error('Error getting meeting history:', error);
    res.status(500).json({ error: 'Failed to get meeting history' });
  }
});

/**
 * @route   GET /api/history/:meetingId
 * @desc    Get details for a specific meeting
 * @access  Private
 */
router.get('/:meetingId', ensureAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    console.log(`[API] GET /api/history/${meetingId} - Fetching meeting details`);
    
    // Get meeting from the database
    const meeting = await meetingRepository.findOne({ id: meetingId });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check if user has access to this meeting
    if (meeting.userId !== req.user.googleId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get the latest summary for this meeting
    const summary = await meetingSummaryRepository.findLatestByMeetingId(meetingId);
    
    // Get notes for this meeting
    const notes = await dataStorageService.getPreparationNotes(meeting.googleEventId, req.user.googleId);
    
    // Format the response
    const meetingDetails = {
      id: meeting.id,
      googleEventId: meeting.googleEventId,
      title: meeting.title,
      description: meeting.description,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      attendees: meeting.attendees || [],
      attachments: meeting.attachments || [],
      summary: summary ? {
        id: summary.id,
        text: summary.summaryText,
        html: summary.summaryHtml,
        generatedAt: summary.generatedAt,
        documentIds: summary.documentIds || []
      } : null,
      notes: notes.map(note => ({
        id: note.id,
        text: note.noteText,
        createdAt: note.createdAt,
        isPrivate: note.isPrivate
      }))
    };
    
    res.json(meetingDetails);
  } catch (error) {
    console.error('Error getting meeting details:', error);
    res.status(500).json({ error: 'Failed to get meeting details' });
  }
});

module.exports = router;
