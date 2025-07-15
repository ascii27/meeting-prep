const { getWeekEvents, getWeekDateRange } = require('../../../services/calendarService');
const { google } = require('googleapis');

// Mock the Google Calendar API
jest.mock('googleapis', () => {
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn()
        }))
      },
      calendar: jest.fn().mockImplementation(() => ({
        events: {
          list: jest.fn().mockResolvedValue({
            data: {
              items: [
                {
                  id: 'event1',
                  summary: 'Test Meeting 1',
                  start: { dateTime: '2025-07-15T10:00:00Z' },
                  end: { dateTime: '2025-07-15T11:00:00Z' },
                  attendees: [
                    { email: 'test1@example.com', displayName: 'Test User 1' },
                    { email: 'test2@example.com', displayName: 'Test User 2' }
                  ],
                  location: 'Conference Room A',
                  description: 'Test meeting description',
                  htmlLink: 'https://calendar.google.com/event1'
                },
                {
                  id: 'event2',
                  summary: 'All Day Event',
                  start: { date: '2025-07-16' },
                  end: { date: '2025-07-17' }
                }
              ]
            }
          })
        }
      }))
    }
  };
});

// Store the original Date constructor
const RealDate = global.Date;

// Create a fixed date for testing
const mockDate = new RealDate('2025-07-15T12:00:00Z'); // Tuesday

// Mock the Date constructor before tests
beforeAll(() => {
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(mockDate);
      }
      return new RealDate(...args);
    }
    
    static now() {
      return mockDate.getTime();
    }
  };
});

// Restore the original Date after tests
afterAll(() => {
  global.Date = RealDate;
});

describe('Calendar Service', () => {
  describe('getWeekDateRange', () => {
    it('should return date range for current week (offset 0)', () => {
      const dateRange = getWeekDateRange(0);
      
      // Since our mock date is Tuesday, July 15, 2025
      // Monday should be July 14 and Friday should be July 18
      expect(dateRange.startDate.getDate()).toBe(14); // Monday
      expect(dateRange.startDate.getMonth()).toBe(6); // July (0-indexed)
      expect(dateRange.endDate.getDate()).toBe(18); // Friday
      expect(dateRange.endDate.getMonth()).toBe(6); // July (0-indexed)
    });
    
    it('should return date range for next week (offset 1)', () => {
      const dateRange = getWeekDateRange(1);
      
      // Next week should be July 21-25
      expect(dateRange.startDate.getDate()).toBe(21); // Monday
      expect(dateRange.startDate.getMonth()).toBe(6); // July (0-indexed)
      expect(dateRange.endDate.getDate()).toBe(25); // Friday
      expect(dateRange.endDate.getMonth()).toBe(6); // July (0-indexed)
    });
    
    it('should return date range for previous week (offset -1)', () => {
      const dateRange = getWeekDateRange(-1);
      
      // Previous week should be July 7-11
      expect(dateRange.startDate.getDate()).toBe(7); // Monday
      expect(dateRange.startDate.getMonth()).toBe(6); // July (0-indexed)
      expect(dateRange.endDate.getDate()).toBe(11); // Friday
      expect(dateRange.endDate.getMonth()).toBe(6); // July (0-indexed)
    });
  });
  
  describe('getWeekEvents', () => {
    it('should fetch and process events correctly', async () => {
      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      };
      
      const events = await getWeekEvents(mockTokens, 0);
      
      // Check that we got the expected events
      expect(events).toHaveLength(2);
      
      // Check first event (regular meeting)
      expect(events[0].id).toBe('event1');
      expect(events[0].title).toBe('Test Meeting 1');
      expect(events[0].location).toBe('Conference Room A');
      expect(events[0].attendees).toHaveLength(2);
      expect(events[0].description).toBe('Test meeting description');
      expect(events[0].htmlLink).toBe('https://calendar.google.com/event1');
      
      // Check second event (all-day event)
      expect(events[1].id).toBe('event2');
      expect(events[1].title).toBe('All Day Event');
      // Check if it has a date format instead of dateTime format
      expect(events[1].start).toBe('2025-07-16');
      expect(events[1].end).toBe('2025-07-17');
    });
    
    it('should handle errors gracefully', async () => {
      // Create a new mock implementation that throws an error
      const originalCalendarMock = google.calendar;
      google.calendar = jest.fn().mockImplementation(() => ({
        events: {
          list: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      }));
      
      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      };
      
      await expect(getWeekEvents(mockTokens, 0)).rejects.toThrow('API Error');
      
      // Restore the original mock
      google.calendar = originalCalendarMock;
    });
  });
});
