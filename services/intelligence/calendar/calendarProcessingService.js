/**
 * Calendar Processing Service
 * Handles calendar data retrieval with configurable time boundaries
 */
const { google } = require('googleapis');
const moment = require('moment');

class CalendarProcessingService {
  /**
   * Get calendar events within the configured time boundaries
   * @param {Object} userTokens - User's OAuth tokens
   * @param {Object} options - Processing options
   * @param {number} options.monthsBack - Number of months to look back (default: 1)
   * @param {number} options.batchSize - Number of events to fetch per batch (default: 100)
   * @returns {Promise<Array>} - List of calendar events
   */
  async getCalendarEvents(userTokens, options = {}) {
    const { monthsBack = 1, batchSize = 100 } = options;
    
    // Calculate time boundaries
    const endTime = new Date();
    const startTime = new Date();
    startTime.setMonth(startTime.getMonth() - monthsBack);
    
    console.log(`Fetching calendar events from ${startTime.toISOString()} to ${endTime.toISOString()}`);
    
    // Get the OAuth client from userTokens or create a new one
    let oAuth2Client;
    let calendar;
    
    try {
      if (userTokens.oAuth2Client) {
        // Use the provided OAuth client
        console.log('Using provided OAuth client');
        oAuth2Client = userTokens.oAuth2Client;
      } else if (userTokens.tokens) {
        // Create a new OAuth client with the provided tokens
        console.log('Creating new OAuth client with provided tokens');
        
        // Check if client credentials are included in the tokens
        if (!userTokens.tokens.client_id || !userTokens.tokens.client_secret) {
          console.error('Error: Missing client_id or client_secret in tokens');
          console.error('Tokens object:', JSON.stringify(userTokens.tokens, null, 2));
          throw new Error('Missing client credentials in tokens');
        }
        
        oAuth2Client = new google.auth.OAuth2(
          userTokens.tokens.client_id,
          userTokens.tokens.client_secret,
          'http://127.0.0.1:8085/oauth2callback'
        );
        oAuth2Client.setCredentials(userTokens.tokens);
      } else {
        // Fallback to direct token usage
        console.log('Using tokens directly');
        console.log('Token info:', Object.keys(userTokens).join(', '));
        
        if (!process.env.WORKER_GOOGLE_CLIENT_ID || !process.env.WORKER_GOOGLE_CLIENT_SECRET) {
          console.error('Error: Missing WORKER_GOOGLE_CLIENT_ID or WORKER_GOOGLE_CLIENT_SECRET environment variables');
          throw new Error('Missing OAuth client credentials in environment');
        }
        
        oAuth2Client = new google.auth.OAuth2(
          process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
          'http://127.0.0.1:8085/oauth2callback'
        );
        oAuth2Client.setCredentials(userTokens);
      }
      
      calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    } catch (error) {
      console.error('Error setting up OAuth client:', error);
      throw error;
    }
    
    let allEvents = [];
    let nextPageToken = null;
    
    try {
      do {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          maxResults: batchSize,
          singleEvents: true,
          orderBy: 'startTime',
          pageToken: nextPageToken
        });
        
        const events = response.data.items || [];
        allEvents = [...allEvents, ...events];
        nextPageToken = response.data.nextPageToken;
        
        console.log(`Fetched ${events.length} events, total: ${allEvents.length}`);
      } while (nextPageToken);
      
      return this.processEvents(allEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }
  
  /**
   * Process calendar events into a standardized format
   * @param {Array} events - Raw calendar events
   * @returns {Array} - Processed events
   */
  processEvents(events) {
    return events.map(event => {
      // Extract start and end times
      const startTime = event.start.dateTime || event.start.date;
      const endTime = event.end.dateTime || event.end.date;
      
      // Extract organizer
      const organizer = event.organizer ? {
        email: event.organizer.email,
        name: event.organizer.displayName || event.organizer.email.split('@')[0],
        photoUrl: event.organizer.self ? null : undefined // We don't have photo URLs from calendar API
      } : null;
      
      // Extract attendees
      const attendees = (event.attendees || []).map(attendee => ({
        email: attendee.email,
        name: attendee.displayName || attendee.email.split('@')[0],
        responseStatus: attendee.responseStatus,
        photoUrl: null // We don't have photo URLs from calendar API
      }));
      
      // Return standardized event object
      return {
        googleEventId: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        startTime: startTime,
        endTime: endTime,
        location: event.location || '',
        organizer,
        attendees,
        hangoutLink: event.hangoutLink,
        htmlLink: event.htmlLink
      };
    });
  }
  
  /**
   * Get events for a specific date range
   * @param {Object} userTokens - User's OAuth tokens
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - List of calendar events
   */
  async getEventsForDateRange(userTokens, startDate, endDate) {
    // Get the OAuth client from userTokens or create a new one
    let oAuth2Client;
    let calendar;
    
    try {
      if (userTokens.oAuth2Client) {
        // Use the provided OAuth client
        console.log('Using provided OAuth client for date range query');
        oAuth2Client = userTokens.oAuth2Client;
      } else if (userTokens.tokens) {
        // Create a new OAuth client with the provided tokens
        console.log('Creating new OAuth client with provided tokens for date range query');
        
        // Check if client credentials are included in the tokens
        if (!userTokens.tokens.client_id || !userTokens.tokens.client_secret) {
          console.error('Error: Missing client_id or client_secret in tokens');
          throw new Error('Missing client credentials in tokens');
        }
        
        oAuth2Client = new google.auth.OAuth2(
          userTokens.tokens.client_id,
          userTokens.tokens.client_secret,
          'http://127.0.0.1:8085/oauth2callback'
        );
        oAuth2Client.setCredentials(userTokens.tokens);
      } else {
        // Fallback to direct token usage
        console.log('Using tokens directly for date range query');
        
        if (!process.env.WORKER_GOOGLE_CLIENT_ID || !process.env.WORKER_GOOGLE_CLIENT_SECRET) {
          console.error('Error: Missing WORKER_GOOGLE_CLIENT_ID or WORKER_GOOGLE_CLIENT_SECRET environment variables');
          throw new Error('Missing OAuth client credentials in environment');
        }
        
        oAuth2Client = new google.auth.OAuth2(
          process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
          'http://127.0.0.1:8085/oauth2callback'
        );
        oAuth2Client.setCredentials(userTokens);
      }
      
      calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    } catch (error) {
      console.error('Error setting up OAuth client for date range query:', error);
      throw error;
    }
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const events = response.data.items || [];
      return this.processEvents(events);
    } catch (error) {
      console.error('Error fetching events for date range:', error);
      throw error;
    }
  }
}

module.exports = new CalendarProcessingService();
