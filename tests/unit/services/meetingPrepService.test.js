const meetingPrepService = require('../../../services/meetingPrepService');

// Mock the document service
jest.mock('../../../services/documentService', () => ({
  getDocumentsForEvent: jest.fn(),
  getDocumentContent: jest.fn()
}));

// Mock the OpenAI service
jest.mock('../../../services/openaiService', () => ({
  analyzeDocumentForMeeting: jest.fn(),
  clearMeetingCache: jest.fn()
}));

// Mock calendarService
jest.mock('../../../services/calendarService', () => ({
  getEventById: jest.fn()
}));

// Mock dataStorageService
jest.mock('../../../services/dataStorageService', () => ({
  getMeetingSummary: jest.fn(),
  storePreparationNote: jest.fn(),
  getPreparationNotes: jest.fn(),
  clearMeetingSummaryCache: jest.fn(),
  storeMeetingFromEvent: jest.fn(),
  storeMeetingSummary: jest.fn()
}));

// Mock the centralized cache service
jest.mock('../../../services/cacheService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  has: jest.fn(),
  keys: jest.fn(() => ({
    meetingPrep: (meetingId) => `prep:${meetingId}`,
    userNotes: (meetingId) => `notes:${meetingId}`
  }))
}));

describe('Meeting Preparation Service', () => {
  const documentService = require('../../../services/documentService');
  const openaiService = require('../../../services/openaiService');
  const calendarService = require('../../../services/calendarService');
  const dataStorageService = require('../../../services/dataStorageService');
  const cacheService = require('../../../services/cacheService');
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('prepareMeetingMaterials', () => {
    it('should return cached preparation if available', async () => {
      // Set up the cache mock to return cached preparation
      const cachedPrep = {
        summary: 'Cached summary',
        topics: ['Topic 1', 'Topic 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        documents: [{ id: 'doc1', title: 'Document 1' }]
      };
      
      cacheService.get.mockReturnValue(cachedPrep);
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result).toEqual(cachedPrep);
      
      // Verify document service was not called
      expect(documentService.getDocumentsForEvent).not.toHaveBeenCalled();
    });
    
    it('should handle case with no documents', async () => {
      // Mock calendar service to return an event
      const mockEvent = { id: 'meeting1', summary: 'Test Meeting' };
      calendarService.getEventById.mockResolvedValue(mockEvent);
      
      // Mock document service to return no documents
      documentService.getDocumentsForEvent.mockResolvedValue([]);
      
      // Mock cache to return null (no cached data)
      cacheService.get.mockReturnValue(null);
      
      // Mock dataStorageService to return null (no database data)
      dataStorageService.getMeetingSummary.mockResolvedValue(null);
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result).toEqual({
        summary: 'No documents available for this meeting.',
        topics: [],
        suggestions: ['Review the meeting invitation for context.'],
        documents: []
      });
      
      // Verify services were called
      expect(calendarService.getEventById).toHaveBeenCalledWith('meeting1', { accessToken: 'token', user: { id: 'default-user' } });
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(mockEvent, { accessToken: 'token', user: { id: 'default-user' } });
    });
    
    it('should process a single document', async () => {
      // Mock calendar service to return an event
      const mockEvent = { id: 'meeting1', summary: 'Test Meeting' };
      calendarService.getEventById.mockResolvedValue(mockEvent);
      
      // Mock cache to return null (no cached data)
      cacheService.get.mockReturnValue(null);
      
      // Mock dataStorageService to return null (no database data)
      dataStorageService.getMeetingSummary.mockResolvedValue(null);
      
      // Mock document service to return one document
      documentService.getDocumentsForEvent.mockResolvedValue([
        { id: 'doc1', title: 'Document 1' }
      ]);
      
      // Mock document content
      documentService.getDocumentContent.mockResolvedValue({
        title: 'Document 1',
        content: 'Test content'
      });
      
      // Mock OpenAI analysis
      openaiService.analyzeDocumentForMeeting.mockResolvedValue({
        summary: 'Test summary',
        topics: ['Topic 1', 'Topic 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2']
      });
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result).toEqual({
        summary: 'Test summary',
        summaryHtml: '',
        topics: ['Topic 1', 'Topic 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        documents: [{ id: 'doc1', title: 'Document 1' }]
      });
      
      // Verify services were called correctly
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(
        { id: 'meeting1', summary: 'Test Meeting' },
        { accessToken: 'token', user: { id: 'default-user' } }
      );
      
      expect(documentService.getDocumentContent).toHaveBeenCalledWith(
        'doc1',
        { accessToken: 'token', user: { id: 'default-user' } }
      );
      
      expect(openaiService.analyzeDocumentForMeeting).toHaveBeenCalledWith(
        'Test content',
        'doc1',
        'meeting1'
      );
    });
    
    it('should combine insights from multiple documents', async () => {
      // Mock calendar service to return an event
      const mockEvent = { id: 'meeting1', summary: 'Test Meeting' };
      calendarService.getEventById.mockResolvedValue(mockEvent);
      
      // Mock cache to return null (no cached data)
      cacheService.get.mockReturnValue(null);
      
      // Mock dataStorageService to return null (no database data)
      dataStorageService.getMeetingSummary.mockResolvedValue(null);
      
      // Mock document service to return multiple documents
      documentService.getDocumentsForEvent.mockResolvedValue([
        { id: 'doc1', title: 'Document 1' },
        { id: 'doc2', title: 'Document 2' }
      ]);
      
      // Mock document content
      documentService.getDocumentContent
        .mockResolvedValueOnce({
          title: 'Document 1',
          content: 'Test content 1'
        })
        .mockResolvedValueOnce({
          title: 'Document 2',
          content: 'Test content 2'
        });
      
      // Mock OpenAI analysis
      openaiService.analyzeDocumentForMeeting
        .mockResolvedValueOnce({
          summary: 'Summary 1',
          topics: ['Topic 1', 'Topic 2'],
          suggestions: ['Suggestion 1', 'Suggestion 2']
        })
        .mockResolvedValueOnce({
          summary: 'Summary 2',
          topics: ['Topic 2', 'Topic 3'],
          suggestions: ['Suggestion 2', 'Suggestion 3']
        });
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result.summary).toContain('Document 1: Summary 1');
      expect(result.summary).toContain('Document 2: Summary 2');
      expect(result.topics).toContain('Topic 1');
      expect(result.topics).toContain('Topic 2');
      expect(result.topics).toContain('Topic 3');
      expect(result.suggestions).toContain('Suggestion 1');
      expect(result.suggestions).toContain('Suggestion 2');
      expect(result.suggestions).toContain('Suggestion 3');
      expect(result.documents).toHaveLength(2);
    });
  });
  
  describe('saveUserNotes and getUserNotes', () => {
    it('should save and retrieve user notes', async () => {
      // Mock cache to return the saved notes when getUserNotes calls get
      cacheService.get.mockReturnValue('Test notes');
      
      // Save notes
      const saveResult = await meetingPrepService.saveUserNotes('meeting1', 'Test notes');
      expect(saveResult).toBe(true);
      
      // Verify cache.set was called
      expect(cacheService.set).toHaveBeenCalledWith('notes:meeting1', 'Test notes', 'USER_NOTES');
      
      // Get notes
      const notes = await meetingPrepService.getUserNotes('meeting1');
      expect(notes).toBe('Test notes');
      
      // Verify cache.get was called
      expect(cacheService.get).toHaveBeenCalledWith('notes:meeting1');
    });
  });
  
  describe('clearPrepCache', () => {
    it('should clear preparation cache and OpenAI cache', () => {
      // Call the function
      meetingPrepService.clearPrepCache('meeting1');
      
      // Verify OpenAI cache clearing was called
      expect(openaiService.clearMeetingCache).toHaveBeenCalledWith('meeting1');
      
      // Verify prep cache was cleared
      expect(cacheService.del).toHaveBeenCalledWith('prep:meeting1');
    });
  });
});
