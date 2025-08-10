/**
 * Intelligence API Routes
 * Provides endpoints for accessing meeting intelligence data
 */
const express = require('express');
const router = express.Router();
const intelligenceService = require('../services/intelligenceService');
const llmQueryService = require('../services/intelligence/llm/llmQueryService');
const organizationService = require('../services/intelligence/organizationService');
const { ensureAuth } = require('../middleware/auth');

/**
 * @route GET /api/intelligence/status
 * @description Get the status of the intelligence processing
 * @access Private
 */
router.get('/status', ensureAuth, async (req, res) => {
  try {
    const status = intelligenceService.getProcessingStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting intelligence status:', error);
    res.status(500).json({ error: 'Failed to get intelligence status' });
  }
});

/**
 * @route POST /api/intelligence/process
 * @description Start processing the user's calendar data
 * @access Private
 */
router.post('/process', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    
    if (!user.tokens) {
      return res.status(400).json({ error: 'User tokens not available' });
    }
    
    const result = await intelligenceService.startCalendarProcessing(
      user.tokens,
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        photoUrl: user.photoUrl
      }
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error starting intelligence processing:', error);
    res.status(500).json({ error: 'Failed to start intelligence processing' });
  }
});

/**
 * @route GET /api/intelligence/meetings
 * @description Get recent meetings
 * @access Private
 */
router.get('/meetings', ensureAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 10, 10);
    const meetings = await intelligenceService.getRecentMeetings(limit);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting recent meetings:', error);
    res.status(500).json({ error: 'Failed to get recent meetings' });
  }
});

/**
 * @route GET /api/intelligence/meetings/:id/participants
 * @description Get participants for a specific meeting
 * @access Private
 */
router.get('/meetings/:id/participants', ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const participants = await intelligenceService.getMeetingParticipants(id);
    res.json(participants);
  } catch (error) {
    console.error('Error getting meeting participants:', error);
    res.status(500).json({ error: 'Failed to get meeting participants' });
  }
});

/**
 * @route GET /api/intelligence/people
 * @description Get meetings for a person (defaults to current user)
 * @access Private
 */
router.get('/people', ensureAuth, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;
    const limit = parseInt(req.query.limit || 10, 10);
    const meetings = await intelligenceService.getMeetingsForPerson(email, limit);
    res.json(meetings);
  } catch (error) {
    console.error('Error getting meetings for person:', error);
    res.status(500).json({ error: 'Failed to get meetings for person' });
  }
});

/**
 * @route POST /api/intelligence/query
 * @description Process natural language queries about meeting intelligence
 * @access Private
 */
router.post('/query', ensureAuth, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Query is required and must be a non-empty string' 
      });
    }
    
    // Build context for the query
    const context = {
      userEmail: req.user.email,
      userId: req.user.id,
      userName: req.user.displayName || req.user.email.split('@')[0]
    };
    
    console.log(`[Intelligence API] Processing natural language query from ${context.userEmail}: "${query}"`);
    
    // Process the query using the LLM query service
    const result = await llmQueryService.processQuery(query.trim(), context);
    
    // Add metadata to the response
    result.metadata = {
      processedAt: new Date().toISOString(),
      user: context.userEmail,
      processingTime: Date.now() - Date.now() // This would be calculated properly in production
    };
    
    console.log(`[Intelligence API] Query processed successfully. Intent: ${result.intent}, Results: ${result.results?.totalResults || 0}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error processing natural language query:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/intelligence/query/intents
 * @description Get available query intents and examples
 * @access Private
 */
router.get('/query/intents', ensureAuth, async (req, res) => {
  try {
    const llmService = require('../services/intelligence/llm/llmService');
    const intents = llmService.getAvailableIntents();
    res.json(intents);
  } catch (error) {
    console.error('Error getting available intents:', error);
    res.status(500).json({ error: 'Failed to get available intents' });
  }
});

// ============================================================================
// ORGANIZATIONAL INTELLIGENCE ENDPOINTS
// ============================================================================

/**
 * @route GET /api/intelligence/organization/:domain/hierarchy
 * @description Get organizational hierarchy for visualization
 * @access Private
 */
router.get('/organization/:domain/hierarchy', ensureAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const hierarchy = await organizationService.getOrganizationalHierarchy(domain);
    res.json(hierarchy);
  } catch (error) {
    console.error('Error getting organizational hierarchy:', error);
    res.status(500).json({ error: 'Failed to get organizational hierarchy' });
  }
});

/**
 * @route GET /api/intelligence/organization/:domain/chart-data
 * @description Get organization chart visualization data
 * @access Private
 */
router.get('/organization/:domain/chart-data', ensureAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const chartData = await organizationService.prepareOrganizationChartData(domain);
    res.json(chartData);
  } catch (error) {
    console.error('Error getting organization chart data:', error);
    res.status(500).json({ error: 'Failed to get organization chart data' });
  }
});

/**
 * @route GET /api/intelligence/department/:code/statistics
 * @description Get department statistics and metrics
 * @access Private
 */
router.get('/department/:code/statistics', ensureAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const stats = await organizationService.getDepartmentStatistics(code);
    
    if (!stats) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting department statistics:', error);
    res.status(500).json({ error: 'Failed to get department statistics' });
  }
});

/**
 * @route GET /api/intelligence/person/:email/colleagues
 * @description Get colleagues for a person
 * @access Private
 */
router.get('/person/:email/colleagues', ensureAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const colleagues = await organizationService.findColleagues(email);
    res.json(colleagues);
  } catch (error) {
    console.error('Error getting colleagues:', error);
    res.status(500).json({ error: 'Failed to get colleagues' });
  }
});

/**
 * @route GET /api/intelligence/organization/:domain/collaboration
 * @description Get cross-department collaboration patterns
 * @access Private
 */
router.get('/organization/:domain/collaboration', ensureAuth, async (req, res) => {
  try {
    const { domain } = req.params;
    const { days = 30 } = req.query;
    
    const collaboration = await organizationService.getCrossDepartmentCollaboration(
      domain, 
      parseInt(days)
    );
    
    res.json(collaboration);
  } catch (error) {
    console.error('Error getting collaboration patterns:', error);
    res.status(500).json({ error: 'Failed to get collaboration patterns' });
  }
});

/**
 * @route POST /api/intelligence/organization
 * @description Create or update an organization
 * @access Private
 */
router.post('/organization', ensureAuth, async (req, res) => {
  try {
    const orgData = req.body;
    const organization = await organizationService.createOrganization(orgData);
    res.status(201).json(organization);
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

/**
 * @route POST /api/intelligence/department
 * @description Create or update a department
 * @access Private
 */
router.post('/department', ensureAuth, async (req, res) => {
  try {
    const deptData = req.body;
    const department = await organizationService.createDepartment(deptData);
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

/**
 * @route POST /api/intelligence/person/:email/department
 * @description Assign a person to a department
 * @access Private
 */
router.post('/person/:email/department', ensureAuth, async (req, res) => {
  try {
    const { email } = req.params;
    const { departmentCode, role, isManager = false } = req.body;
    
    const assignment = await organizationService.assignPersonToDepartment(
      email, 
      departmentCode, 
      role, 
      isManager
    );
    
    if (!assignment) {
      return res.status(404).json({ error: 'Person or department not found' });
    }
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error assigning person to department:', error);
    res.status(500).json({ error: 'Failed to assign person to department' });
  }
});

/**
 * @route POST /api/intelligence/reporting-relationship
 * @description Create a reporting relationship between two people
 * @access Private
 */
router.post('/reporting-relationship', ensureAuth, async (req, res) => {
  try {
    const { managerEmail, reportEmail } = req.body;
    
    const relationship = await organizationService.createReportingRelationship(
      managerEmail, 
      reportEmail
    );
    
    if (!relationship) {
      return res.status(404).json({ error: 'Manager or report not found' });
    }
    
    res.status(201).json(relationship);
  } catch (error) {
    console.error('Error creating reporting relationship:', error);
    res.status(500).json({ error: 'Failed to create reporting relationship' });
  }
});

// @desc    Get quick statistics for chat interface
// @route   GET /api/intelligence/stats/quick
router.get('/stats/quick', ensureAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1)); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday

    // Get quick stats from graph database
    const stats = await graphDatabaseService.executeQuery(`
      MATCH (p:Person {email: $userEmail})
      OPTIONAL MATCH (p)-[:ATTENDED|ORGANIZED]->(m:Meeting)
      WHERE m.startTime >= $weekStart AND m.startTime <= $weekEnd
      WITH p, count(DISTINCT m) as meetingsThisWeek
      
      OPTIONAL MATCH (p)-[:ATTENDED|ORGANIZED]->(allMeetings:Meeting)
      WITH p, meetingsThisWeek, count(DISTINCT allMeetings) as totalMeetings
      
      OPTIONAL MATCH (p)-[:ATTENDED|ORGANIZED]->(allMeetings)-[:HAS_DOCUMENT]->(d:Document)
      WITH p, meetingsThisWeek, totalMeetings, count(DISTINCT d) as documentsCount
      
      OPTIONAL MATCH (p)-[:ATTENDED|ORGANIZED]->(allMeetings)-[:ATTENDED|ORGANIZED]-(otherPeople:Person)
      WHERE otherPeople.email <> $userEmail
      
      RETURN {
        meetingsThisWeek: meetingsThisWeek,
        totalMeetings: totalMeetings,
        participantsCount: count(DISTINCT otherPeople),
        documentsCount: documentsCount
      } as stats
    `, {
      userEmail,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString()
    });

    const result = stats.records[0]?.get('stats') || {
      meetingsThisWeek: 0,
      totalMeetings: 0,
      participantsCount: 0,
      documentsCount: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching quick stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      meetingsThisWeek: '-',
      totalMeetings: '-',
      participantsCount: '-',
      documentsCount: '-'
    });
  }
});

module.exports = router;
