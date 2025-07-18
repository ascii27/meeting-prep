const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');
const { getWeekEvents } = require('../services/calendarService');
const { getWeekDays, groupEventsByDay, formatDateRange, getWeekDateRangeText } = require('../utils/dateUtils');

// @desc    Dashboard
// @route   GET /dashboard
router.get('/', ensureAuth, async (req, res) => {
  try {
    // Get week offset from query params (default to 0 for current week)
    const weekOffset = parseInt(req.query.weekOffset || '0');
    
    // Get the days for the specified week (Monday-Friday)
    const weekDays = getWeekDays(weekOffset);
    
    // Get formatted date range for display
    const weekDateRange = getWeekDateRangeText(weekOffset);
    
    // Initialize meetings array for each day
    weekDays.forEach(day => {
      day.meetings = [];
    });
    
    // Get calendar events for the specified week
    const events = await getWeekEvents(
      {
        accessToken: req.user.accessToken,
        refreshToken: req.user.refreshToken
      },
      weekOffset
    );
    
    // Store raw events in session for document API access
    req.session.events = events;
    
    // Group events by day
    const groupedEvents = groupEventsByDay(events);
    
    // Assign events to the appropriate days
    weekDays.forEach(day => {
      if (groupedEvents[day.isoString]) {
        // Transform events to the format expected by the view
        day.meetings = groupedEvents[day.isoString].events.map(event => ({
          id: event.id,
          title: event.title,
          startTime: new Date(event.start),
          endTime: new Date(event.end),
          timeRange: formatDateRange(event.start, event.end),
          location: event.location,
          attendees: event.attendees.map(a => a.name || a.email),
          status: event.preparationStatus,
          htmlLink: event.htmlLink,
          description: event.description
        }));
      }
    });
    
    res.render('dashboard', {
      name: req.user.displayName,
      email: req.user.email,
      profileImage: req.user.profilePicture,
      weekDays,
      weekDateRange,
      weekOffset
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.render('error', {
      message: 'Failed to fetch calendar events',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router;
