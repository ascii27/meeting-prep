/**
 * Calendar Service
 * Handles interactions with the Google Calendar API
 */
const { google } = require('googleapis');

/**
 * Creates a Google Calendar API client using the provided OAuth2 tokens
 * @param {Object} tokens - OAuth2 tokens from passport authentication
 * @returns {Object} - Google Calendar API client
 */
function createCalendarClient(tokens) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/auth/google/callback'
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  });
  
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Gets the date range for a week (Monday-Friday) with optional offset
 * @param {number} weekOffset - Number of weeks to offset from current week (negative for past, positive for future)
 * @returns {Object} - Object containing timeMin and timeMax for the specified week
 */
function getWeekDateRange(weekOffset = 0) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to Monday (start of week)
  const daysToMonday = currentDay === 0 ? 1 : currentDay === 1 ? 0 : -(currentDay - 1);
  
  // Calculate start date (Monday)
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + daysToMonday + (weekOffset * 7));
  startDate.setHours(0, 0, 0, 0);
  
  // Calculate end date (Friday)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 4); // Monday + 4 days = Friday
  endDate.setHours(23, 59, 59, 999);
  
  return {
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    startDate,
    endDate
  };
}

/**
 * Fetches calendar events for a specific week (Monday-Friday)
 * @param {Object} tokens - OAuth2 tokens from passport authentication
 * @param {number} weekOffset - Number of weeks to offset from current week
 * @returns {Promise<Array>} - Promise resolving to an array of calendar events
 */
async function getWeekEvents(tokens, weekOffset = 0) {
  try {
    const calendar = createCalendarClient(tokens);
    const dateRange = getWeekDateRange(weekOffset);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: dateRange.timeMin,
      timeMax: dateRange.timeMax,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    return processEvents(response.data.items);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Processes raw calendar events into a more usable format
 * @param {Array} events - Raw calendar events from Google Calendar API
 * @returns {Array} - Processed calendar events
 */
function processEvents(events) {
  if (!events || events.length === 0) {
    return [];
  }
  
  return events.map(event => {
    // Extract start and end times
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    // Extract attendees (if any)
    const attendees = event.attendees 
      ? event.attendees
          .filter(attendee => !attendee.self) // Filter out the user
          .map(attendee => ({
            email: attendee.email,
            name: attendee.displayName || attendee.email.split('@')[0],
            responseStatus: attendee.responseStatus
          }))
      : [];
    
    // Create a processed event object
    return {
      id: event.id,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      location: event.location || '',
      start,
      end,
      attendees,
      hangoutLink: event.hangoutLink || '',
      htmlLink: event.htmlLink || '',
      attachments: event.attachments || [],
      preparationStatus: 'not-started' // Default status, will be updated later
    };
  });
}

module.exports = {
  getWeekEvents,
  getWeekDateRange
};
