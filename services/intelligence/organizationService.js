/**
 * Organization Service
 * Handles organizational hierarchy, departments, and team structures
 */
const graphDatabaseService = require('./graph/graphDatabaseService');
const neo4j = require('neo4j-driver');

class OrganizationService {
  constructor() {
    this.graphDb = graphDatabaseService;
  }

  /**
   * Create or update an organization in the graph database
   * @param {Object} orgData - Organization data
   * @returns {Promise<Object>} - Created organization
   */
  async createOrganization(orgData) {
    const { name, domain, description, industry } = orgData;
    
    const cypher = `
      MERGE (org:Organization {domain: $domain})
      SET org.name = $name,
          org.description = $description,
          org.industry = $industry,
          org.updatedAt = datetime()
      RETURN org
    `;
    
    const params = { name, domain, description, industry };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    return result.records[0]?.get('org').properties;
  }

  /**
   * Create or update a department
   * @param {Object} deptData - Department data
   * @returns {Promise<Object>} - Created department
   */
  async createDepartment(deptData) {
    const { name, code, description, organizationDomain, parentDepartmentCode } = deptData;
    
    let cypher = `
      MATCH (org:Organization {domain: $organizationDomain})
      MERGE (dept:Department {code: $code})
      SET dept.name = $name,
          dept.description = $description,
          dept.updatedAt = datetime()
      MERGE (org)-[:HAS_DEPARTMENT]->(dept)
    `;
    
    const params = { name, code, description, organizationDomain };
    
    // Add parent department relationship if specified
    if (parentDepartmentCode) {
      cypher += `
        WITH dept
        MATCH (parentDept:Department {code: $parentDepartmentCode})
        MERGE (parentDept)-[:HAS_SUBDEPARTMENT]->(dept)
      `;
      params.parentDepartmentCode = parentDepartmentCode;
    }
    
    cypher += ` RETURN dept`;
    
    const result = await this.graphDb.executeQuery(cypher, params);
    return result.records[0]?.get('dept').properties;
  }

  /**
   * Associate a person with a department and role
   * @param {string} personEmail - Person's email
   * @param {string} departmentCode - Department code
   * @param {string} role - Person's role in the department
   * @param {boolean} isManager - Whether person manages the department
   * @returns {Promise<Object>} - Relationship data
   */
  async assignPersonToDepartment(personEmail, departmentCode, role, isManager = false) {
    const cypher = `
      MATCH (p:Person {email: $personEmail})
      MATCH (dept:Department {code: $departmentCode})
      MERGE (p)-[r:WORKS_IN]->(dept)
      SET r.role = $role,
          r.isManager = $isManager,
          r.assignedAt = datetime()
      RETURN p, r, dept
    `;
    
    const params = { personEmail, departmentCode, role, isManager };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        person: record.get('p').properties,
        relationship: record.get('r').properties,
        department: record.get('dept').properties
      };
    }
    
    return null;
  }

  /**
   * Create reporting relationship between two people
   * @param {string} managerEmail - Manager's email
   * @param {string} reportEmail - Direct report's email
   * @returns {Promise<Object>} - Relationship data
   */
  async createReportingRelationship(managerEmail, reportEmail) {
    const cypher = `
      MATCH (manager:Person {email: $managerEmail})
      MATCH (report:Person {email: $reportEmail})
      MERGE (report)-[r:REPORTS_TO]->(manager)
      SET r.establishedAt = datetime()
      RETURN manager, r, report
    `;
    
    const params = { managerEmail, reportEmail };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        manager: record.get('manager').properties,
        relationship: record.get('r').properties,
        report: record.get('report').properties
      };
    }
    
    return null;
  }

  /**
   * Get organizational hierarchy for visualization
   * @param {string} organizationDomain - Organization domain
   * @returns {Promise<Object>} - Hierarchical organization data
   */
  async getOrganizationalHierarchy(organizationDomain) {
    const cypher = `
      MATCH (org:Organization {domain: $organizationDomain})
      OPTIONAL MATCH (org)-[:HAS_DEPARTMENT]->(dept:Department)
      OPTIONAL MATCH (dept)<-[:WORKS_IN]-(person:Person)
      OPTIONAL MATCH (person)-[reports:REPORTS_TO]->(manager:Person)
      RETURN org, dept, person, manager, reports
      ORDER BY dept.name, person.name
    `;
    
    const params = { organizationDomain };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    // Process results into hierarchical structure
    const hierarchy = {
      organization: null,
      departments: new Map(),
      people: new Map(),
      reportingRelationships: []
    };
    
    result.records.forEach(record => {
      // Set organization data
      if (record.get('org') && !hierarchy.organization) {
        hierarchy.organization = record.get('org').properties;
      }
      
      // Add departments
      const dept = record.get('dept');
      if (dept && !hierarchy.departments.has(dept.properties.code)) {
        hierarchy.departments.set(dept.properties.code, {
          ...dept.properties,
          people: []
        });
      }
      
      // Add people
      const person = record.get('person');
      if (person) {
        const personData = person.properties;
        hierarchy.people.set(personData.email, personData);
        
        // Associate person with department
        if (dept) {
          const deptData = hierarchy.departments.get(dept.properties.code);
          if (!deptData.people.find(p => p.email === personData.email)) {
            deptData.people.push(personData);
          }
        }
        
        // Add reporting relationships
        const manager = record.get('manager');
        const reportsRel = record.get('reports');
        if (manager && reportsRel) {
          hierarchy.reportingRelationships.push({
            reportEmail: personData.email,
            managerEmail: manager.properties.email,
            relationship: reportsRel.properties
          });
        }
      }
    });
    
    return {
      organization: hierarchy.organization,
      departments: Array.from(hierarchy.departments.values()),
      people: Array.from(hierarchy.people.values()),
      reportingRelationships: hierarchy.reportingRelationships
    };
  }

  /**
   * Get department statistics and metrics
   * @param {string} departmentCode - Department code
   * @returns {Promise<Object>} - Department statistics
   */
  async getDepartmentStatistics(departmentCode) {
    const cypher = `
      MATCH (dept:Department {code: $departmentCode})
      OPTIONAL MATCH (dept)<-[:WORKS_IN]-(person:Person)
      OPTIONAL MATCH (person)-[:ATTENDED|ORGANIZED]->(meeting:Meeting)
      WHERE meeting.startTime >= datetime() - duration('P30D')
      RETURN dept,
             count(DISTINCT person) as totalPeople,
             count(DISTINCT meeting) as recentMeetings,
             collect(DISTINCT person.email) as peopleEmails
    `;
    
    const params = { departmentCode };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        department: record.get('dept').properties,
        totalPeople: record.get('totalPeople').toNumber(),
        recentMeetings: record.get('recentMeetings').toNumber(),
        peopleEmails: record.get('peopleEmails')
      };
    }
    
    return null;
  }

  /**
   * Find people in the same department
   * @param {string} personEmail - Person's email
   * @returns {Promise<Array>} - List of colleagues
   */
  async findColleagues(personEmail) {
    const cypher = `
      MATCH (person:Person {email: $personEmail})-[:WORKS_IN]->(dept:Department)
      MATCH (colleague:Person)-[:WORKS_IN]->(dept)
      WHERE colleague.email <> $personEmail
      OPTIONAL MATCH (colleague)-[reports:REPORTS_TO]->(manager:Person)
      RETURN colleague, dept, manager, reports
      ORDER BY colleague.name
    `;
    
    const params = { personEmail };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    return result.records.map(record => ({
      colleague: record.get('colleague').properties,
      department: record.get('dept').properties,
      manager: record.get('manager')?.properties,
      reportingRelationship: record.get('reports')?.properties
    }));
  }

  /**
   * Get cross-department collaboration patterns
   * @param {string} organizationDomain - Organization domain
   * @param {number} days - Number of days to analyze (default: 30)
   * @returns {Promise<Array>} - Collaboration patterns between departments
   */
  async getCrossDepartmentCollaboration(organizationDomain, days = 30) {
    const cypher = `
      MATCH (org:Organization {domain: $organizationDomain})-[:HAS_DEPARTMENT]->(dept1:Department)
      MATCH (org)-[:HAS_DEPARTMENT]->(dept2:Department)
      WHERE dept1.code < dept2.code
      MATCH (person1:Person)-[:WORKS_IN]->(dept1)
      MATCH (person2:Person)-[:WORKS_IN]->(dept2)
      MATCH (person1)-[:ATTENDED|ORGANIZED]->(meeting:Meeting)<-[:ATTENDED|ORGANIZED]-(person2)
      WHERE meeting.startTime >= datetime() - duration({days: $days})
      RETURN dept1.name as department1,
             dept2.name as department2,
             count(DISTINCT meeting) as sharedMeetings,
             count(DISTINCT person1) as people1Count,
             count(DISTINCT person2) as people2Count,
             collect(DISTINCT meeting.title)[0..5] as sampleMeetings
      ORDER BY sharedMeetings DESC
      LIMIT 20
    `;
    
    const params = { organizationDomain, days: neo4j.int(days) };
    const result = await this.graphDb.executeQuery(cypher, params);
    
    return result.records.map(record => ({
      department1: record.get('department1'),
      department2: record.get('department2'),
      sharedMeetings: record.get('sharedMeetings').toNumber(),
      people1Count: record.get('people1Count').toNumber(),
      people2Count: record.get('people2Count').toNumber(),
      sampleMeetings: record.get('sampleMeetings')
    }));
  }

  /**
   * Prepare visualization data for organizational chart
   * @param {string} organizationDomain - Organization domain
   * @returns {Promise<Object>} - Visualization-ready data
   */
  async prepareOrganizationChartData(organizationDomain) {
    const hierarchy = await this.getOrganizationalHierarchy(organizationDomain);
    
    // Create nodes and edges for visualization
    const nodes = [];
    const edges = [];
    
    // Add organization node
    if (hierarchy.organization) {
      nodes.push({
        id: `org-${hierarchy.organization.domain}`,
        label: hierarchy.organization.name,
        type: 'organization',
        data: hierarchy.organization
      });
    }
    
    // Add department nodes
    hierarchy.departments.forEach(dept => {
      nodes.push({
        id: `dept-${dept.code}`,
        label: dept.name,
        type: 'department',
        data: dept
      });
      
      // Connect to organization
      if (hierarchy.organization) {
        edges.push({
          from: `org-${hierarchy.organization.domain}`,
          to: `dept-${dept.code}`,
          type: 'has_department'
        });
      }
    });
    
    // Add person nodes
    hierarchy.people.forEach(person => {
      nodes.push({
        id: `person-${person.email}`,
        label: person.name || person.email,
        type: 'person',
        data: person
      });
    });
    
    // Add reporting relationship edges
    hierarchy.reportingRelationships.forEach(rel => {
      edges.push({
        from: `person-${rel.reportEmail}`,
        to: `person-${rel.managerEmail}`,
        type: 'reports_to',
        data: rel.relationship
      });
    });
    
    return { nodes, edges };
  }
}

module.exports = new OrganizationService();
