/**
 * Cataloging Worker Tests
 */
const catalogingWorker = require('../worker/catalogingWorker');
const calendarProcessingService = require('../calendar/calendarProcessingService');
const graphDatabaseService = require('../graph/graphDatabaseService');

// Mock dependencies
jest.mock('../calendar/calendarProcessingService', () => ({
  getCalendarEvents: jest.fn().mockResolvedValue([
    {
      googleEventId: 'event-1',
      title: 'Test Meeting 1',
      description: 'Test Description 1',
      startTime: '2023-01-01T10:00:00Z',
      endTime: '2023-01-01T11:00:00Z',
      location: 'Test Location 1',
      organizer: {
        email: 'organizer@example.com',
        name: 'Organizer'
      },
      attendees: [
        {
          email: 'attendee1@example.com',
          name: 'Attendee 1',
          responseStatus: 'accepted'
        }
      ]
    },
    {
      googleEventId: 'event-2',
      title: 'Test Meeting 2',
      startTime: '2023-01-02T10:00:00Z',
      endTime: '2023-01-02T11:00:00Z',
      organizer: {
        email: 'organizer@example.com',
        name: 'Organizer'
      },
      attendees: []
    }
  ])
}));

jest.mock('../graph/graphDatabaseService', () => ({
  initialize: jest.fn().mockResolvedValue(null),
  createPerson: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User'
  }),
  createMeeting: jest.fn().mockImplementation(meeting => Promise.resolve({
    id: `meeting-${meeting.googleEventId}`,
    googleEventId: meeting.googleEventId,
    title: meeting.title
  }))
}));

describe('Cataloging Worker', () => {
  const mockUserTokens = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token'
  };
  
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    photoUrl: 'https://example.com/photo.jpg'
  };
  
  let originalConsoleError;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset worker state
    catalogingWorker.isProcessing = false;
    catalogingWorker.processingStatus = {
      inProgress: false,
      startTime: null,
      endTime: null,
      totalEvents: 0,
      processedEvents: 0,
      errors: []
    };
    // Save original console.error
    originalConsoleError = console.error;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });
  
  test('should process calendar data successfully', async () => {
    const result = await catalogingWorker.processCalendarData(mockUserTokens, mockUser, { monthsBack: 1 });
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.processingStatus.totalEvents).toBe(2);
    expect(result.processingStatus.processedEvents).toBe(2);
    expect(result.processingStatus.errors.length).toBe(0);
    
    // Verify dependencies were called correctly
    expect(graphDatabaseService.initialize).toHaveBeenCalledTimes(1);
    expect(graphDatabaseService.createPerson).toHaveBeenCalledWith({
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.displayName,
      photoUrl: mockUser.photoUrl
    });
    expect(calendarProcessingService.getCalendarEvents).toHaveBeenCalledWith(
      mockUserTokens,
      { monthsBack: 1 }
    );
    expect(graphDatabaseService.createMeeting).toHaveBeenCalledTimes(2);
  });
  
  test('should prevent concurrent processing', async () => {
    // Set the worker as already processing
    catalogingWorker.isProcessing = true;
    
    const result = await catalogingWorker.processCalendarData(mockUserTokens, mockUser);
    
    // Verify the result indicates already running
    expect(result.status).toBe('already_running');
    
    // Verify dependencies were not called
    expect(graphDatabaseService.initialize).not.toHaveBeenCalled();
    expect(calendarProcessingService.getCalendarEvents).not.toHaveBeenCalled();
  });
  
  test('should handle errors during processing', async () => {
    // Mock console.error to prevent output during test
    console.error = jest.fn();
    
    // Mock an error in calendar processing
    calendarProcessingService.getCalendarEvents.mockRejectedValueOnce(
      new Error('Calendar API error')
    );
    
    const result = await catalogingWorker.processCalendarData(mockUserTokens, mockUser);
    
    // Verify the result indicates error
    expect(result.status).toBe('error');
    expect(result.message).toContain('Calendar API error');
    expect(result.processingStatus.errors.length).toBe(1);
    
    // Verify the worker is no longer processing
    expect(catalogingWorker.isProcessing).toBe(false);
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should handle errors during meeting creation', async () => {
    // Mock console.error to prevent output during test
    console.error = jest.fn();
    
    // Mock an error for the first meeting creation
    graphDatabaseService.createMeeting.mockImplementationOnce(() => {
      throw new Error('Failed to create meeting');
    });
    
    const result = await catalogingWorker.processCalendarData(mockUserTokens, mockUser);
    
    // Verify the result
    expect(result.status).toBe('completed');
    expect(result.processingStatus.totalEvents).toBe(2);
    expect(result.processingStatus.processedEvents).toBe(1); // Only one succeeded
    expect(result.processingStatus.errors.length).toBe(1);
    
    // Verify the second meeting was still processed
    expect(graphDatabaseService.createMeeting).toHaveBeenCalledTimes(2);
    
    // Verify console.error was called
    expect(console.error).toHaveBeenCalled();
  });
  
  test('should return current processing status', () => {
    // Set a mock processing status
    catalogingWorker.processingStatus = {
      inProgress: true,
      startTime: new Date(),
      totalEvents: 5,
      processedEvents: 2,
      errors: []
    };
    
    const status = catalogingWorker.getProcessingStatus();
    
    // Verify the status is returned correctly
    expect(status).toEqual(catalogingWorker.processingStatus);
    expect(status.inProgress).toBe(true);
    expect(status.totalEvents).toBe(5);
    expect(status.processedEvents).toBe(2);
  });
});
