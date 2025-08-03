const request = require('supertest');
const express = require('express');
const historyRoutes = require('../../../routes/history');

// Mock the auth middleware
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: jest.fn((req, res, next) => {
    req.user = {
      id: 'test-user-id',
      googleId: 'google-123'
    };
    next();
  })
}));

// Mock the repositories
jest.mock('../../../repositories', () => ({
  meetingRepository: {
    findByUserId: jest.fn(),
    findOne: jest.fn()
  },
  meetingSummaryRepository: {
    findLatestByMeetingId: jest.fn()
  }
}));

// Mock the data storage service
jest.mock('../../../services/dataStorageService', () => ({
  getPreparationNotes: jest.fn()
}));

const { ensureAuth } = require('../../../middleware/auth');
const { meetingRepository, meetingSummaryRepository } = require('../../../repositories');
const dataStorageService = require('../../../services/dataStorageService');

describe('History Routes', () => {
  let app;
  let mockUser;
  let mockMeetings;
  let mockMeeting;
  let mockSummary;
  let mockNotes;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/history', historyRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock data
    mockUser = {
      id: 'test-user-id',
      googleId: 'google-123'
    };
    
    mockMeetings = [
      {
        id: 'meeting-1',
        googleEventId: 'event-1',
        title: 'Team Standup',
        startTime: new Date('2025-07-15T09:00:00Z'),
        endTime: new Date('2025-07-15T09:30:00Z'),
        location: 'Conference Room A',
        hasSummary: true,
        attendees: ['user1@example.com', 'user2@example.com'],
        attachments: ['doc1', 'doc2']
      },
      {
        id: 'meeting-2',
        googleEventId: 'event-2',
        title: 'Project Review',
        startTime: new Date('2025-07-14T14:00:00Z'),
        endTime: new Date('2025-07-14T15:00:00Z'),
        location: null,
        hasSummary: false,
        attendees: ['user1@example.com'],
        attachments: []
      }
    ];
    
    mockMeeting = {
      id: 'meeting-1',
      googleEventId: 'event-1',
      title: 'Team Standup',
      description: 'Daily team standup meeting',
      startTime: new Date('2025-07-15T09:00:00Z'),
      endTime: new Date('2025-07-15T09:30:00Z'),
      location: 'Conference Room A',
      userId: 'google-123',
      attendees: ['user1@example.com', 'user2@example.com'],
      attachments: ['doc1', 'doc2']
    };
    
    mockSummary = {
      id: 'summary-1',
      summaryText: 'Meeting summary text',
      summaryHtml: '<p>Meeting summary HTML</p>',
      generatedAt: new Date('2025-07-15T09:35:00Z'),
      documentIds: ['doc1', 'doc2']
    };
    
    mockNotes = [
      {
        id: 'note-1',
        noteText: 'Important note about the meeting',
        createdAt: new Date('2025-07-15T08:30:00Z'),
        isPrivate: false
      },
      {
        id: 'note-2',
        noteText: 'Private preparation note',
        createdAt: new Date('2025-07-15T08:45:00Z'),
        isPrivate: true
      }
    ];
    
    // Set up default mock implementations
    ensureAuth.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /api/history', () => {
    it('should get user meeting history', async () => {
      meetingRepository.findByUserId.mockResolvedValue(mockMeetings);
      
      const response = await request(app)
        .get('/api/history');
      
      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(2);
      
      const firstMeeting = response.body.history[0];
      expect(firstMeeting).toEqual({
        id: 'meeting-1',
        googleEventId: 'event-1',
        title: 'Team Standup',
        startTime: '2025-07-15T09:00:00.000Z',
        endTime: '2025-07-15T09:30:00.000Z',
        location: 'Conference Room A',
        hasSummary: true,
        attendees: 2,
        attachments: 2
      });
      
      expect(meetingRepository.findByUserId).toHaveBeenCalledWith('google-123', {
        order: [['startTime', 'DESC']],
        limit: 50
      });
      expect(ensureAuth).toHaveBeenCalled();
    });

    it('should handle empty meeting history', async () => {
      meetingRepository.findByUserId.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/history');
      
      expect(response.status).toBe(200);
      expect(response.body.history).toEqual([]);
    });

    it('should handle meetings with null attendees and attachments', async () => {
      const meetingWithNulls = {
        ...mockMeetings[0],
        attendees: null,
        attachments: null
      };
      
      meetingRepository.findByUserId.mockResolvedValue([meetingWithNulls]);
      
      const response = await request(app)
        .get('/api/history');
      
      expect(response.status).toBe(200);
      expect(response.body.history[0].attendees).toBe(0);
      expect(response.body.history[0].attachments).toBe(0);
    });

    it('should handle repository errors', async () => {
      meetingRepository.findByUserId.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/history');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting history');
    });

    it('should limit results to 50 meetings', async () => {
      await request(app).get('/api/history');
      
      expect(meetingRepository.findByUserId).toHaveBeenCalledWith('google-123', {
        order: [['startTime', 'DESC']],
        limit: 50
      });
    });
  });

  describe('GET /api/history/:meetingId', () => {
    it('should get specific meeting details', async () => {
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingSummaryRepository.findLatestByMeetingId.mockResolvedValue(mockSummary);
      dataStorageService.getPreparationNotes.mockResolvedValue(mockNotes);
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(200);
      
      const meetingDetails = response.body;
      expect(meetingDetails.id).toBe('meeting-1');
      expect(meetingDetails.title).toBe('Team Standup');
      expect(meetingDetails.summary).toEqual({
        id: 'summary-1',
        text: 'Meeting summary text',
        html: '<p>Meeting summary HTML</p>',
        generatedAt: '2025-07-15T09:35:00.000Z',
        documentIds: ['doc1', 'doc2']
      });
      expect(meetingDetails.notes).toHaveLength(2);
      expect(meetingDetails.notes[0]).toEqual({
        id: 'note-1',
        text: 'Important note about the meeting',
        createdAt: '2025-07-15T08:30:00.000Z',
        isPrivate: false
      });
      
      expect(meetingRepository.findOne).toHaveBeenCalledWith({ id: 'meeting-1' });
      expect(meetingSummaryRepository.findLatestByMeetingId).toHaveBeenCalledWith('meeting-1');
      expect(dataStorageService.getPreparationNotes).toHaveBeenCalledWith('event-1', 'google-123');
    });

    it('should return 404 if meeting not found', async () => {
      meetingRepository.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .get('/api/history/nonexistent-meeting');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Meeting not found');
    });

    it('should return 403 if user does not have access to meeting', async () => {
      const unauthorizedMeeting = {
        ...mockMeeting,
        userId: 'different-user-id'
      };
      
      meetingRepository.findOne.mockResolvedValue(unauthorizedMeeting);
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should handle meeting without summary', async () => {
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingSummaryRepository.findLatestByMeetingId.mockResolvedValue(null);
      dataStorageService.getPreparationNotes.mockResolvedValue(mockNotes);
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(200);
      expect(response.body.summary).toBeNull();
    });

    it('should handle meeting with null attendees and attachments', async () => {
      const meetingWithNulls = {
        ...mockMeeting,
        attendees: null,
        attachments: null
      };
      
      meetingRepository.findOne.mockResolvedValue(meetingWithNulls);
      meetingSummaryRepository.findLatestByMeetingId.mockResolvedValue(null);
      dataStorageService.getPreparationNotes.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(200);
      expect(response.body.attendees).toEqual([]);
      expect(response.body.attachments).toEqual([]);
    });

    it('should handle empty notes', async () => {
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingSummaryRepository.findLatestByMeetingId.mockResolvedValue(null);
      dataStorageService.getPreparationNotes.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(200);
      expect(response.body.notes).toEqual([]);
    });

    it('should handle repository errors', async () => {
      meetingRepository.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting details');
    });

    it('should handle summary repository errors', async () => {
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingSummaryRepository.findLatestByMeetingId.mockRejectedValue(new Error('Summary error'));
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting details');
    });

    it('should handle notes service errors', async () => {
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingSummaryRepository.findLatestByMeetingId.mockResolvedValue(null);
      dataStorageService.getPreparationNotes.mockRejectedValue(new Error('Notes error'));
      
      const response = await request(app)
        .get('/api/history/meeting-1');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting details');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all routes', async () => {
      expect(ensureAuth).toBeDefined();
    });

    it('should handle authentication failures', async () => {
      ensureAuth.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });
      
      const response = await request(app)
        .get('/api/history');
      
      expect(response.status).toBe(401);
    });
  });
});
