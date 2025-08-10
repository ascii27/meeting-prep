/**
 * Unit tests for Organization Service
 */
const organizationService = require('../organizationService');
const graphDatabaseService = require('../graph/graphDatabaseService');

// Mock the graph database service
jest.mock('../graph/graphDatabaseService', () => ({
  executeQuery: jest.fn()
}));

describe('OrganizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('should create a new organization', async () => {
      const orgData = {
        name: 'Test Corp',
        domain: 'testcorp.com',
        description: 'A test corporation',
        industry: 'Technology'
      };

      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: { ...orgData, updatedAt: '2024-01-01T00:00:00Z' }
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.createOrganization(orgData);

      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (org:Organization {domain: $domain})'),
        orgData
      );
      expect(result).toEqual({ ...orgData, updatedAt: '2024-01-01T00:00:00Z' });
    });
  });

  describe('createDepartment', () => {
    it('should create a department without parent', async () => {
      const deptData = {
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
        organizationDomain: 'testcorp.com'
      };

      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: { ...deptData, updatedAt: '2024-01-01T00:00:00Z' }
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.createDepartment(deptData);

      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (dept:Department {code: $code})'),
        deptData
      );
      expect(result).toEqual({ ...deptData, updatedAt: '2024-01-01T00:00:00Z' });
    });

    it('should create a department with parent department', async () => {
      const deptData = {
        name: 'Frontend Team',
        code: 'ENG-FE',
        description: 'Frontend Engineering Team',
        organizationDomain: 'testcorp.com',
        parentDepartmentCode: 'ENG'
      };

      const mockResult = {
        records: [{
          get: jest.fn().mockReturnValue({
            properties: { name: 'Frontend Team', code: 'ENG-FE' }
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.createDepartment(deptData);

      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('HAS_SUBDEPARTMENT'),
        deptData
      );
      expect(result).toEqual({ name: 'Frontend Team', code: 'ENG-FE' });
    });
  });

  describe('assignPersonToDepartment', () => {
    it('should assign a person to a department', async () => {
      const mockResult = {
        records: [{
          get: jest.fn((key) => {
            const data = {
              'p': { properties: { email: 'john@testcorp.com', name: 'John Doe' } },
              'r': { properties: { role: 'Software Engineer', isManager: false } },
              'dept': { properties: { code: 'ENG', name: 'Engineering' } }
            };
            return data[key];
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.assignPersonToDepartment(
        'john@testcorp.com', 'ENG', 'Software Engineer', false
      );

      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (p)-[r:WORKS_IN]->(dept)'),
        {
          personEmail: 'john@testcorp.com',
          departmentCode: 'ENG',
          role: 'Software Engineer',
          isManager: false
        }
      );

      expect(result).toEqual({
        person: { email: 'john@testcorp.com', name: 'John Doe' },
        relationship: { role: 'Software Engineer', isManager: false },
        department: { code: 'ENG', name: 'Engineering' }
      });
    });

    it('should return null if no records found', async () => {
      graphDatabaseService.executeQuery.mockResolvedValue({ records: [] });

      const result = await organizationService.assignPersonToDepartment(
        'nonexistent@testcorp.com', 'ENG', 'Engineer', false
      );

      expect(result).toBeNull();
    });
  });

  describe('createReportingRelationship', () => {
    it('should create a reporting relationship', async () => {
      const mockResult = {
        records: [{
          get: jest.fn((key) => {
            const data = {
              'manager': { properties: { email: 'manager@testcorp.com', name: 'Manager' } },
              'r': { properties: { establishedAt: '2024-01-01T00:00:00Z' } },
              'report': { properties: { email: 'report@testcorp.com', name: 'Report' } }
            };
            return data[key];
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.createReportingRelationship(
        'manager@testcorp.com', 'report@testcorp.com'
      );

      expect(graphDatabaseService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (report)-[r:REPORTS_TO]->(manager)'),
        {
          managerEmail: 'manager@testcorp.com',
          reportEmail: 'report@testcorp.com'
        }
      );

      expect(result).toEqual({
        manager: { email: 'manager@testcorp.com', name: 'Manager' },
        relationship: { establishedAt: '2024-01-01T00:00:00Z' },
        report: { email: 'report@testcorp.com', name: 'Report' }
      });
    });
  });

  describe('getOrganizationalHierarchy', () => {
    it('should return organizational hierarchy', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn((key) => {
              const data = {
                'org': { properties: { domain: 'testcorp.com', name: 'Test Corp' } },
                'dept': { properties: { code: 'ENG', name: 'Engineering' } },
                'person': { properties: { email: 'john@testcorp.com', name: 'John Doe' } },
                'manager': { properties: { email: 'manager@testcorp.com', name: 'Manager' } },
                'reports': { properties: { establishedAt: '2024-01-01T00:00:00Z' } }
              };
              return data[key];
            })
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.getOrganizationalHierarchy('testcorp.com');

      expect(result).toEqual({
        organization: { domain: 'testcorp.com', name: 'Test Corp' },
        departments: [{
          code: 'ENG',
          name: 'Engineering',
          people: [{ email: 'john@testcorp.com', name: 'John Doe' }]
        }],
        people: [{ email: 'john@testcorp.com', name: 'John Doe' }],
        reportingRelationships: [{
          reportEmail: 'john@testcorp.com',
          managerEmail: 'manager@testcorp.com',
          relationship: { establishedAt: '2024-01-01T00:00:00Z' }
        }]
      });
    });
  });

  describe('getDepartmentStatistics', () => {
    it('should return department statistics', async () => {
      const mockResult = {
        records: [{
          get: jest.fn((key) => {
            const data = {
              'dept': { properties: { code: 'ENG', name: 'Engineering' } },
              'totalPeople': { toNumber: () => 5 },
              'recentMeetings': { toNumber: () => 12 },
              'peopleEmails': ['john@test.com', 'jane@test.com']
            };
            return data[key];
          })
        }]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.getDepartmentStatistics('ENG');

      expect(result).toEqual({
        department: { code: 'ENG', name: 'Engineering' },
        totalPeople: 5,
        recentMeetings: 12,
        peopleEmails: ['john@test.com', 'jane@test.com']
      });
    });

    it('should return null if department not found', async () => {
      graphDatabaseService.executeQuery.mockResolvedValue({ records: [] });

      const result = await organizationService.getDepartmentStatistics('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('findColleagues', () => {
    it('should return list of colleagues', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn((key) => {
              const data = {
                'colleague': { properties: { email: 'colleague@test.com', name: 'Colleague' } },
                'dept': { properties: { code: 'ENG', name: 'Engineering' } },
                'manager': { properties: { email: 'manager@test.com', name: 'Manager' } },
                'reports': { properties: { establishedAt: '2024-01-01T00:00:00Z' } }
              };
              return data[key];
            })
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.findColleagues('john@test.com');

      expect(result).toEqual([{
        colleague: { email: 'colleague@test.com', name: 'Colleague' },
        department: { code: 'ENG', name: 'Engineering' },
        manager: { email: 'manager@test.com', name: 'Manager' },
        reportingRelationship: { establishedAt: '2024-01-01T00:00:00Z' }
      }]);
    });
  });

  describe('getCrossDepartmentCollaboration', () => {
    it('should return cross-department collaboration patterns', async () => {
      const mockResult = {
        records: [
          {
            get: jest.fn((key) => {
              const data = {
                'department1': 'Engineering',
                'department2': 'Product',
                'sharedMeetings': { toNumber: () => 8 },
                'people1Count': { toNumber: () => 3 },
                'people2Count': { toNumber: () => 2 },
                'sampleMeetings': ['Sprint Planning', 'Product Review']
              };
              return data[key];
            })
          }
        ]
      };

      graphDatabaseService.executeQuery.mockResolvedValue(mockResult);

      const result = await organizationService.getCrossDepartmentCollaboration('testcorp.com', 30);

      expect(result).toEqual([{
        department1: 'Engineering',
        department2: 'Product',
        sharedMeetings: 8,
        people1Count: 3,
        people2Count: 2,
        sampleMeetings: ['Sprint Planning', 'Product Review']
      }]);
    });
  });

  describe('prepareOrganizationChartData', () => {
    it('should prepare visualization data', async () => {
      // Mock the getOrganizationalHierarchy method
      const mockHierarchy = {
        organization: { domain: 'testcorp.com', name: 'Test Corp' },
        departments: [{ code: 'ENG', name: 'Engineering' }],
        people: [{ email: 'john@test.com', name: 'John Doe' }],
        reportingRelationships: [{
          reportEmail: 'john@test.com',
          managerEmail: 'manager@test.com',
          relationship: {}
        }]
      };

      jest.spyOn(organizationService, 'getOrganizationalHierarchy')
        .mockResolvedValue(mockHierarchy);

      const result = await organizationService.prepareOrganizationChartData('testcorp.com');

      expect(result.nodes).toHaveLength(3); // org + dept + person
      expect(result.edges).toHaveLength(2); // org->dept + person->manager
      
      expect(result.nodes[0]).toEqual({
        id: 'org-testcorp.com',
        label: 'Test Corp',
        type: 'organization',
        data: { domain: 'testcorp.com', name: 'Test Corp' }
      });
    });
  });
});
