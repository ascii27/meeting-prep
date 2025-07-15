const { jest } = require('@jest/globals');
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

// Mock node-cache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => {
    const cache = {};
    return {
      get: jest.fn((key) => cache[key]),
      set: jest.fn((key, value) => { cache[key] = value; }),
      del: jest.fn((key) => { delete cache[key]; })
    };
  });
});

describe('Meeting Preparation Service', () => {
  const documentService = require('../../../services/documentService');
  const openaiService = require('../../../services/openaiService');
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('prepareMeetingMaterials', () => {
    it('should return cached preparation if available', async () => {
      // Set up the cache mock to return cached preparation
      const NodeCache = require('node-cache');
      const mockCache = NodeCache.mock.instances[0];
      
      const cachedPrep = {
        summary: 'Cached summary',
        topics: ['Topic 1', 'Topic 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        documents: [{ id: 'doc1', title: 'Document 1' }]
      };
      
      mockCache.get.mockReturnValue(cachedPrep);
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result).toEqual(cachedPrep);
      
      // Verify document service was not called
      expect(documentService.getDocumentsForEvent).not.toHaveBeenCalled();
    });
    
    it('should handle case with no documents', async () => {
      // Mock document service to return no documents
      documentService.getDocumentsForEvent.mockResolvedValue([]);
      
      // Call the function
      const result = await meetingPrepService.prepareMeetingMaterials('meeting1', { accessToken: 'token' });
      
      // Check the result
      expect(result).toEqual({
        summary: 'No documents available for this meeting.',
        topics: [],
        suggestions: ['Review the meeting invitation for context.'],
        documents: []
      });
      
      // Verify document service was called
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(
        { id: 'meeting1' },
        { accessToken: 'token' }
      );
    });
    
    it('should process a single document', async () => {
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
        topics: ['Topic 1', 'Topic 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        documents: [{ id: 'doc1', title: 'Document 1' }]
      });
      
      // Verify services were called correctly
      expect(documentService.getDocumentsForEvent).toHaveBeenCalledWith(
        { id: 'meeting1' },
        { accessToken: 'token' }
      );
      
      expect(documentService.getDocumentContent).toHaveBeenCalledWith(
        'doc1',
        { accessToken: 'token' }
      );
      
      expect(openaiService.analyzeDocumentForMeeting).toHaveBeenCalledWith(
        'Test content',
        'doc1',
        'meeting1'
      );
    });
    
    it('should combine insights from multiple documents', async () => {
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
    it('should save and retrieve user notes', () => {
      // Save notes
      const saveResult = meetingPrepService.saveUserNotes('meeting1', 'Test notes');
      expect(saveResult).toBe(true);
      
      // Get notes
      const notes = meetingPrepService.getUserNotes('meeting1');
      expect(notes).toBe('Test notes');
    });
  });
  
  describe('clearPrepCache', () => {
    it('should clear preparation cache and OpenAI cache', () => {
      // Call the function
      meetingPrepService.clearPrepCache('meeting1');
      
      // Verify OpenAI cache clearing was called
      expect(openaiService.clearMeetingCache).toHaveBeenCalledWith('meeting1');
      
      // Verify prep cache was cleared
      const NodeCache = require('node-cache');
      const mockCache = NodeCache.mock.instances[0];
      expect(mockCache.del).toHaveBeenCalledWith('prep:meeting1');
    });
  });
});
