/**
 * Intelligence Service Tests
 */
const intelligenceService = require('../../intelligenceService');
const graphDatabaseService = require('../graph/graphDatabaseService');
const catalogingWorker = require('../worker/catalogingWorker');

// Mock dependencies
jest.mock('../graph/graphDatabaseService', () => ({
  initialize: jest.fn().mockResolvedValue(null),
  getRecentMeetings: jest.fn().mockResolvedValue([
    { id: 'meeting-1', title: 'Meeting 1' },
    { id: 'meeting-2', title: 'Meeting 2' }
  ]),
  getMeetingParticipants: jest.fn().mockResolvedValue([
    { id: 'person-1', email: 'person1@example.com', name: 'Person 1' },
    { id: 'person-2', email: 'person2@example.com', name: 'Person 2' }
  ]),
  getMeetingsForPerson: jest.fn().mockResolvedValue([
    { id: 'meeting-1', title: 'Meeting 1' },
    { id: 'meeting-3', title: 'Meeting 3' }
  ]),
  close: jest.fn().mockResolvedValue(null)
}));

jest.mock('../worker/catalogingWorker', () => ({
  processCalendarData: jest.fn().mockResolvedValue({
    status: 'completed',
    message: 'Processed 2 of 2 events',
    processingStatus: {
      inProgress: false,
      totalEvents: 2,
      processedEvents: 2,
      errors: []
    }
  }),
  getProcessingStatus: jest.fn().mockReturnValue({
    inProgress: false,
    totalEvents: 2,
    processedEvents: 2,
    errors: []
  })
}));

describe('Intelligence Service', () => {
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
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should initialize with default configuration', async () => {
    await intelligenceService.initialize();
    
    expect(graphDatabaseService.initialize).toHaveBeenCalledTimes(1);
    expect(intelligenceService.config.historicalDataLimitMonths).toBe(1);
  });
  
  test('should initialize with custom configuration', async () => {
    await intelligenceService.initialize({ historicalDataLimitMonths: 3 });
    
    expect(graphDatabaseService.initialize).toHaveBeenCalledTimes(1);
    expect(intelligenceService.config.historicalDataLimitMonths).toBe(3);
  });
  
  test('should start calendar processing with configured time limit', async () => {
    intelligenceService.config.historicalDataLimitMonths = 2;
    
    const result = await intelligenceService.startCalendarProcessing(mockUserTokens, mockUser);
    
    expect(catalogingWorker.processCalendarData).toHaveBeenCalledWith(
      mockUserTokens,
      mockUser,
      { monthsBack: 2 }
    );
    
    expect(result.status).toBe('completed');
  });
  
  test('should get processing status', () => {
    const status = intelligenceService.getProcessingStatus();
    
    expect(catalogingWorker.getProcessingStatus).toHaveBeenCalledTimes(1);
    expect(status).toEqual({
      inProgress: false,
      totalEvents: 2,
      processedEvents: 2,
      errors: []
    });
  });
  
  test('should get recent meetings', async () => {
    const meetings = await intelligenceService.getRecentMeetings(5);
    
    expect(graphDatabaseService.getRecentMeetings).toHaveBeenCalledWith(5);
    expect(meetings).toHaveLength(2);
    expect(meetings[0].id).toBe('meeting-1');
  });
  
  test('should get meeting participants', async () => {
    const participants = await intelligenceService.getMeetingParticipants('meeting-1');
    
    expect(graphDatabaseService.getMeetingParticipants).toHaveBeenCalledWith('meeting-1');
    expect(participants).toHaveLength(2);
    expect(participants[0].email).toBe('person1@example.com');
  });
  
  test('should get meetings for a person', async () => {
    const meetings = await intelligenceService.getMeetingsForPerson('test@example.com', 10);
    
    expect(graphDatabaseService.getMeetingsForPerson).toHaveBeenCalledWith('test@example.com', 10);
    expect(meetings).toHaveLength(2);
    expect(meetings[1].id).toBe('meeting-3');
  });
  
  test('should close connections', async () => {
    await intelligenceService.close();
    
    expect(graphDatabaseService.close).toHaveBeenCalledTimes(1);
  });
});
