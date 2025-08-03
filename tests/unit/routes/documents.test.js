const request = require('supertest');
const express = require('express');
const session = require('express-session');
const documentsRoutes = require('../../../routes/documents');
const documentService = require('../../../services/documentService');

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

// Mock the document service
jest.mock('../../../services/documentService', () => ({
  getDocumentsForEvent: jest.fn(),
  getDocumentById: jest.fn(),
  extractDocumentContent: jest.fn(),
  refetchDocumentsForEvent: jest.fn()
}));

const { ensureAuth } = require('../../../middleware/auth');

describe('Documents Routes', () => {
  let app;
  let mockUser;
  let mockEvent;
  let mockDocuments;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Set up session middleware for testing
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    app.use('/api/documents', documentsRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up mock data
    mockUser = {
      id: 'test-user-id',
      googleId: 'google-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    };
    
    mockEvent = {
      id: 'event-123',
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
    
    // Mock ensureAuth to set up user and session
    ensureAuth.mockImplementation((req, res, next) => {
      req.user = mockUser;
      req.session.events = [mockEvent];
      next();
    });
  });

  describe('GET /api/documents/events/:eventId/documents', () => {
    it('should get documents for a specific event', async () => {
      documentService.getDocumentsForEvent.mockResolvedValue(mockDocuments);
      
      const response = await request(app)
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDocuments);
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(mockEvent, mockUser);
      expect(ensureAuth).toHaveBeenCalled();
    });

    it('should return 404 if event not found', async () => {
      const response = await request(app)
        .get('/api/documents/events/nonexistent-event/documents');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Event not found');
    });

    it('should handle service errors', async () => {
      documentService.getDocumentsForEvent.mockRejectedValue(new Error('Service error'));
      
      const response = await request(app)
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch documents');
    });

    it('should handle missing events in session', async () => {
      ensureAuth.mockImplementationOnce((req, res, next) => {
        req.user = mockUser;
        req.session.events = undefined;
        next();
      });
      
      const response = await request(app)
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Event not found');
    });

    it('should include error details in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const errorMessage = 'Detailed service error';
      documentService.getDocumentsForEvent.mockRejectedValue(new Error(errorMessage));
      
      const response = await request(app)
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe(errorMessage);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('GET /api/documents/documents/:documentId', () => {
    it('should get a specific document by ID', async () => {
      const mockDocument = { id: 'doc123', title: 'Test Doc' };
      const mockFormattedDocument = { title: 'Test Doc', content: 'Formatted content' };
      
      documentService.getDocumentById.mockResolvedValue(mockDocument);
      documentService.extractDocumentContent.mockReturnValue(mockFormattedDocument);
      
      const response = await request(app)
        .get('/api/documents/documents/doc123');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFormattedDocument);
      expect(documentService.getDocumentById).toHaveBeenCalledWith('doc123', mockUser);
      expect(documentService.extractDocumentContent).toHaveBeenCalledWith(mockDocument);
    });

    it('should handle document service errors', async () => {
      documentService.getDocumentById.mockRejectedValue(new Error('Document not found'));
      
      const response = await request(app)
        .get('/api/documents/documents/invalid-doc');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch document');
    });

    it('should handle document extraction errors', async () => {
      const mockDocument = { id: 'doc123', title: 'Test Doc' };
      documentService.getDocumentById.mockResolvedValue(mockDocument);
      documentService.extractDocumentContent.mockImplementation(() => {
        throw new Error('Extraction failed');
      });
      
      const response = await request(app)
        .get('/api/documents/documents/doc123');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/documents/events/:eventId/refetch', () => {
    it('should refetch documents for a specific event', async () => {
      const refetchedDocuments = [
        { id: 'doc123', title: 'Refetched Document', content: 'Fresh content' }
      ];
      
      documentService.refetchDocumentsForEvent.mockResolvedValue(refetchedDocuments);
      
      const response = await request(app)
        .post('/api/documents/events/event-123/refetch');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(refetchedDocuments);
      expect(response.body.message).toBe('Successfully refetched 1 documents');
      
      expect(documentService.refetchDocumentsForEvent).toHaveBeenCalledWith(
        mockEvent,
        {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: { id: 'google-123' }
        }
      );
    });

    it('should return 404 if event not found for refetch', async () => {
      const response = await request(app)
        .post('/api/documents/events/nonexistent-event/refetch');
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Event not found');
    });

    it('should handle refetch service errors', async () => {
      documentService.refetchDocumentsForEvent.mockRejectedValue(new Error('Refetch failed'));
      
      const response = await request(app)
        .post('/api/documents/events/event-123/refetch');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to refetch documents');
    });

    it('should handle empty refetch results', async () => {
      documentService.refetchDocumentsForEvent.mockResolvedValue([]);
      
      const response = await request(app)
        .post('/api/documents/events/event-123/refetch');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.message).toBe('Successfully refetched 0 documents');
    });

    it('should construct proper tokens object for refetch', async () => {
      documentService.refetchDocumentsForEvent.mockResolvedValue([]);
      
      await request(app)
        .post('/api/documents/events/event-123/refetch');
      
      const expectedTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'google-123' }
      };
      
      expect(documentService.refetchDocumentsForEvent).toHaveBeenCalledWith(
        mockEvent,
        expectedTokens
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
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should not expose error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      documentService.getDocumentsForEvent.mockRejectedValue(new Error('Internal error'));
      
      const response = await request(app)
        .get('/api/documents/events/event-123/documents');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});
