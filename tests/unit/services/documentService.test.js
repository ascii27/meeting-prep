// Using Jest's built-in assertions and mocking
const { google } = require('googleapis');
const documentService = require('../../../services/documentService');

// Mock the googleapis module
jest.mock('googleapis', () => {
  // Create a mock OAuth2 client with setCredentials method
  const mockOAuth2Client = {
    setCredentials: jest.fn()
  };
  
  // Create the mock OAuth2 constructor
  const MockOAuth2 = jest.fn(() => mockOAuth2Client);
  
  return {
    google: {
      docs: jest.fn(),
      auth: {
        OAuth2: MockOAuth2
      }
    }
  };
});

describe('Document Service', () => {
  let mockDocsClient;
  let mockTokens;
  
  beforeEach(() => {
    // Create mock for Google Docs API
    mockDocsClient = {
      documents: {
        get: jest.fn()
      }
    };
    
    // Mock the Google Docs API
    google.docs.mockReturnValue(mockDocsClient);
    
    // Mock tokens
    mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token'
    };
  });
  
  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  describe('getDocumentById', () => {
    it('should fetch a document by ID', async () => {
      // Mock document data
      const mockDocument = {
        documentId: 'test-doc-id',
        title: 'Test Document',
        body: {
          content: [
            {
              paragraph: {
                elements: [
                  {
                    textRun: {
                      content: 'Test content'
                    }
                  }
                ]
              }
            }
          ]
        }
      };
      
      // Configure the mock to return mock data
      mockDocsClient.documents.get.mockResolvedValue({ data: mockDocument });
      
      // Call the function
      const result = await documentService.getDocumentById('test-doc-id', mockTokens);
      
      // Verify the result
      expect(result).toEqual(mockDocument);
      expect(mockDocsClient.documents.get).toHaveBeenCalledTimes(1);
      expect(mockDocsClient.documents.get).toHaveBeenCalledWith({
        documentId: 'test-doc-id'
      });
    });
    
    it('should throw an error if document fetch fails', async () => {
      // Clear the previous mock implementation
      jest.clearAllMocks();
      
      // Configure the mock to throw an error
      mockDocsClient.documents.get.mockRejectedValue(new Error('API Error'));
      
      // Clear the document cache to ensure we don't get a cached result
      // We need to access the private cache in the module
      if (documentService.clearCache) {
        documentService.clearCache();
      }
      
      // Verify that the function throws an error
      await expect(documentService.getDocumentById('test-doc-id', mockTokens))
        .rejects
        .toThrow();
    });
  });
  
  describe('getDocumentsForEvent', () => {
    it('should extract Google Docs from event attachments', async () => {
      // Mock event with attachments
      const mockEvent = {
        attachments: [
          {
            title: 'Document 1',
            mimeType: 'application/vnd.google-apps.document',
            fileUrl: 'https://docs.google.com/document/d/doc1/edit'
          },
          {
            title: 'Not a Doc',
            mimeType: 'application/pdf',
            fileUrl: 'https://drive.google.com/file/d/notadoc/view'
          },
          {
            title: 'Document 2',
            mimeType: 'application/vnd.google-apps.document',
            fileUrl: 'https://docs.google.com/document/d/doc2/edit'
          }
        ]
      };
      
      // Call the function
      const result = await documentService.getDocumentsForEvent(mockEvent, mockTokens);
      
      // Verify the result
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('title', 'Document 1');
      expect(result[0]).toHaveProperty('id', 'doc1');
      expect(result[1]).toHaveProperty('title', 'Document 2');
      expect(result[1]).toHaveProperty('id', 'doc2');
    });
    
    it('should return an empty array if event has no attachments', async () => {
      const mockEvent = { id: 'event-without-attachments' };
      
      const result = await documentService.getDocumentsForEvent(mockEvent, mockTokens);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
    
    it('should return an empty array if event is null', async () => {
      const result = await documentService.getDocumentsForEvent(null, mockTokens);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
  
  describe('extractDocumentContent', () => {
    it('should extract and format document content', () => {
      // Mock document with content
      const mockDocument = {
        documentId: 'test-doc-id',
        title: 'Test Document',
        body: {
          content: [
            {
              paragraph: {
                elements: [
                  {
                    textRun: {
                      content: 'Paragraph 1\n'
                    }
                  }
                ]
              }
            },
            {
              paragraph: {
                elements: [
                  {
                    textRun: {
                      content: 'Paragraph 2\n'
                    }
                  }
                ]
              }
            }
          ]
        }
      };
      
      // Call the function
      const result = documentService.extractDocumentContent(mockDocument);
      
      // Verify the result
      expect(result).toHaveProperty('title', 'Test Document');
      expect(result).toHaveProperty('content');
      expect(result.content).toContain('Paragraph 1');
      expect(result.content).toContain('Paragraph 2');
    });
    
    it('should handle documents with no content', () => {
      const mockDocument = {
        documentId: 'empty-doc',
        title: 'Empty Document',
        body: { content: [] }
      };
      
      const result = documentService.extractDocumentContent(mockDocument);
      
      expect(result).toHaveProperty('title', 'Empty Document');
      expect(result).toHaveProperty('content', '');
    });
  });
});
