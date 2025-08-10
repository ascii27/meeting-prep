/**
 * Unit tests for Intelligence Organization API Routes
 */
const request = require('supertest');
const express = require('express');
const intelligenceRoutes = require('../../../routes/intelligence');
const organizationService = require('../../../services/intelligence/organizationService');

// Mock the organization service
jest.mock('../../../services/intelligence/organizationService');

// Mock middleware
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: (req, res, next) => {
    req.user = { email: 'test@example.com' };
    next();
  }
}));

// Mock other services to prevent errors
jest.mock('../../../services/intelligenceService');
jest.mock('../../../services/intelligence/llm/llmQueryService');

const app = express();
app.use(express.json());
app.use('/api/intelligence', intelligenceRoutes);

describe('Intelligence Organization Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/intelligence/organization/:domain/hierarchy', () => {
    it('should return organizational hierarchy', async () => {
      const mockHierarchy = {
        organization: { domain: 'testcorp.com', name: 'Test Corp' },
        departments: [{ code: 'ENG', name: 'Engineering' }],
        people: [{ email: 'john@testcorp.com', name: 'John Doe' }],
        reportingRelationships: []
      };

      organizationService.getOrganizationalHierarchy.mockResolvedValue(mockHierarchy);

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/hierarchy')
        .expect(200);

      expect(response.body).toEqual(mockHierarchy);
      expect(organizationService.getOrganizationalHierarchy).toHaveBeenCalledWith('testcorp.com');
    });

    it('should handle errors when getting hierarchy', async () => {
      organizationService.getOrganizationalHierarchy.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/hierarchy')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get organizational hierarchy' });
    });
  });

  describe('GET /api/intelligence/organization/:domain/chart-data', () => {
    it('should return organization chart data', async () => {
      const mockChartData = {
        nodes: [
          { id: 'org-testcorp.com', label: 'Test Corp', type: 'organization' },
          { id: 'dept-ENG', label: 'Engineering', type: 'department' }
        ],
        edges: [
          { from: 'org-testcorp.com', to: 'dept-ENG', type: 'has_department' }
        ]
      };

      organizationService.prepareOrganizationChartData.mockResolvedValue(mockChartData);

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/chart-data')
        .expect(200);

      expect(response.body).toEqual(mockChartData);
      expect(organizationService.prepareOrganizationChartData).toHaveBeenCalledWith('testcorp.com');
    });

    it('should handle errors when getting chart data', async () => {
      organizationService.prepareOrganizationChartData.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/chart-data')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get organization chart data' });
    });
  });

  describe('GET /api/intelligence/department/:code/statistics', () => {
    it('should return department statistics', async () => {
      const mockStats = {
        department: { code: 'ENG', name: 'Engineering' },
        totalPeople: 5,
        recentMeetings: 12,
        peopleEmails: ['john@test.com', 'jane@test.com']
      };

      organizationService.getDepartmentStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/intelligence/department/ENG/statistics')
        .expect(200);

      expect(response.body).toEqual(mockStats);
      expect(organizationService.getDepartmentStatistics).toHaveBeenCalledWith('ENG');
    });

    it('should return 404 when department not found', async () => {
      organizationService.getDepartmentStatistics.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/intelligence/department/NONEXISTENT/statistics')
        .expect(404);

      expect(response.body).toEqual({ error: 'Department not found' });
    });

    it('should handle errors when getting statistics', async () => {
      organizationService.getDepartmentStatistics.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/intelligence/department/ENG/statistics')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get department statistics' });
    });
  });

  describe('GET /api/intelligence/person/:email/colleagues', () => {
    it('should return colleagues list', async () => {
      const mockColleagues = [
        {
          colleague: { email: 'colleague@test.com', name: 'Colleague' },
          department: { code: 'ENG', name: 'Engineering' },
          manager: { email: 'manager@test.com', name: 'Manager' },
          reportingRelationship: { establishedAt: '2024-01-01T00:00:00Z' }
        }
      ];

      organizationService.findColleagues.mockResolvedValue(mockColleagues);

      const response = await request(app)
        .get('/api/intelligence/person/john@test.com/colleagues')
        .expect(200);

      expect(response.body).toEqual(mockColleagues);
      expect(organizationService.findColleagues).toHaveBeenCalledWith('john@test.com');
    });

    it('should handle errors when getting colleagues', async () => {
      organizationService.findColleagues.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/intelligence/person/john@test.com/colleagues')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get colleagues' });
    });
  });

  describe('GET /api/intelligence/organization/:domain/collaboration', () => {
    it('should return collaboration patterns with default days', async () => {
      const mockCollaboration = [
        {
          department1: 'Engineering',
          department2: 'Product',
          sharedMeetings: 8,
          people1Count: 3,
          people2Count: 2,
          sampleMeetings: ['Sprint Planning', 'Product Review']
        }
      ];

      organizationService.getCrossDepartmentCollaboration.mockResolvedValue(mockCollaboration);

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/collaboration')
        .expect(200);

      expect(response.body).toEqual(mockCollaboration);
      expect(organizationService.getCrossDepartmentCollaboration).toHaveBeenCalledWith('testcorp.com', 30);
    });

    it('should return collaboration patterns with custom days', async () => {
      const mockCollaboration = [];
      organizationService.getCrossDepartmentCollaboration.mockResolvedValue(mockCollaboration);

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/collaboration?days=60')
        .expect(200);

      expect(response.body).toEqual(mockCollaboration);
      expect(organizationService.getCrossDepartmentCollaboration).toHaveBeenCalledWith('testcorp.com', 60);
    });

    it('should handle errors when getting collaboration patterns', async () => {
      organizationService.getCrossDepartmentCollaboration.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/intelligence/organization/testcorp.com/collaboration')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get collaboration patterns' });
    });
  });

  describe('POST /api/intelligence/organization', () => {
    it('should create a new organization', async () => {
      const orgData = {
        name: 'Test Corp',
        domain: 'testcorp.com',
        description: 'A test corporation',
        industry: 'Technology'
      };

      const mockOrganization = { ...orgData, updatedAt: '2024-01-01T00:00:00Z' };
      organizationService.createOrganization.mockResolvedValue(mockOrganization);

      const response = await request(app)
        .post('/api/intelligence/organization')
        .send(orgData)
        .expect(201);

      expect(response.body).toEqual(mockOrganization);
      expect(organizationService.createOrganization).toHaveBeenCalledWith(orgData);
    });

    it('should handle errors when creating organization', async () => {
      organizationService.createOrganization.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/intelligence/organization')
        .send({ name: 'Test Corp' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create organization' });
    });
  });

  describe('POST /api/intelligence/department', () => {
    it('should create a new department', async () => {
      const deptData = {
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
        organizationDomain: 'testcorp.com'
      };

      const mockDepartment = { ...deptData, updatedAt: '2024-01-01T00:00:00Z' };
      organizationService.createDepartment.mockResolvedValue(mockDepartment);

      const response = await request(app)
        .post('/api/intelligence/department')
        .send(deptData)
        .expect(201);

      expect(response.body).toEqual(mockDepartment);
      expect(organizationService.createDepartment).toHaveBeenCalledWith(deptData);
    });

    it('should handle errors when creating department', async () => {
      organizationService.createDepartment.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/intelligence/department')
        .send({ name: 'Engineering' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create department' });
    });
  });

  describe('POST /api/intelligence/person/:email/department', () => {
    it('should assign person to department', async () => {
      const assignmentData = {
        departmentCode: 'ENG',
        role: 'Software Engineer',
        isManager: false
      };

      const mockAssignment = {
        person: { email: 'john@testcorp.com', name: 'John Doe' },
        relationship: { role: 'Software Engineer', isManager: false },
        department: { code: 'ENG', name: 'Engineering' }
      };

      organizationService.assignPersonToDepartment.mockResolvedValue(mockAssignment);

      const response = await request(app)
        .post('/api/intelligence/person/john@testcorp.com/department')
        .send(assignmentData)
        .expect(201);

      expect(response.body).toEqual(mockAssignment);
      expect(organizationService.assignPersonToDepartment).toHaveBeenCalledWith(
        'john@testcorp.com',
        'ENG',
        'Software Engineer',
        false
      );
    });

    it('should return 404 when person or department not found', async () => {
      organizationService.assignPersonToDepartment.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/intelligence/person/nonexistent@test.com/department')
        .send({ departmentCode: 'ENG', role: 'Engineer' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Person or department not found' });
    });

    it('should handle errors when assigning person to department', async () => {
      organizationService.assignPersonToDepartment.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/intelligence/person/john@test.com/department')
        .send({ departmentCode: 'ENG', role: 'Engineer' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to assign person to department' });
    });
  });

  describe('POST /api/intelligence/reporting-relationship', () => {
    it('should create reporting relationship', async () => {
      const relationshipData = {
        managerEmail: 'manager@testcorp.com',
        reportEmail: 'report@testcorp.com'
      };

      const mockRelationship = {
        manager: { email: 'manager@testcorp.com', name: 'Manager' },
        relationship: { establishedAt: '2024-01-01T00:00:00Z' },
        report: { email: 'report@testcorp.com', name: 'Report' }
      };

      organizationService.createReportingRelationship.mockResolvedValue(mockRelationship);

      const response = await request(app)
        .post('/api/intelligence/reporting-relationship')
        .send(relationshipData)
        .expect(201);

      expect(response.body).toEqual(mockRelationship);
      expect(organizationService.createReportingRelationship).toHaveBeenCalledWith(
        'manager@testcorp.com',
        'report@testcorp.com'
      );
    });

    it('should return 404 when manager or report not found', async () => {
      organizationService.createReportingRelationship.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/intelligence/reporting-relationship')
        .send({
          managerEmail: 'nonexistent@test.com',
          reportEmail: 'report@test.com'
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Manager or report not found' });
    });

    it('should handle errors when creating reporting relationship', async () => {
      organizationService.createReportingRelationship.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/intelligence/reporting-relationship')
        .send({
          managerEmail: 'manager@test.com',
          reportEmail: 'report@test.com'
        })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to create reporting relationship' });
    });
  });
});
