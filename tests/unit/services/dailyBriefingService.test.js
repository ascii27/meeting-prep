const { v4: uuidv4 } = require('uuid');

// Mock all dependencies FIRST
jest.mock('../../../repositories/dailyBriefingRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findByUserIdAndDate: jest.fn(),
    createBriefing: jest.fn(),
    updateStatus: jest.fn(),
    updateContent: jest.fn(),
    findByUserIdAndDateRange: jest.fn(),
    deleteBriefing: jest.fn(),
    findByStatus: jest.fn()
  }));
});
jest.mock('../../../services/calendarService', () => ({
  getEventsByDate: jest.fn()
}));
jest.mock('../../../services/documentService', () => ({
  getDocumentsForEvent: jest.fn(),
  getDocumentContent: jest.fn(),
  fetchDocumentsForMeeting: jest.fn() // Keep for backward compatibility
}));
jest.mock('../../../services/openaiService', () => ({
  generateMeetingSummary: jest.fn(),
  generateDailyBriefing: jest.fn()
}));
jest.mock('../../../models', () => ({
  MeetingSummary: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));
jest.mock('marked', () => ({
  marked: Object.assign(
    jest.fn((text) => `<p>${text}</p>`),
    {
      setOptions: jest.fn()
    }
  )
}));
jest.mock('../../../utils/dateUtils', () => ({
  formatDate: jest.fn((date) => date),
  isToday: jest.fn(() => false)
}));
jest.mock('../../../repositories/meetingRepository', () => ({
  findByGoogleEventId: jest.fn(),
  create: jest.fn(),
  createOrUpdateFromGoogleEvent: jest.fn(),
  findByUserId: jest.fn()
}));

// Import after mocking
const dailyBriefingService = require('../../../services/dailyBriefingService');
const DailyBriefingRepository = require('../../../repositories/dailyBriefingRepository');
const meetingRepository = require('../../../repositories/meetingRepository');
const calendarService = require('../../../services/calendarService');
const documentService = require('../../../services/documentService');
const openaiService = require('../../../services/openaiService');
const { MeetingSummary } = require('../../../models');

describe('DailyBriefingService', () => {
  let mockRepository;
  let mockProgressCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked repository instance from the singleton service
    mockRepository = dailyBriefingService.repository;
    
    // Setup mock progress callback
    mockProgressCallback = jest.fn();
    
    // Setup meetingRepository mocks
    meetingRepository.findByGoogleEventId.mockResolvedValue(null);
    meetingRepository.create.mockResolvedValue({ id: 'mock-meeting-id' });
    meetingRepository.createOrUpdateFromGoogleEvent.mockResolvedValue({ id: 'mock-meeting-id', userId: 'test-user-id' });
  });

  describe('generateDailyBriefing', () => {
    const userId = uuidv4();
    const briefingDate = '2025-07-29';
    const userTokens = { access_token: 'mock-token' };

    test('should return existing completed briefing if found', async () => {
      const existingBriefing = {
        id: uuidv4(),
        userId,
        briefingDate,
        status: 'completed',
        summaryText: 'Existing briefing'
      };

      mockRepository.findByUserIdAndDate.mockResolvedValue(existingBriefing);

      const result = await dailyBriefingService.generateDailyBriefing(
        userId, 
        briefingDate, 
        userTokens, 
        mockProgressCallback
      );

      expect(result).toEqual(existingBriefing);
      expect(mockRepository.findByUserIdAndDate).toHaveBeenCalledWith(userId, briefingDate);
      expect(calendarService.getEventsByDate).not.toHaveBeenCalled();
    });

    test('should return null when no meetings found for the date', async () => {
      mockRepository.findByUserIdAndDate.mockResolvedValue(null);
      calendarService.getEventsByDate.mockResolvedValue([]);

      const result = await dailyBriefingService.generateDailyBriefing(
        userId, 
        briefingDate, 
        userTokens, 
        mockProgressCallback
      );

      expect(result).toBeNull();
      expect(calendarService.getEventsByDate).toHaveBeenCalledWith(userId, briefingDate, userTokens);
      expect(mockProgressCallback).toHaveBeenCalledWith({ step: 'fetching_meetings', progress: 10 });
    });

    test('should generate new briefing when meetings are found', async () => {
      const meetings = [
        {
          id: 'meeting-1',
          summary: 'Team Meeting',
          start: { dateTime: '2025-07-29T10:00:00Z' },
          end: { dateTime: '2025-07-29T11:00:00Z' },
          attendees: [{ email: 'user@example.com', displayName: 'User' }]
        }
      ];

      const briefingId = uuidv4();
      const createdBriefing = {
        id: briefingId,
        userId,
        briefingDate,
        status: 'processing'
      };

      const completedBriefing = {
        ...createdBriefing,
        status: 'completed',
        summaryText: 'Generated briefing',
        summaryHtml: '<p>Generated briefing</p>'
      };

      mockRepository.findByUserIdAndDate.mockResolvedValue(null);
      calendarService.getEventsByDate.mockResolvedValue(meetings);
      mockRepository.createBriefing.mockResolvedValue(createdBriefing);
      mockRepository.updateContent.mockResolvedValue(completedBriefing);

      // Mock document and AI services
      documentService.fetchDocumentsForMeeting.mockResolvedValue([
        { title: 'Doc 1', content: 'Document content' }
      ]);
      
      openaiService.generateMeetingSummary.mockResolvedValue({
        summary: 'Meeting summary',
        keyTopics: ['topic1', 'topic2'],
        preparationSuggestions: ['suggestion1']
      });

      openaiService.generateDailyBriefing.mockResolvedValue({
        summary: 'Daily briefing summary'
      });

      MeetingSummary.findOne.mockResolvedValue(null);
      MeetingSummary.create.mockResolvedValue({
        id: uuidv4(),
        summaryText: 'Meeting summary'
      });

      const result = await dailyBriefingService.generateDailyBriefing(
        userId, 
        briefingDate, 
        userTokens, 
        mockProgressCallback
      );

      expect(result).toEqual(completedBriefing);
      expect(mockRepository.createBriefing).toHaveBeenCalledWith({
        userId,
        briefingDate,
        meetingCount: 1,
        status: 'processing'
      });
      expect(mockProgressCallback).toHaveBeenCalledWith({ step: 'completed', progress: 100 });
    });

    test('should update existing briefing status to processing', async () => {
      const existingBriefing = {
        id: uuidv4(),
        userId,
        briefingDate,
        status: 'pending'
      };

      const meetings = [
        {
          id: 'meeting-1',
          summary: 'Team Meeting',
          attendees: []
        }
      ];

      const updatedBriefing = { ...existingBriefing, status: 'processing' };
      const completedBriefing = { ...updatedBriefing, status: 'completed' };

      mockRepository.findByUserIdAndDate.mockResolvedValue(existingBriefing);
      calendarService.getEventsByDate.mockResolvedValue(meetings);
      mockRepository.updateStatus.mockResolvedValue(updatedBriefing);
      mockRepository.updateContent.mockResolvedValue(completedBriefing);

      // Mock no documents found
      documentService.fetchDocumentsForMeeting.mockResolvedValue([]);
      
      openaiService.generateDailyBriefing.mockResolvedValue({
        summary: 'Daily briefing summary'
      });

      const result = await dailyBriefingService.generateDailyBriefing(
        userId, 
        briefingDate, 
        userTokens
      );

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(existingBriefing.id, 'processing');
      expect(result).toEqual(completedBriefing);
    });

    test('should handle errors and update briefing status to failed', async () => {
      const briefingId = uuidv4();
      const createdBriefing = {
        id: briefingId,
        userId,
        briefingDate,
        status: 'processing'
      };

      mockRepository.findByUserIdAndDate.mockResolvedValue(null);
      calendarService.getEventsByDate.mockResolvedValue([{ id: 'meeting-1', summary: 'Meeting' }]);
      mockRepository.createBriefing.mockResolvedValue(createdBriefing);
      
      // Mock error in comprehensive briefing generation (not individual meeting processing)
      openaiService.generateDailyBriefing.mockRejectedValue(new Error('AI service failed'));
      documentService.fetchDocumentsForMeeting.mockResolvedValue([]);

      await expect(dailyBriefingService.generateDailyBriefing(
        userId, 
        briefingDate, 
        userTokens
      )).rejects.toThrow('Failed to generate daily briefing');

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(briefingId, 'failed');
    });
  });

  describe('processMeeting', () => {
    const userId = uuidv4();
    const userTokens = { access_token: 'mock-token', refresh_token: 'mock-refresh' };
    const meeting = {
      id: 'meeting-1',
      summary: 'Team Meeting',
      attendees: [{ email: 'user@example.com', displayName: 'User' }]
    };

    test('should return existing summary if found', async () => {
      const meetingRecord = {
        id: 'mock-meeting-id',
        userId: userId,
        googleEventId: meeting.id
      };
      
      const existingSummary = {
        meetingId: meetingRecord.id,
        summaryText: 'Existing summary',
        keyTopics: JSON.stringify(['topic1', 'topic2'])
      };

      meetingRepository.findByGoogleEventId.mockResolvedValue(meetingRecord);
      MeetingSummary.findOne.mockResolvedValue(existingSummary);

      const result = await dailyBriefingService.processMeeting(meeting, userId, userTokens);

      expect(result).toEqual({
        meetingId: meetingRecord.id,
        meetingTitle: meeting.summary,
        summary: existingSummary.summaryText,
        keyTopics: ['topic1', 'topic2'],
        attendees: meeting.attendees
      });
      expect(MeetingSummary.findOne).toHaveBeenCalledWith({
        where: { meetingId: meetingRecord.id }
      });
    });

    test('should return null when no documents found', async () => {
      const meetingRecord = {
        id: 'mock-meeting-id',
        userId: userId,
        googleEventId: meeting.id
      };
      
      meetingRepository.findByGoogleEventId.mockResolvedValue(meetingRecord);
      MeetingSummary.findOne.mockResolvedValue(null);
      documentService.getDocumentsForEvent.mockResolvedValue([]);

      const result = await dailyBriefingService.processMeeting(meeting, userId, userTokens);

      expect(result).toBeNull();
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(meeting, userTokens);
    });

    test('should generate and store new summary when documents found', async () => {
      const meetingRecord = {
        id: 'mock-meeting-id',
        userId: userId,
        googleEventId: meeting.id
      };
      
      const documents = [
        { id: 'doc-1', title: 'Doc 1' }
      ];

      const documentContent = {
        content: 'Document content'
      };

      const aiAnalysis = {
        summary: 'AI generated summary',
        keyTopics: ['topic1', 'topic2'],
        preparationSuggestions: ['suggestion1']
      };

      const createdSummary = {
        id: uuidv4(),
        summaryText: aiAnalysis.summary
      };

      meetingRepository.findByGoogleEventId.mockResolvedValue(meetingRecord);
      MeetingSummary.findOne.mockResolvedValue(null);
      documentService.getDocumentsForEvent.mockResolvedValue(documents);
      documentService.getDocumentContent.mockResolvedValue(documentContent);
      openaiService.generateMeetingSummary.mockResolvedValue(aiAnalysis);
      MeetingSummary.create.mockResolvedValue(createdSummary);

      const result = await dailyBriefingService.processMeeting(meeting, userId, userTokens);

      expect(result).toEqual({
        meetingId: meetingRecord.id,
        meetingTitle: meeting.summary,
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics,
        attendees: meeting.attendees,
        preparationSuggestions: aiAnalysis.preparationSuggestions
      });

      expect(openaiService.generateMeetingSummary).toHaveBeenCalledWith(
        meeting.summary,
        [{ title: 'Doc 1', content: 'Document content' }]
      );
      expect(MeetingSummary.create).toHaveBeenCalled();
    });
  });

  describe('getDailyBriefing', () => {
    test('should get existing daily briefing', async () => {
      const userId = uuidv4();
      const briefingDate = '2025-07-29';
      const briefing = {
        id: uuidv4(),
        userId,
        briefingDate,
        status: 'completed'
      };

      mockRepository.findByUserIdAndDate.mockResolvedValue(briefing);

      const result = await dailyBriefingService.getDailyBriefing(userId, briefingDate);

      expect(result).toEqual(briefing);
      expect(mockRepository.findByUserIdAndDate).toHaveBeenCalledWith(userId, briefingDate);
    });

    test('should handle errors gracefully', async () => {
      const userId = uuidv4();
      const briefingDate = '2025-07-29';
      const error = new Error('Database error');

      mockRepository.findByUserIdAndDate.mockRejectedValue(error);

      await expect(dailyBriefingService.getDailyBriefing(userId, briefingDate))
        .rejects.toThrow('Database error');
    });
  });

  describe('getDailyBriefingsInRange', () => {
    test('should get briefings in date range', async () => {
      const userId = uuidv4();
      const startDate = '2025-07-29';
      const endDate = '2025-07-31';
      const briefings = [
        { id: uuidv4(), userId, briefingDate: '2025-07-29' },
        { id: uuidv4(), userId, briefingDate: '2025-07-30' }
      ];

      mockRepository.findByUserIdAndDateRange.mockResolvedValue(briefings);

      const result = await dailyBriefingService.getDailyBriefingsInRange(userId, startDate, endDate);

      expect(result).toEqual(briefings);
      expect(mockRepository.findByUserIdAndDateRange).toHaveBeenCalledWith(userId, startDate, endDate);
    });
  });

  describe('deleteDailyBriefing', () => {
    test('should delete briefing successfully', async () => {
      const userId = uuidv4();
      const date = '2025-07-29';
      const briefing = {
        id: uuidv4(),
        userId,
        briefingDate: date
      };
      
      mockRepository.findByUserIdAndDate.mockResolvedValue(briefing);
      mockRepository.deleteBriefing.mockResolvedValue(true);

      const result = await dailyBriefingService.deleteDailyBriefing(userId, date);

      expect(result).toBe(true);
      expect(mockRepository.findByUserIdAndDate).toHaveBeenCalledWith(userId, date);
      expect(mockRepository.deleteBriefing).toHaveBeenCalledWith(briefing.id);
    });
  });

  describe('getBriefingsByStatus', () => {
    test('should get briefings by status', async () => {
      const status = 'completed';
      const briefings = [
        { id: uuidv4(), status: 'completed' },
        { id: uuidv4(), status: 'completed' }
      ];

      mockRepository.findByStatus.mockResolvedValue(briefings);

      const result = await dailyBriefingService.getBriefingsByStatus(status);

      expect(result).toEqual(briefings);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(status);
    });
  });
});
