/**
 * Unit tests for Iterative Analysis Service
 */
const iterativeAnalysisService = require('../../../../../services/intelligence/execution/iterativeAnalysisService');
const llmService = require('../../../../../services/intelligence/llm/llmService');

// Mock dependencies
jest.mock('../../../../../services/intelligence/llm/llmService');

describe('IterativeAnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset thresholds to defaults
    iterativeAnalysisService.setAnalysisThresholds({
      minResultsForAnalysis: 1,
      maxFollowUpSteps: 3,
      confidenceThreshold: 0.7,
      completenessThreshold: 0.8
    });
  });

  describe('analyzeIntermediateResults', () => {
    const mockStrategy = {
      analysis: 'Find collaboration patterns in recent meetings',
      expectedOutcome: 'Collaboration insights and patterns',
      complexity: 'medium'
    };

    const mockContext = {
      user: { email: 'test@example.com', name: 'Test User' }
    };

    const mockStepResults = [
      {
        stepNumber: 1,
        queryType: 'find_meetings',
        description: 'Find recent meetings',
        success: true,
        results: {
          results: [
            {
              id: 'meeting1',
              title: 'Team Standup',
              organizer: { email: 'lead@test.com' },
              attendees: [
                { email: 'dev1@test.com', name: 'Dev 1' },
                { email: 'dev2@test.com', name: 'Dev 2' }
              ]
            },
            {
              id: 'meeting2',
              title: 'Project Review',
              organizer: { email: 'pm@test.com' },
              attendees: [
                { email: 'dev1@test.com', name: 'Dev 1' },
                { email: 'designer@test.com', name: 'Designer' }
              ]
            }
          ]
        },
        parameters: { timeframe: 'last_week' }
      }
    ];

    test('should analyze results successfully', async () => {
      const mockLLMResponse = {
        text: JSON.stringify({
          summary: 'Found 2 meetings with good collaboration patterns',
          completeness: 0.95, // High completeness to avoid follow-up
          insights: ['Regular standup meetings', 'Cross-functional collaboration'],
          gaps: [],
          recommendations: ['Analyze meeting frequency patterns'],
          needsFollowUp: false,
          followUpReason: 'Analysis appears complete'
        })
      };

      llmService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await iterativeAnalysisService.analyzeIntermediateResults(
        mockStepResults,
        mockStrategy,
        mockContext
      );

      // With high completeness (0.95) and good confidence, should not need follow-up
      expect(result.needsFollowUp).toBe(false);
      expect(result.analysis).toBe('Found 2 meetings with good collaboration patterns');
      expect(result.insights).toHaveLength(2);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.completeness).toBeGreaterThan(0);
    });

    test('should identify need for follow-up when completeness is low', async () => {
      const mockLLMResponse = {
        text: JSON.stringify({
          summary: 'Limited data found',
          completeness: 0.6,
          insights: ['Few meetings found'],
          gaps: ['Missing recent collaboration data'],
          recommendations: ['Search for more recent meetings'],
          needsFollowUp: true,
          followUpReason: 'Insufficient data coverage'
        })
      };

      llmService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const result = await iterativeAnalysisService.analyzeIntermediateResults(
        mockStepResults,
        mockStrategy,
        mockContext
      );

      expect(result.needsFollowUp).toBe(true);
      expect(result.reason).toContain('Low completeness score');
    });

    test('should handle insufficient results', async () => {
      const emptyResults = [];

      const result = await iterativeAnalysisService.analyzeIntermediateResults(
        emptyResults,
        mockStrategy,
        mockContext
      );

      expect(result.needsFollowUp).toBe(false);
      expect(result.reason).toBe('Insufficient successful results for analysis');
      expect(result.analysisConfidence).toBe(0);
    });

    test('should handle LLM service failure', async () => {
      llmService.generateResponse.mockRejectedValueOnce(new Error('LLM service failed'));

      const result = await iterativeAnalysisService.analyzeIntermediateResults(
        mockStepResults,
        mockStrategy,
        mockContext
      );

      expect(result.needsFollowUp).toBe(false);
      expect(result.reason).toContain('Analysis failed');
      expect(result.error).toBe('LLM service failed');
    });
  });

  describe('aggregateResultData', () => {
    const mockResults = [
      {
        queryType: 'find_meetings',
        results: {
          results: [
            {
              id: 'meeting1',
              title: 'Team Standup Meeting',
              organizer: { email: 'lead@test.com' },
              attendees: [
                { email: 'dev1@test.com', name: 'Dev 1' },
                { email: 'dev2@test.com', name: 'Dev 2' }
              ]
            }
          ]
        },
        parameters: { timeframe: 'last_week' }
      },
      {
        queryType: 'get_participants',
        results: {
          results: [
            { email: 'dev1@test.com', name: 'Dev 1', department: 'Engineering' },
            { email: 'dev2@test.com', name: 'Dev 2', department: 'Engineering' }
          ]
        }
      }
    ];

    test('should aggregate data correctly', () => {
      const aggregated = iterativeAnalysisService.aggregateResultData(mockResults);

      expect(aggregated.totalResults).toBe(3); // 1 meeting + 2 participants
      expect(aggregated.resultsByType.find_meetings).toBe(1);
      expect(aggregated.resultsByType.get_participants).toBe(2);
      expect(aggregated.entities.people).toContain('lead@test.com');
      expect(aggregated.entities.people).toContain('dev1@test.com');
      expect(aggregated.entities.people).toContain('dev2@test.com');
      expect(aggregated.entities.meetings).toContain('meeting1');
      expect(aggregated.entities.topics).toContain('standup');
    });

    test('should handle empty results', () => {
      const aggregated = iterativeAnalysisService.aggregateResultData([]);

      expect(aggregated.totalResults).toBe(0);
      expect(Object.keys(aggregated.resultsByType)).toHaveLength(0);
      expect(aggregated.entities.people).toHaveLength(0);
    });
  });

  describe('extractEntitiesFromResults', () => {
    test('should extract people from meeting results', () => {
      const entities = {
        people: new Set(),
        meetings: new Set(),
        documents: new Set(),
        topics: new Set()
      };

      const meetingData = [
        {
          id: 'meeting1',
          title: 'Team Standup',
          organizer: { email: 'lead@test.com' },
          attendees: [
            { email: 'dev1@test.com', name: 'Dev 1' },
            { email: 'dev2@test.com', name: 'Dev 2' }
          ]
        }
      ];

      iterativeAnalysisService.extractEntitiesFromResults(meetingData, 'find_meetings', entities);

      expect(entities.people.has('lead@test.com')).toBe(true);
      expect(entities.people.has('dev1@test.com')).toBe(true);
      expect(entities.people.has('dev2@test.com')).toBe(true);
      expect(entities.meetings.has('meeting1')).toBe(true);
      expect(entities.topics.has('standup')).toBe(true);
    });

    test('should extract documents from document results', () => {
      const entities = {
        people: new Set(),
        meetings: new Set(),
        documents: new Set(),
        topics: new Set()
      };

      const documentData = [
        {
          id: 'doc1',
          title: 'Project Architecture Document',
          type: 'document',
          author: { email: 'architect@test.com' }
        }
      ];

      iterativeAnalysisService.extractEntitiesFromResults(documentData, 'find_documents', entities);

      expect(entities.documents.has('doc1')).toBe(true);
      expect(entities.topics.has('project')).toBe(true);
      expect(entities.topics.has('architecture')).toBe(true);
    });
  });

  describe('extractTopicsFromText', () => {
    test('should extract meeting-related topics', () => {
      const text = 'Daily Standup Meeting for Project Alpha';
      const topics = iterativeAnalysisService.extractTopicsFromText(text);

      expect(topics).toContain('standup');
      expect(topics).toContain('project');
    });

    test('should extract technical topics', () => {
      const text = 'Architecture Review and Technical Design Discussion';
      const topics = iterativeAnalysisService.extractTopicsFromText(text);

      expect(topics).toContain('architecture');
      expect(topics).toContain('technical');
      expect(topics).toContain('design');
    });

    test('should handle empty or invalid text', () => {
      expect(iterativeAnalysisService.extractTopicsFromText('')).toEqual([]);
      expect(iterativeAnalysisService.extractTopicsFromText(null)).toEqual([]);
      expect(iterativeAnalysisService.extractTopicsFromText(undefined)).toEqual([]);
    });

    test('should remove duplicate topics', () => {
      const text = 'Project planning project review project update';
      const topics = iterativeAnalysisService.extractTopicsFromText(text);

      expect(topics.filter(t => t === 'project')).toHaveLength(1);
    });
  });

  describe('calculateAnalysisMetrics', () => {
    test('should calculate metrics correctly', () => {
      const results = [
        { success: true },
        { success: true },
        { success: false }
      ];

      const aggregatedData = {
        totalResults: 15,
        entities: {
          people: ['user1', 'user2'],
          meetings: ['meeting1'],
          documents: [],
          topics: ['topic1', 'topic2', 'topic3']
        }
      };

      const metrics = iterativeAnalysisService.calculateAnalysisMetrics(results, aggregatedData);

      expect(metrics.confidence).toBeCloseTo(0.83, 1); // (2/3 + 1) / 2
      expect(metrics.completeness).toBeCloseTo(0.875, 1); // (1 + 0.75) / 2 - updated calculation
      expect(metrics.dataQuality).toBeCloseTo(0.67, 1); // 2/3
      expect(metrics.entityDiversity).toBe(0.75); // 3/4 entity types have data
    });

    test('should handle empty data', () => {
      const results = [];
      const aggregatedData = {
        totalResults: 0,
        entities: { people: [], meetings: [], documents: [], topics: [] }
      };

      const metrics = iterativeAnalysisService.calculateAnalysisMetrics(results, aggregatedData);

      // When there are no results, metrics should handle division by zero gracefully
      expect(metrics.confidence).toBe(0);
      expect(metrics.completeness).toBe(0);
      expect(metrics.entityDiversity).toBe(0);
      expect(metrics.dataQuality).toBe(0); // Should be 0, not NaN
    });
  });

  describe('evaluateFollowUpNeed', () => {
    test('should recommend follow-up for low completeness', () => {
      const analysis = {
        completeness: 0.6,
        confidence: 0.8,
        gaps: []
      };

      const strategy = { complexity: 'medium' };

      const decision = iterativeAnalysisService.evaluateFollowUpNeed(analysis, strategy);

      expect(decision.needsFollowUp).toBe(true);
      expect(decision.reason).toContain('Low completeness score');
    });

    test('should recommend follow-up for low confidence', () => {
      const analysis = {
        completeness: 0.9,
        confidence: 0.5,
        gaps: []
      };

      const strategy = { complexity: 'medium' };

      const decision = iterativeAnalysisService.evaluateFollowUpNeed(analysis, strategy);

      expect(decision.needsFollowUp).toBe(true);
      expect(decision.reason).toContain('Low confidence score');
    });

    test('should recommend follow-up for identified gaps', () => {
      const analysis = {
        completeness: 0.9,
        confidence: 0.8,
        gaps: ['Missing recent data', 'Incomplete participant info']
      };

      const strategy = { complexity: 'medium' };

      const decision = iterativeAnalysisService.evaluateFollowUpNeed(analysis, strategy);

      expect(decision.needsFollowUp).toBe(true);
      expect(decision.reason).toContain('2 gaps identified');
    });

    test('should recommend follow-up for high complexity strategies', () => {
      const analysis = {
        completeness: 0.85,
        confidence: 0.8,
        gaps: []
      };

      const strategy = { complexity: 'high' };

      const decision = iterativeAnalysisService.evaluateFollowUpNeed(analysis, strategy);

      expect(decision.needsFollowUp).toBe(true);
      expect(decision.reason).toContain('High complexity strategy');
    });

    test('should not recommend follow-up when analysis is complete', () => {
      const analysis = {
        completeness: 0.9,
        confidence: 0.8,
        gaps: []
      };

      const strategy = { complexity: 'medium' };

      const decision = iterativeAnalysisService.evaluateFollowUpNeed(analysis, strategy);

      expect(decision.needsFollowUp).toBe(false);
      expect(decision.reason).toBe('Analysis appears complete');
    });
  });

  describe('generateFollowUpSteps', () => {
    const mockAnalysis = {
      gaps: ['Missing collaboration data', 'Incomplete participant analysis'],
      recommendations: ['Analyze recent collaboration patterns', 'Get detailed participant info']
    };

    const mockStrategy = {
      analysis: 'Collaboration analysis',
      expectedOutcome: 'Collaboration insights'
    };

    const mockContext = {
      user: { email: 'test@example.com' }
    };

    test('should generate follow-up steps successfully', async () => {
      const mockLLMResponse = `\`\`\`json
{
  "followUpSteps": [
    {
      "stepNumber": 3,
      "description": "Analyze collaboration patterns",
      "queryType": "analyze_collaboration",
      "parameters": { "timeframe": "last_month" },
      "dependencies": [],
      "estimatedTime": "medium",
      "purpose": "Address missing collaboration data"
    },
    {
      "stepNumber": 4,
      "description": "Get detailed participant information",
      "queryType": "get_participants",
      "parameters": { "includeDetails": true },
      "dependencies": [3],
      "estimatedTime": "fast",
      "purpose": "Complete participant analysis"
    }
  ]
}
\`\`\``;

      llmService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const steps = await iterativeAnalysisService.generateFollowUpSteps(
        mockAnalysis,
        mockStrategy,
        mockContext
      );

      expect(steps).toHaveLength(2);
      expect(steps[0].queryType).toBe('analyze_collaboration');
      expect(steps[1].queryType).toBe('get_participants');
      expect(steps[1].dependencies).toContain(3);
    });

    test('should limit number of follow-up steps', async () => {
      const mockLLMResponse = `\`\`\`json
{
  "followUpSteps": [
    { "stepNumber": 3, "queryType": "step1" },
    { "stepNumber": 4, "queryType": "step2" },
    { "stepNumber": 5, "queryType": "step3" },
    { "stepNumber": 6, "queryType": "step4" },
    { "stepNumber": 7, "queryType": "step5" }
  ]
}
\`\`\``;

      llmService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

      const steps = await iterativeAnalysisService.generateFollowUpSteps(
        mockAnalysis,
        mockStrategy,
        mockContext
      );

      expect(steps).toHaveLength(3); // Limited by maxFollowUpSteps
    });

    test('should handle LLM service failure', async () => {
      llmService.generateResponse.mockRejectedValueOnce(new Error('LLM failed'));

      const steps = await iterativeAnalysisService.generateFollowUpSteps(
        mockAnalysis,
        mockStrategy,
        mockContext
      );

      expect(steps).toEqual([]);
    });
  });

  describe('parseLLMAnalysis', () => {
    test('should parse valid JSON response', () => {
      const response = {
        text: JSON.stringify({
          summary: 'Test summary',
          completeness: 0.8,
          insights: ['insight1', 'insight2'],
          gaps: ['gap1'],
          recommendations: ['rec1'],
          needsFollowUp: true,
          followUpReason: 'More data needed'
        })
      };

      const parsed = iterativeAnalysisService.parseLLMAnalysis(response);

      expect(parsed.summary).toBe('Test summary');
      expect(parsed.completeness).toBe(0.8);
      expect(parsed.insights).toHaveLength(2);
      expect(parsed.needsFollowUp).toBe(true);
    });

    test('should parse JSON wrapped in markdown', () => {
      const response = {
        text: '```json\n{"summary": "Test", "completeness": 0.5}\n```'
      };

      const parsed = iterativeAnalysisService.parseLLMAnalysis(response);

      expect(parsed.summary).toBe('Test');
      expect(parsed.completeness).toBe(0.5);
    });

    test('should handle invalid JSON gracefully', () => {
      const response = { text: 'invalid json' };

      const parsed = iterativeAnalysisService.parseLLMAnalysis(response);

      expect(parsed.summary).toBe('Analysis parsing failed');
      expect(parsed.completeness).toBe(0.5);
      expect(parsed.gaps).toContain('Analysis parsing error');
    });
  });

  describe('configuration', () => {
    test('should set and get analysis thresholds', () => {
      const newThresholds = {
        confidenceThreshold: 0.8,
        completenessThreshold: 0.9
      };

      iterativeAnalysisService.setAnalysisThresholds(newThresholds);
      const thresholds = iterativeAnalysisService.getAnalysisThresholds();

      expect(thresholds.confidenceThreshold).toBe(0.8);
      expect(thresholds.completenessThreshold).toBe(0.9);
      expect(thresholds.minResultsForAnalysis).toBe(1); // Should preserve existing values
    });
  });
});
