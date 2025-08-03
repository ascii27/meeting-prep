const openaiService = require('../../../services/openaiService');

// Mock the OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
  });
});

// Mock node-cache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => {
    const cache = {};
    return {
      get: jest.fn((key) => cache[key]),
      set: jest.fn((key, value) => { cache[key] = value; }),
      del: jest.fn((keys) => {
        if (Array.isArray(keys)) {
          keys.forEach(key => delete cache[key]);
        } else {
          delete cache[keys];
        }
      }),
      keys: jest.fn(() => Object.keys(cache))
    };
  });
});

describe('OpenAI Service', () => {
  let mockOpenAI;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.OPENAI_MAX_TOKENS = '500';
    process.env.OPENAI_TEMPERATURE = '0.3';
    
    // Get the mocked OpenAI instance
    mockOpenAI = require('openai').mock.instances[0];
  });
  
  describe('generateSummary', () => {
    it('should generate a summary from document content', async () => {
      // Mock the OpenAI response
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is a test summary.'
            }
          }
        ]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      // Call the function
      const summary = await openaiService.generateSummary(
        'Test document content',
        'doc123',
        'meeting456'
      );
      
      // Check the result
      expect(summary).toBe('This is a test summary.');
      
      // Verify OpenAI was called with correct parameters
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.any(String)
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Test document content')
            })
          ]),
          max_tokens: 500,
          temperature: 0.3
        })
      );
    });
    
    it('should return cached summary if available', async () => {
      // Set up the cache mock to return a cached summary
      const NodeCache = require('node-cache');
      const mockCache = NodeCache.mock.instances[0];
      mockCache.get.mockReturnValue('Cached summary');
      
      // Call the function
      const summary = await openaiService.generateSummary(
        'Test document content',
        'doc123',
        'meeting456'
      );
      
      // Check the result
      expect(summary).toBe('Cached summary');
      
      // Verify OpenAI was not called
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });
  });
  
  describe('extractKeyTopics', () => {
    it('should extract key topics from document content', async () => {
      // Mock the OpenAI response
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                topics: ['Topic 1', 'Topic 2', 'Topic 3']
              })
            }
          }
        ]
      };
      
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
      
      // Call the function
      const topics = await openaiService.extractKeyTopics(
        'Test document content',
        'doc123',
        'meeting456'
      );
      
      // Check the result
      expect(topics).toEqual(['Topic 1', 'Topic 2', 'Topic 3']);
    });
  });
  
  describe('clearMeetingCache', () => {
    it('should clear cache entries for a specific meeting', () => {
      // Set up the cache mock
      const NodeCache = require('node-cache');
      const mockCache = NodeCache.mock.instances[0];
      mockCache.keys.mockReturnValue([
        'summary:doc1:meeting1',
        'topics:doc1:meeting1',
        'summary:doc2:meeting2'
      ]);
      
      // Call the function
      openaiService.clearMeetingCache('meeting1');
      
      // Verify cache.del was called with the correct keys
      expect(mockCache.del).toHaveBeenCalledWith(
        ['summary:doc1:meeting1', 'topics:doc1:meeting1']
      );
    });
  });
});
