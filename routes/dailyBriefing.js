const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const dailyBriefingService = require('../services/dailyBriefingService');
const { formatDate } = require('../utils/dateUtils');

/**
 * Generate a daily briefing for a specific date
 * POST /api/daily-briefing/generate
 */
router.post('/generate', ensureAuth, async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.user.googleId;
    const userTokens = {
      accessToken: req.user.accessToken,
      refreshToken: req.user.refreshToken
    };

    console.log('Daily Briefing Generate Request:', {
      date,
      userId: userId ? 'present' : 'missing',
      userTokens: userTokens ? 'present' : 'missing',
      sessionId: req.sessionID,
      userGoogleId: req.user.googleId
    });

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Set up Server-Sent Events for progress updates
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const progressCallback = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    try {
      const briefing = await dailyBriefingService.generateDailyBriefing(
        userId,
        date,
        userTokens,
        progressCallback
      );

      // Send final result
      res.write(`data: ${JSON.stringify({ 
        step: 'completed', 
        progress: 100, 
        briefing 
      })}\n\n`);
      res.end();

    } catch (error) {
      console.error('Error generating daily briefing:', error);
      res.write(`data: ${JSON.stringify({ 
        step: 'error', 
        error: error.message 
      })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error('Error in daily briefing generation endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get existing daily briefing for a specific date
 * GET /api/daily-briefing/:date
 */
router.get('/:date', ensureAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.googleId;

    console.log('Daily Briefing Get Request:', {
      date,
      userId: userId ? 'present' : 'missing',
      sessionId: req.sessionID,
      userGoogleId: req.user.googleId
    });

    const briefing = await dailyBriefingService.getDailyBriefing(userId, date);
    
    if (!briefing) {
      return res.status(404).json({ error: 'Daily briefing not found' });
    }

    res.json({ briefing });

  } catch (error) {
    console.error('Error getting daily briefing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get daily briefings within a date range
 * GET /api/daily-briefing/range/:startDate/:endDate
 */
router.get('/range/:startDate/:endDate', ensureAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.user.googleId;

    const briefings = await dailyBriefingService.getDailyBriefingsInRange(
      userId, 
      startDate, 
      endDate
    );

    res.json({ briefings });

  } catch (error) {
    console.error('Error getting daily briefings in range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a daily briefing
 * DELETE /api/daily-briefing/:date
 */
router.delete('/:date', ensureAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.user.googleId;

    const success = await dailyBriefingService.deleteDailyBriefing(userId, date);
    
    if (!success) {
      return res.status(404).json({ error: 'Daily briefing not found' });
    }

    res.json({ message: 'Daily briefing deleted successfully' });

  } catch (error) {
    console.error('Error deleting daily briefing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get briefings by status
 * GET /api/daily-briefing/status/:status
 */
router.get('/status/:status', ensureAuth, async (req, res) => {
  try {
    const { status } = req.params;
    const userId = req.user.googleId;

    const briefings = await dailyBriefingService.getBriefingsByStatus(userId, status);
    res.json({ briefings });

  } catch (error) {
    console.error('Error getting briefings by status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
