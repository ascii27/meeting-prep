/**
 * Calendar Processing Service Tests
 */
const calendarProcessingService = require('../calendar/calendarProcessingService');

// Mock googleapis
jest.mock('googleapis', () => {
  const mockListEvents = jest.fn().mockResolvedValue({
    data: {
      items: [
        {
          id: 'event-1',
          summary: 'Test Meeting 1',
          description: 'Test Description 1',
          start: { dateTime: '2023-01-01T10:00:00Z' },
          end: { dateTime: '2023-01-01T11:00:00Z' },
          location: 'Test Location 1',
          organizer: {
            email: 'organizer@example.com',
            displayName: 'Organizer'
          },
          attendees: [
            {
              email: 'attendee1@example.com',
              displayName: 'Attendee 1',
              responseStatus: 'accepted'
            },
            {
              email: 'attendee2@example.com',
              displayName: 'Attendee 2',
              responseStatus: 'tentative'
            }
          ],
          hangoutLink: 'https://meet.google.com/test',
          htmlLink: 'https://calendar.google.com/event?id=test'
        },
        {
          id: 'event-2',
          summary: 'Test Meeting 2',
          start: { dateTime: '2023-01-02T10:00:00Z' },
          end: { dateTime: '2023-01-02T11:00:00Z' },
          organizer: {
            email: 'organizer@example.com'
          },
          attendees: []
        }
      ]
    }
  });

  return {
    google: {
      calendar: jest.fn().mockReturnValue({
        events: {
          list: mockListEvents
        }
      }),
      auth: {
        OAuth2: jest.fn().mockReturnValue({
          setCredentials: jest.fn()
        })
      }
    }
  };
});

describe('Calendar Processing Service', () => {
  const mockUserTokens = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get calendar events with time boundaries', async () => {
    const events = await calendarProcessingService.getCalendarEvents(mockUserTokens, { monthsBack: 1 });
    
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(2);
    
    // Verify the Google Calendar API was called with correct time boundaries
    const { google } = require('googleapis');
    const calendarMock = google.calendar();
    expect(calendarMock.events.list).toHaveBeenCalledTimes(1);
    
    // Verify the first event was processed correctly
    expect(events[0].googleEventId).toBe('event-1');
    expect(events[0].title).toBe('Test Meeting 1');
    expect(events[0].organizer.email).toBe('organizer@example.com');
    expect(events[0].attendees.length).toBe(2);
  });

  test('should process events into standardized format', () => {
    const rawEvents = [
      {
        id: 'test-id',
        summary: 'Test Meeting',
        description: 'Test Description',
        start: { dateTime: '2023-01-01T10:00:00Z' },
        end: { dateTime: '2023-01-01T11:00:00Z' },
        location: 'Test Location',
        organizer: {
          email: 'organizer@example.com',
          displayName: 'Organizer'
        },
        attendees: [
          {
            email: 'attendee@example.com',
            displayName: 'Attendee',
            responseStatus: 'accepted'
          }
        ]
      }
    ];

    const processedEvents = calendarProcessingService.processEvents(rawEvents);
    
    expect(processedEvents).toBeDefined();
    expect(processedEvents.length).toBe(1);
    
    const event = processedEvents[0];
    expect(event.googleEventId).toBe('test-id');
    expect(event.title).toBe('Test Meeting');
    expect(event.description).toBe('Test Description');
    expect(event.startTime).toBe('2023-01-01T10:00:00Z');
    expect(event.endTime).toBe('2023-01-01T11:00:00Z');
    expect(event.location).toBe('Test Location');
    
    expect(event.organizer).toBeDefined();
    expect(event.organizer.email).toBe('organizer@example.com');
    expect(event.organizer.name).toBe('Organizer');
    
    expect(event.attendees).toBeDefined();
    expect(event.attendees.length).toBe(1);
    expect(event.attendees[0].email).toBe('attendee@example.com');
    expect(event.attendees[0].name).toBe('Attendee');
    expect(event.attendees[0].responseStatus).toBe('accepted');
  });

  test('should handle events with missing fields', () => {
    const rawEvents = [
      {
        id: 'test-id',
        start: { date: '2023-01-01' },
        end: { date: '2023-01-01' }
      }
    ];

    const processedEvents = calendarProcessingService.processEvents(rawEvents);
    
    expect(processedEvents).toBeDefined();
    expect(processedEvents.length).toBe(1);
    
    const event = processedEvents[0];
    expect(event.googleEventId).toBe('test-id');
    expect(event.title).toBe('Untitled Event');
    expect(event.description).toBe('');
    expect(event.location).toBe('');
    expect(event.organizer).toBeNull();
    expect(event.attendees).toEqual([]);
  });

  test('should get events for a specific date range', async () => {
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    
    const events = await calendarProcessingService.getEventsForDateRange(
      mockUserTokens,
      startDate,
      endDate
    );
    
    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
    
    // Verify the Google Calendar API was called with correct date range
    const { google } = require('googleapis');
    const calendarMock = google.calendar();
    expect(calendarMock.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString()
      })
    );
  });
});
