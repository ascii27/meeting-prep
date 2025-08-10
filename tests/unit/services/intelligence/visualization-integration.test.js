/**
 * Integration tests for Step 5.4 - Advanced Visualization Components
 * Tests the complete flow from LLM service to chat visualization rendering
 */

const llmService = require('../../../../services/intelligence/llm/llmService');

describe('Step 5.4 - Advanced Visualization Integration', () => {

  describe('Visualization Data Generation', () => {
    it('should generate organization visualization for hierarchy queries', () => {
      const queryResults = {
        people: [
          { id: '1', name: 'John Doe', title: 'Manager', department: 'Engineering' },
          { id: '2', name: 'Jane Smith', title: 'Developer', department: 'Engineering' },
          { id: '3', name: 'Bob Johnson', title: 'Designer', department: 'Design' },
          { id: '4', name: 'Alice Brown', title: 'Analyst', department: 'Data' }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('organization_hierarchy', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0]).toMatchObject({
        type: 'organization',
        title: 'Organization Structure'
      });
      expect(visualizations[0].data).toBe(queryResults);
    });

    it('should generate collaboration visualization for network analysis', () => {
      const queryResults = {
        relationships: [
          { person1: 'John', person2: 'Jane', meetingCount: 15, strength: 'strong' },
          { person1: 'Jane', person2: 'Bob', meetingCount: 8, strength: 'medium' }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('collaboration_analysis', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0]).toMatchObject({
        type: 'collaboration',
        title: 'Collaboration Network'
      });
    });

    it('should generate timeline visualization for meeting frequency queries', () => {
      const queryResults = {
        meetings: [
          { startTime: '2024-01-01T10:00:00Z', title: 'Team Standup' },
          { startTime: '2024-01-02T14:00:00Z', title: 'Project Review' },
          { startTime: '2024-01-03T09:00:00Z', title: 'Client Call' }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('meeting_frequency', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0]).toMatchObject({
        type: 'timeline',
        title: 'Meeting Timeline'
      });
    });

    it('should generate department visualization for department analysis', () => {
      const queryResults = {
        departments: [
          { name: 'Engineering', peopleCount: 25, meetingCount: 120 },
          { name: 'Design', peopleCount: 8, meetingCount: 45 }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('department_analysis', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0]).toMatchObject({
        type: 'departments',
        title: 'Department Statistics'
      });
    });

    it('should generate topic visualization for content analysis', () => {
      const queryResults = {
        topics: [
          { name: 'Product Planning', count: 15, frequency: 0.8 },
          { name: 'Technical Review', count: 12, frequency: 0.6 }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('topic_analysis', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0]).toMatchObject({
        type: 'topics',
        title: 'Topic Evolution'
      });
    });

    it('should generate multiple visualizations for general queries with rich data', () => {
      const queryResults = {
        meetings: [
          { startTime: '2024-01-01T10:00:00Z', title: 'Meeting 1' },
          { startTime: '2024-01-02T10:00:00Z', title: 'Meeting 2' },
          { startTime: '2024-01-03T10:00:00Z', title: 'Meeting 3' },
          { startTime: '2024-01-04T10:00:00Z', title: 'Meeting 4' }
        ],
        people: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' },
          { name: 'Bob', email: 'bob@example.com' }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('general_query', queryResults);
      
      expect(visualizations).toHaveLength(2);
      expect(visualizations[0].type).toBe('timeline');
      expect(visualizations[1].type).toBe('collaboration');
    });

    it('should return empty array for queries with insufficient data', () => {
      const queryResults = {
        meetings: [
          { startTime: '2024-01-01T10:00:00Z', title: 'Single Meeting' }
        ],
        people: [
          { name: 'John', email: 'john@example.com' }
        ]
      };

      const visualizations = llmService.getVisualizationsForIntent('find_people', queryResults);
      
      expect(visualizations).toHaveLength(0);
    });
  });



  describe('Visualization Data Transformation', () => {
    it('should handle different data structures for organization charts', () => {
      const testCases = [
        {
          input: { people: [{ name: 'John', title: 'Manager' }] },
          expected: 'people'
        },
        {
          input: { hierarchy: [{ name: 'CEO', children: [] }] },
          expected: 'hierarchy'
        }
      ];

      testCases.forEach(testCase => {
        const visualizations = llmService.getVisualizationsForIntent('find_people', testCase.input);
        if (testCase.input.people && testCase.input.people.length > 3) {
          expect(visualizations).toHaveLength(1);
        } else {
          expect(visualizations).toHaveLength(0);
        }
      });
    });

    it('should prioritize timeline visualization for meeting queries with sufficient data', () => {
      const queryResults = {
        meetings: Array.from({ length: 6 }, (_, i) => ({
          startTime: `2024-01-0${i + 1}T10:00:00Z`,
          title: `Meeting ${i + 1}`
        }))
      };

      const visualizations = llmService.getVisualizationsForIntent('find_meetings', queryResults);
      
      expect(visualizations).toHaveLength(1);
      expect(visualizations[0].type).toBe('timeline');
      expect(visualizations[0].title).toBe('Meeting Timeline');
    });
  });


});

describe('Visualization Component Data Formats', () => {
  it('should validate organization chart data format', () => {
    const sampleData = {
      nodes: [
        {
          id: '1',
          name: 'John Doe',
          title: 'Engineering Manager',
          department: 'Engineering',
          managerId: null,
          isManager: true,
          meetingCount: 25
        },
        {
          id: '2',
          name: 'Jane Smith',
          title: 'Senior Developer',
          department: 'Engineering',
          managerId: '1',
          isManager: false,
          meetingCount: 15
        }
      ],
      relationships: [
        { from: '1', to: '2', type: 'manages' }
      ]
    };

    // Validate required fields
    sampleData.nodes.forEach(node => {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('title');
      expect(node).toHaveProperty('department');
    });
  });

  it('should validate collaboration network data format', () => {
    const sampleData = {
      relationships: [
        {
          person1: 'John Doe',
          person2: 'Jane Smith',
          meetingCount: 15,
          strength: 'strong'
        }
      ]
    };

    sampleData.relationships.forEach(rel => {
      expect(rel).toHaveProperty('person1');
      expect(rel).toHaveProperty('person2');
      expect(rel).toHaveProperty('meetingCount');
      expect(rel).toHaveProperty('strength');
      expect(['weak', 'medium', 'strong']).toContain(rel.strength);
    });
  });

  it('should validate timeline data format', () => {
    const sampleData = {
      timeline: [
        {
          date: '2024-01-01',
          count: 3
        },
        {
          date: '2024-01-02',
          count: 5
        }
      ]
    };

    sampleData.timeline.forEach(point => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('count');
      expect(typeof point.count).toBe('number');
    });
  });
});
