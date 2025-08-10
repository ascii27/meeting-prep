/**
 * Unit tests for LLM Service
 */

// Mock the openaiService before importing llmService
jest.mock('../../openaiService', () => ({
  generateResponse: jest.fn()
}));

const llmService = require('../llm/llmService');
const openaiService = require('../../openaiService');

describe('LLMService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processQuery', () => {
    it('should process a simple meeting query', async () => {
      const mockResponse = JSON.stringify({
        intent: 'find_meetings',
        entities: {
          people: ['john@example.com'],
          timeframe: 'last week'
        },
        parameters: {
          limit: 10,
          sort_by: 'date'
        },
        confidence: 0.8
      });

      openaiService.generateResponse.mockResolvedValue(mockResponse);

      const result = await llmService.processQuery('Show me meetings with John last week');

      expect(result.intent).toBe('find_meetings');
      expect(result.entities.people).toContain('john@example.com');
      expect(result.entities.timeframe).toBe('last week');
      expect(result.confidence).toBe(0.8);
    });

    it('should handle malformed LLM responses with fallback parsing', async () => {
      openaiService.generateResponse.mockResolvedValue('Invalid JSON response');

      const result = await llmService.processQuery('Show me meetings with John');

      expect(result.intent).toBe('find_meetings');
      expect(result.confidence).toBe(0.3);
      expect(result.originalQuery).toBe('Show me meetings with John');
    });

    it('should detect document queries', async () => {
      openaiService.generateResponse.mockResolvedValue('Invalid JSON');

      const result = await llmService.processQuery('Find documents about planning');

      expect(result.intent).toBe('find_documents');
    });

    it('should detect participant queries', async () => {
      openaiService.generateResponse.mockResolvedValue('Invalid JSON');

      const result = await llmService.processQuery('Who attended the meeting?');

      expect(result.intent).toBe('get_participants');
    });

    it('should detect relationship queries', async () => {
      openaiService.generateResponse.mockResolvedValue('Invalid JSON');

      const result = await llmService.processQuery('Show me collaboration patterns');

      expect(result.intent).toBe('analyze_relationships');
    });
  });

  describe('generateResponse', () => {
    it('should generate a natural language response', async () => {
      const mockResponse = 'Based on your query, I found 5 meetings with John last week. The meetings covered topics including project planning and status updates.';
      
      openaiService.generateResponse.mockResolvedValue(mockResponse);

      const queryResults = {
        type: 'meetings',
        totalResults: 5,
        data: [
          { title: 'Project Planning', startTime: '2024-01-15T10:00:00Z' },
          { title: 'Status Update', startTime: '2024-01-16T14:00:00Z' }
        ]
      };

      const result = await llmService.generateResponse(
        'Show me meetings with John last week',
        queryResults
      );

      expect(result).toBe(mockResponse);
      expect(openaiService.generateResponse).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 1500
        })
      );
    });
  });

  describe('getAvailableIntents', () => {
    it('should return available query intents', () => {
      const intents = llmService.getAvailableIntents();

      expect(intents).toHaveProperty('find_meetings');
      expect(intents).toHaveProperty('get_participants');
      expect(intents).toHaveProperty('find_documents');
      expect(intents).toHaveProperty('analyze_relationships');
      expect(intents).toHaveProperty('general_query');

      expect(intents.find_meetings).toHaveProperty('description');
      expect(intents.find_meetings).toHaveProperty('examples');
      expect(Array.isArray(intents.find_meetings.examples)).toBe(true);
    });
  });

  describe('fallbackQueryParsing', () => {
    it('should correctly identify meeting queries', () => {
      const result = llmService.fallbackQueryParsing('Show me my meetings');
      expect(result.intent).toBe('find_meetings');
    });

    it('should correctly identify document queries', () => {
      const result = llmService.fallbackQueryParsing('Find the planning document');
      expect(result.intent).toBe('find_documents');
    });

    it('should correctly identify participant queries', () => {
      const result = llmService.fallbackQueryParsing('Who was in the meeting?');
      expect(result.intent).toBe('get_participants');
    });

    it('should correctly identify relationship queries', () => {
      const result = llmService.fallbackQueryParsing('Show collaboration between teams');
      expect(result.intent).toBe('analyze_relationships');
    });

    it('should default to general query for unclear intents', () => {
      const result = llmService.fallbackQueryParsing('What is the weather?');
      expect(result.intent).toBe('general_query');
    });
  });
});
