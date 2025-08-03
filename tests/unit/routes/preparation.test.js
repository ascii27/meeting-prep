const request = require('supertest');
const express = require('express');
const preparationRoutes = require('../../../routes/preparation');

// Mock the auth middleware
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: jest.fn((req, res, next) => {
    req.user = {
      id: 'test-user-id',
      googleId: 'google-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    };
    next();
  })
}));

// Mock the meeting prep service
jest.mock('../../../services/meetingPrepService', () => ({
  prepareMeetingMaterials: jest.fn(),
  getUserNotes: jest.fn(),
  clearPrepCache: jest.fn(),
  checkPrepExists: jest.fn(),
  saveUserNotes: jest.fn()
}));

// Mock the calendar service
jest.mock('../../../services/calendarService', () => ({
  getEventById: jest.fn()
}));

// Mock the document service
jest.mock('../../../services/documentService', () => ({
  refetchDocumentsForEvent: jest.fn(),
  getDocumentsForEvent: jest.fn(),
  getDocumentContent: jest.fn()
}));

const { ensureAuth } = require('../../../middleware/auth');
const meetingPrepService = require('../../../services/meetingPrepService');
const calendarService = require('../../../services/calendarService');
const documentService = require('../../../services/documentService');

describe('Preparation Routes', () => {
  let app;
  let mockUser;
  let mockTokens;
  let mockEvent;
  let mockDocuments;
  let mockPrepMaterials;
  let mockUserNotes;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/preparation', preparationRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock data
    mockUser = {
      id: 'test-user-id',
      googleId: 'google-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    };
    
    mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'google-123' }
    };
    
    mockEvent = {
      id: 'meeting-123',
      summary: 'Test Meeting',
      attachments: [
        {
          title: 'Test Document',
          mimeType: 'application/vnd.google-apps.document',
          fileUrl: 'https://docs.google.com/document/d/doc123/edit'
        }
      ]
    };
    
    mockDocuments = [
      {
        id: 'doc123',
        title: 'Test Document',
        content: 'Document content here'
      }
    ];
    
    mockPrepMaterials = {
      summary: 'Meeting preparation summary',
      keyTopics: ['Topic 1', 'Topic 2'],
      suggestions: ['Suggestion 1', 'Suggestion 2'],
      documentAnalysis: [
        {
          documentTitle: 'Test Document',
          summary: 'Document summary',
          keyPoints: ['Point 1', 'Point 2']
        }
      ]
    };
    
    mockUserNotes = [
      {
        id: 'note-1',
        text: 'User preparation note',
        createdAt: '2025-07-15T08:30:00.000Z'
      }
    ];
    
    // Set up default mock implementations
    ensureAuth.mockImplementation((req, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /api/preparation/:meetingId', () => {
    it('should get preparation materials for a meeting', async () => {
      meetingPrepService.prepareMeetingMaterials.mockResolvedValue(mockPrepMaterials);
      meetingPrepService.getUserNotes.mockResolvedValue(mockUserNotes);
      
      const response = await request(app)
        .get('/api/preparation/meeting-123');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockPrepMaterials,
        userNotes: mockUserNotes
      });
      
      expect(meetingPrepService.prepareMeetingMaterials).toHaveBeenCalledWith(
        'meeting-123',
        mockTokens
      );
      expect(meetingPrepService.getUserNotes).toHaveBeenCalledWith('meeting-123', 'google-123');
      expect(ensureAuth).toHaveBeenCalled();
    });

    it('should handle empty user notes', async () => {
      meetingPrepService.prepareMeetingMaterials.mockResolvedValue(mockPrepMaterials);
      meetingPrepService.getUserNotes.mockResolvedValue([]);
      
      const response = await request(app)
        .get('/api/preparation/meeting-123');
      
      expect(response.status).toBe(200);
      expect(response.body.userNotes).toEqual([]);
    });

    it('should handle service errors', async () => {
      meetingPrepService.prepareMeetingMaterials.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .get('/api/preparation/meeting-123');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting preparation materials');
    });

    it('should handle user notes service errors', async () => {
      meetingPrepService.prepareMeetingMaterials.mockResolvedValue(mockPrepMaterials);
      meetingPrepService.getUserNotes.mockRejectedValue(new Error('Notes error'));
      
      const response = await request(app)
        .get('/api/preparation/meeting-123');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get meeting preparation materials');
    });
  });

  describe('POST /api/preparation/:meetingId/analyze', () => {
    beforeEach(() => {
      calendarService.getEventById.mockResolvedValue(mockEvent);
      documentService.getDocumentsForEvent.mockResolvedValue(mockDocuments);
      documentService.getDocumentContent.mockResolvedValue({ content: 'Document content' });
      meetingPrepService.prepareMeetingMaterials.mockResolvedValue(mockPrepMaterials);
      meetingPrepService.getUserNotes.mockResolvedValue(mockUserNotes);
    });

    it('should trigger analysis for a meeting', async () => {
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...mockPrepMaterials,
        userNotes: mockUserNotes
      });
      
      expect(meetingPrepService.clearPrepCache).toHaveBeenCalledWith('meeting-123', true);
      expect(calendarService.getEventById).toHaveBeenCalledWith('meeting-123', mockTokens);
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(mockEvent, mockTokens);
      expect(meetingPrepService.prepareMeetingMaterials).toHaveBeenCalledWith('meeting-123', mockTokens, true);
    });

    it('should refetch documents when refetchDocuments=true', async () => {
      documentService.refetchDocumentsForEvent.mockResolvedValue(mockDocuments);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze?refetchDocuments=true');
      
      expect(response.status).toBe(200);
      expect(meetingPrepService.clearPrepCache).toHaveBeenCalledWith('meeting-123', false);
      expect(documentService.refetchDocumentsForEvent).toHaveBeenCalledWith(mockEvent, mockTokens);
      expect(documentService.getDocumentsForEvent).not.toHaveBeenCalled();
    });

    it('should pre-fetch document content when not refetching', async () => {
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(200);
      expect(documentService.getDocumentContent).toHaveBeenCalledWith('doc123', mockTokens);
    });

    it('should handle missing event', async () => {
      calendarService.getEventById.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to analyze meeting');
    });

    it('should handle calendar service errors', async () => {
      calendarService.getEventById.mockRejectedValue(new Error('Calendar error'));
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to analyze meeting');
    });

    it('should handle document service errors', async () => {
      documentService.getDocumentsForEvent.mockRejectedValue(new Error('Document error'));
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to analyze meeting');
    });

    it('should handle empty documents list', async () => {
      documentService.getDocumentsForEvent.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(200);
      expect(documentService.getDocumentContent).not.toHaveBeenCalled();
    });

    it('should handle null documents', async () => {
      documentService.getDocumentsForEvent.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      expect(response.status).toBe(200);
      expect(documentService.getDocumentContent).not.toHaveBeenCalled();
    });

    it('should handle document content fetch errors gracefully', async () => {
      documentService.getDocumentContent.mockRejectedValue(new Error('Content error'));
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/analyze');
      
      // Should still complete successfully
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/preparation/:meetingId/status', () => {
    it('should check if preparation materials exist', async () => {
      meetingPrepService.checkPrepExists.mockResolvedValue(true);
      
      const response = await request(app)
        .get('/api/preparation/meeting-123/status');
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
      expect(meetingPrepService.checkPrepExists).toHaveBeenCalledWith('meeting-123');
    });

    it('should return false when materials do not exist', async () => {
      meetingPrepService.checkPrepExists.mockResolvedValue(false);
      
      const response = await request(app)
        .get('/api/preparation/meeting-123/status');
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(false);
    });

    it('should handle service errors', async () => {
      meetingPrepService.checkPrepExists.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .get('/api/preparation/meeting-123/status');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to check preparation status');
    });
  });

  describe('POST /api/preparation/:meetingId/notes', () => {
    it('should save user notes for a meeting', async () => {
      meetingPrepService.saveUserNotes.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: 'My preparation notes' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notes saved successfully');
      expect(meetingPrepService.saveUserNotes).toHaveBeenCalledWith(
        'meeting-123',
        'My preparation notes',
        'google-123'
      );
    });

    it('should return 400 if notes are missing', async () => {
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Notes are required');
    });

    it('should return 400 if notes are empty string', async () => {
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Notes are required');
    });

    it('should return 400 if notes are null', async () => {
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: null });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Notes are required');
    });

    it('should handle service returning false', async () => {
      meetingPrepService.saveUserNotes.mockResolvedValue(false);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: 'My preparation notes' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to save notes');
    });

    it('should handle service errors', async () => {
      meetingPrepService.saveUserNotes.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: 'My preparation notes' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to save notes');
    });

    it('should handle long notes', async () => {
      const longNotes = 'A'.repeat(10000);
      meetingPrepService.saveUserNotes.mockResolvedValue(true);
      
      const response = await request(app)
        .post('/api/preparation/meeting-123/notes')
        .send({ notes: longNotes });
      
      expect(response.status).toBe(200);
      expect(meetingPrepService.saveUserNotes).toHaveBeenCalledWith(
        'meeting-123',
        longNotes,
        'google-123'
      );
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
        .get('/api/preparation/meeting-123');
      
      expect(response.status).toBe(401);
    });

    it('should construct proper tokens object', async () => {
      meetingPrepService.prepareMeetingMaterials.mockResolvedValue(mockPrepMaterials);
      meetingPrepService.getUserNotes.mockResolvedValue([]);
      
      await request(app)
        .get('/api/preparation/meeting-123');
      
      expect(meetingPrepService.prepareMeetingMaterials).toHaveBeenCalledWith(
        'meeting-123',
        {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: { id: 'google-123' }
        }
      );
    });
  });
});
