/**
 * Unit tests for LLM Query Service
 */

const llmQueryService = require('../llm/llmQueryService');
const llmService = require('../llm/llmService');
const graphDatabaseService = require('../graph/graphDatabaseService');

// Mock dependencies
jest.mock('../llm/llmService');
jest.mock('../graph/graphDatabaseService');

describe('LLMQueryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processQuery', () => {
    it('should process a complete natural language query', async () => {
      const mockParsedQuery = {
        intent: 'find_meetings',
        entities: {
          people: ['john@example.com'],
          timeframe: 'last week'
        },
        parameters: {
          limit: 10,
          sort_by: 'date'
        },
        confidence: 0.8,
        originalQuery: 'Show me meetings with John last week'
      };

      const mockQueryResults = {
        type: 'meetings',
        totalResults: 3,
        data: [
          { title: 'Project Planning', startTime: '2024-01-15T10:00:00Z' },
          { title: 'Status Update', startTime: '2024-01-16T14:00:00Z' },
          { title: 'Team Sync', startTime: '2024-01-17T15:00:00Z' }
        ]
      };

      const mockResponse = 'I found 3 meetings with John last week: Project Planning, Status Update, and Team Sync.';

      llmService.processQuery.mockResolvedValue(mockParsedQuery);
      llmService.generateResponse.mockResolvedValue(mockResponse);
      
      // Mock the database query execution
      graphDatabaseService.executeQuery.mockResolvedValue({
        records: mockQueryResults.data.map(meeting => ({
          get: () => ({ properties: meeting })
        }))
      });

      const result = await llmQueryService.processQuery('Show me meetings with John last week');

      expect(result.query).toBe('Show me meetings with John last week');
      expect(result.intent).toBe('find_meetings');
      expect(result.confidence).toBe(0.8);
      expect(result.results.totalResults).toBe(3);
      expect(result.response).toBe(mockResponse);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      llmService.processQuery.mockRejectedValue(new Error('LLM service error'));

      const result = await llmQueryService.processQuery('Invalid query');

      expect(result.error).toBeDefined();
      expect(result.response).toContain('I\'m sorry, I encountered an error');
    });
  });

  describe('handleFindMeetings', () => {
    it('should build correct Cypher query for meeting search', async () => {
      const parsedQuery = {
        entities: {
          people: ['john@example.com'],
          timeframe: 'last week'
        },
        parameters: {
          limit: 10
        }
      };

      const mockDbResult = {
        records: [
          { get: () => ({ properties: { title: 'Meeting 1', startTime: '2024-01-15T10:00:00Z' } }) },
          { get: () => ({ properties: { title: 'Meeting 2', startTime: '2024-01-16T14:00:00Z' } }) }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockDbResult);

      const result = await llmQueryService.handleFindMeetings(parsedQuery, {});

      expect(result.type).toBe('meetings');
      expect(result.totalResults).toBe(2);
      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (m:Meeting)'),
        expect.objectContaining({
          people: ['john@example.com'],
          limit: 10
        })
      );
    });

    it('should handle queries without specific people', async () => {
      const parsedQuery = {
        entities: {
          timeframe: 'today'
        },
        parameters: {
          limit: 5
        }
      };

      graphDatabaseService.executeQuery.mockResolvedValue({ records: [] });

      const result = await llmQueryService.handleFindMeetings(parsedQuery, {});

      expect(result.type).toBe('meetings');
      expect(result.totalResults).toBe(0);
    });
  });

  describe('handleGetParticipants', () => {
    it('should build correct Cypher query for participant search', async () => {
      const parsedQuery = {
        entities: {
          timeframe: 'last month'
        },
        parameters: {
          limit: 15
        }
      };

      const mockDbResult = {
        records: [
          { 
            get: (field) => {
              if (field === 'p') return { properties: { name: 'John Doe', email: 'john@example.com' } };
              if (field === 'meetingCount') return { toNumber: () => 5 };
            }
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockDbResult);

      const result = await llmQueryService.handleGetParticipants(parsedQuery, {});

      expect(result.type).toBe('participants');
      expect(result.data[0]).toHaveProperty('meetingCount', 5);
      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (p:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)'),
        expect.objectContaining({
          limit: 15
        })
      );
    });
  });

  describe('handleFindDocuments', () => {
    it('should build correct Cypher query for document search', async () => {
      const parsedQuery = {
        entities: {
          people: ['alice@example.com'],
          documents: ['planning']
        },
        parameters: {
          limit: 20
        }
      };

      const mockDbResult = {
        records: [
          { 
            get: (field) => {
              if (field === 'd') return { properties: { title: 'Planning Doc', id: 'doc123' } };
              if (field === 'meetingTitle') return 'Project Meeting';
              if (field === 'meetingDate') return '2024-01-15T10:00:00Z';
            }
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockDbResult);

      const result = await llmQueryService.handleFindDocuments(parsedQuery, {});

      expect(result.type).toBe('documents');
      expect(result.data[0]).toHaveProperty('meetingTitle', 'Project Meeting');
      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:Document)<-[:HAS_DOCUMENT]-(m:Meeting)'),
        expect.objectContaining({
          people: ['alice@example.com'],
          documents: ['planning'],
          limit: 20
        })
      );
    });
  });

  describe('handleAnalyzeRelationships', () => {
    it('should build correct Cypher query for relationship analysis', async () => {
      const parsedQuery = {
        entities: {
          people: ['john@example.com']
        },
        parameters: {
          limit: 10
        }
      };

      const mockDbResult = {
        records: [
          { 
            get: (field) => {
              const data = {
                person1: 'John Doe',
                email1: 'john@example.com',
                person2: 'Jane Smith',
                email2: 'jane@example.com',
                collaborationCount: { toNumber: () => 8 }
              };
              return data[field];
            }
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockDbResult);

      const result = await llmQueryService.handleAnalyzeRelationships(parsedQuery, {});

      expect(result.type).toBe('relationships');
      expect(result.data[0]).toHaveProperty('collaborationCount', 8);
      expect(result.data[0].person1).toHaveProperty('name', 'John Doe');
      expect(result.data[0].person2).toHaveProperty('name', 'Jane Smith');
    });
  });

  describe('parseTimeframe', () => {
    it('should parse "today" correctly', () => {
      const result = llmQueryService.parseTimeframe('today');
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      expect(new Date(result.start).getDate()).toBe(new Date().getDate());
    });

    it('should parse "yesterday" correctly', () => {
      const result = llmQueryService.parseTimeframe('yesterday');
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(new Date(result.start).getDate()).toBe(yesterday.getDate());
    });

    it('should parse "last week" correctly', () => {
      const result = llmQueryService.parseTimeframe('last week');
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      expect(new Date(result.start).getDate()).toBe(weekAgo.getDate());
    });

    it('should return null for unrecognized timeframes', () => {
      const result = llmQueryService.parseTimeframe('next century');
      expect(result).toBeNull();
    });
  });

  describe('generateFollowUpSuggestions', () => {
    it('should generate relevant suggestions for meeting queries', () => {
      const parsedQuery = { intent: 'find_meetings' };
      const queryResults = { totalResults: 5 };

      const suggestions = llmQueryService.generateFollowUpSuggestions(parsedQuery, queryResults);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('participants'))).toBe(true);
    });

    it('should generate relevant suggestions for participant queries', () => {
      const parsedQuery = { intent: 'get_participants' };
      const queryResults = { totalResults: 3 };

      const suggestions = llmQueryService.generateFollowUpSuggestions(parsedQuery, queryResults);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.some(s => s.includes('meetings'))).toBe(true);
    });

    it('should return empty array for zero results', () => {
      const parsedQuery = { intent: 'find_meetings' };
      const queryResults = { totalResults: 0 };

      const suggestions = llmQueryService.generateFollowUpSuggestions(parsedQuery, queryResults);

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
