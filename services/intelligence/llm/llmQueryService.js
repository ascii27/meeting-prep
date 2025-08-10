/**
 * LLM Query Service
 * Handles translation of natural language queries into Neo4j Cypher queries
 */
const neo4j = require('neo4j-driver');
const llmService = require('./llmService');
const graphDatabaseService = require('../graph/graphDatabaseService');

class LLMQueryService {
  constructor() {
    this.queryHandlers = {
      // Core query types
      find_meetings: this.handleFindMeetings.bind(this),
      get_participants: this.handleGetParticipants.bind(this),
      find_documents: this.handleFindDocuments.bind(this),
      analyze_relationships: this.handleAnalyzeRelationships.bind(this),
      general_query: this.handleGeneralQuery.bind(this),
      
      // Advanced organizational intelligence queries
      analyze_collaboration: this.handleAnalyzeCollaboration.bind(this),
      find_frequent_collaborators: this.handleFindFrequentCollaborators.bind(this),
      analyze_meeting_patterns: this.handleAnalyzeMeetingPatterns.bind(this),
      get_department_insights: this.handleGetDepartmentInsights.bind(this),
      analyze_topic_trends: this.handleAnalyzeTopicTrends.bind(this),
      find_meeting_conflicts: this.handleFindMeetingConflicts.bind(this),
      get_productivity_insights: this.handleGetProductivityInsights.bind(this),
      analyze_communication_flow: this.handleAnalyzeCommunicationFlow.bind(this),
      get_meeting_content: this.handleGetMeetingContent.bind(this)
    };
  }

  /**
   * Process a natural language query end-to-end
   * @param {string} query - User's natural language query
   * @param {Object} context - Additional context (user info, etc.)
   * @returns {Promise<Object>} - Complete response with data and natural language answer
   */
  async processQuery(query, context = {}) {
    try {
      console.log(`[LLMQueryService] Processing query: "${query}"`);
      
      // Step 1: Parse the natural language query
      const parsedQuery = await llmService.processQuery(query, context);
      
      // Step 2: Execute the appropriate database queries
      const queryResults = await this.executeQuery(parsedQuery, context);
      
      // Step 3: Generate a natural language response
      const naturalLanguageResponse = await llmService.generateResponse(
        query, 
        queryResults, 
        context
      );
      
      // Extract text from response object if it's an object, otherwise use as-is
      const responseText = typeof naturalLanguageResponse === 'object' && naturalLanguageResponse.text
        ? naturalLanguageResponse.text
        : naturalLanguageResponse;

      return {
        query: query,
        intent: parsedQuery.intent,
        confidence: parsedQuery.confidence,
        results: queryResults,
        response: responseText,
        visualizations: naturalLanguageResponse.visualizations || [],
        followUps: naturalLanguageResponse.followUps || this.generateFollowUpSuggestions(parsedQuery, queryResults),
        suggestions: this.generateFollowUpSuggestions(parsedQuery, queryResults)
      };
      
    } catch (error) {
      console.error(`[LLMQueryService] Error processing query:`, error);
      return {
        query: query,
        error: error.message,
        response: "I'm sorry, I encountered an error while processing your query. Please try rephrasing your question or contact support if the issue persists."
      };
    }
  }

  /**
   * Execute database queries based on parsed intent
   * @param {Object} parsedQuery - Parsed query from LLM
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Query results
   */
  async executeQuery(parsedQuery, context) {
    const handler = this.queryHandlers[parsedQuery.intent];
    
    if (!handler) {
      throw new Error(`Unknown query intent: ${parsedQuery.intent}`);
    }
    
    console.log(`[LLMQueryService] Executing ${parsedQuery.intent} query`);
    return await handler(parsedQuery, context);
  }

  /**
   * Handle find_meetings queries
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Meeting results
   */
  async handleFindMeetings(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const conditions = [];
    const params = {};
    
    // Build Cypher query based on entities
    let cypher = `MATCH (m:Meeting)`;
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      cypher += `-[:ATTENDED|ORGANIZED]-(p:Person)`;
      conditions.push(`p.email IN $people OR p.name IN $people`);
      params.people = entities.people;
    } else if (parameters.userEmail) {
      // Filter by specific user email from parameters
      cypher += `-[:ATTENDED|ORGANIZED]-(p:Person)`;
      conditions.push(`p.email = $userEmail`);
      params.userEmail = parameters.userEmail;
      console.log(`[LLMQueryService] Filtering meetings for user: ${parameters.userEmail}`);
    }
    
    // Add timeframe filter if specified
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        conditions.push(`m.startTime >= $startTime AND m.startTime <= $endTime`);
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    // Add topic filter if specified
    if (entities.topics && entities.topics.length > 0) {
      cypher += `-[:DISCUSSED]-(t:Topic)`;
      conditions.push(`t.name IN $topics`);
      params.topics = entities.topics;
    }
    
    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Add RETURN and ordering
    cypher += ` RETURN DISTINCT m ORDER BY m.startTime DESC LIMIT $limit`;
    params.limit = neo4j.int(parseInt(parameters.limit) || 10);
    
    console.log(`[LLMQueryService] Executing Cypher: ${cypher}`);
    console.log(`[LLMQueryService] Parameters:`, params);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    console.log(`[LLMQueryService] Database result:`, {
      recordCount: result.records.length,
      summary: result.summary
    });
    
    const meetings = result.records.map(record => record.get('m').properties);
    console.log(`[LLMQueryService] Processed meetings:`, {
      count: meetings.length,
      meetings: meetings.slice(0, 3) // Log first 3 meetings for debugging
    });
    
    const queryResult = {
      type: 'meetings',
      data: meetings,
      totalResults: meetings.length,
      query: cypher,
      parameters: params
    };

    console.log(`[LLMQueryService] Returning query result:`, {
      type: queryResult.type,
      totalResults: queryResult.totalResults,
      dataCount: queryResult.data.length
    });

    return queryResult;
  }

  /**
   * Handle get_participants queries
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Participant results
   */
  async handleGetParticipants(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const conditions = [];
    const params = {};
    
    let cypher = `MATCH (p:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)`;
    
    // Add meeting filter if specified
    if (entities.meeting_types && entities.meeting_types.length > 0) {
      conditions.push(`any(type IN $meetingTypes WHERE m.title CONTAINS type)`);
      params.meetingTypes = entities.meeting_types;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        conditions.push(`m.startTime >= $startTime AND m.startTime <= $endTime`);
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    cypher += ` RETURN p, count(m) as meetingCount ORDER BY meetingCount DESC LIMIT $limit`;
    params.limit = neo4j.int(parseInt(parameters.limit) || 10);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const participants = result.records.map(record => ({
      ...record.get('p').properties,
      meetingCount: record.get('meetingCount').toNumber()
    }));
    
    return {
      type: 'participants',
      totalResults: participants.length,
      data: participants,
      query: cypher,
      parameters: params
    };
  }

  /**
   * Handle find_documents queries
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Document results
   */
  async handleFindDocuments(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const conditions = [];
    const params = {};
    
    let cypher = `MATCH (d:Document)<-[:HAS_DOCUMENT]-(m:Meeting)`;
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      cypher += `-[:ATTENDED|ORGANIZED]-(p:Person)`;
      conditions.push(`p.email IN $people OR p.name IN $people`);
      params.people = entities.people;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        conditions.push(`m.startTime >= $startTime AND m.startTime <= $endTime`);
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    // Add document name filter
    if (entities.documents && entities.documents.length > 0) {
      conditions.push(`any(doc IN $documents WHERE d.title CONTAINS doc)`);
      params.documents = entities.documents;
    }
    
    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    cypher += ` RETURN DISTINCT d, m.title as meetingTitle, m.startTime as meetingDate ORDER BY m.startTime DESC LIMIT $limit`;
    params.limit = neo4j.int(parseInt(parameters.limit) || 10);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const documents = result.records.map(record => ({
      ...record.get('d').properties,
      meetingTitle: record.get('meetingTitle'),
      meetingDate: record.get('meetingDate')
    }));
    
    return {
      type: 'documents',
      totalResults: documents.length,
      data: documents,
      query: cypher,
      parameters: params
    };
  }

  /**
   * Handle analyze_relationships queries
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Relationship analysis results
   */
  async handleAnalyzeRelationships(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    // Find collaboration patterns
    let cypher = `
      MATCH (p1:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)<-[:ATTENDED|ORGANIZED]-(p2:Person)
      WHERE p1 <> p2
    `;
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      cypher += ` AND (p1.email IN $people OR p1.name IN $people OR p2.email IN $people OR p2.name IN $people)`;
      params.people = entities.people;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        cypher += ` AND m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      RETURN p1.name as person1, p1.email as email1, 
             p2.name as person2, p2.email as email2, 
             count(m) as collaborationCount
      ORDER BY collaborationCount DESC 
      LIMIT $limit
    `;
    params.limit = neo4j.int(parseInt(parameters.limit) || 20);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const relationships = result.records.map(record => ({
      person1: {
        name: record.get('person1'),
        email: record.get('email1')
      },
      person2: {
        name: record.get('person2'),
        email: record.get('email2')
      },
      collaborationCount: record.get('collaborationCount').toNumber()
    }));
    
    return {
      type: 'relationships',
      totalResults: relationships.length,
      data: relationships,
      query: cypher,
      parameters: params
    };
  }

  /**
   * Handle general queries
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - General query results
   */
  async handleGeneralQuery(parsedQuery, context) {
    // For general queries, provide summary statistics
    const summaryQueries = [
      {
        name: 'totalMeetings',
        cypher: 'MATCH (m:Meeting) RETURN count(m) as count'
      },
      {
        name: 'totalParticipants',
        cypher: 'MATCH (p:Person) RETURN count(p) as count'
      },
      {
        name: 'totalDocuments',
        cypher: 'MATCH (d:Document) RETURN count(d) as count'
      },
      {
        name: 'recentMeetings',
        cypher: 'MATCH (m:Meeting) WHERE m.startTime >= $recentDate RETURN count(m) as count',
        params: { recentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
      }
    ];
    
    const results = {};
    
    for (const query of summaryQueries) {
      try {
        const result = await graphDatabaseService.executeQuery(query.cypher, query.params || {});
        results[query.name] = result.records[0].get('count').toNumber();
      } catch (error) {
        console.warn(`[LLMQueryService] Failed to execute summary query ${query.name}:`, error);
        results[query.name] = 0;
      }
    }
    
    return {
      type: 'summary',
      totalResults: 1,
      data: results
    };
  }

  /**
   * Enhanced timeframe parsing with support for natural language expressions
   * @param {string} timeframe - Natural language timeframe
   * @returns {Object|null} - Start and end dates with metadata
   */
  parseTimeframe(timeframe) {
    const now = new Date();
    const timeframeLower = timeframe.toLowerCase().trim();
    
    // Today variations
    if (timeframeLower.match(/\b(today|this day)\b/)) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString(), type: 'day', description: 'today' };
    }
    
    // Yesterday variations
    if (timeframeLower.match(/\b(yesterday|last day)\b/)) {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString(), type: 'day', description: 'yesterday' };
    }
    
    // This week variations
    if (timeframeLower.match(/\b(this week|current week)\b/)) {
      const start = new Date(now);
      const dayOfWeek = start.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as start of week
      start.setDate(start.getDate() + mondayOffset);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString(), type: 'week', description: 'this week' };
    }
    
    // Last week variations
    if (timeframeLower.match(/\b(last week|previous week|past week)\b/)) {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString(), type: 'week', description: 'last 7 days' };
    }
    
    // This month variations
    if (timeframeLower.match(/\b(this month|current month)\b/)) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString(), type: 'month', description: 'this month' };
    }
    
    // Last month variations
    if (timeframeLower.match(/\b(last month|previous month|past month)\b/)) {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString(), type: 'month', description: 'last 30 days' };
    }
    
    // Recent/lately variations (default to last 7 days)
    if (timeframeLower.match(/\b(recent|recently|lately|past few days)\b/)) {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString(), type: 'recent', description: 'recent (last 7 days)' };
    }
    
    // Specific day patterns (e.g., "Monday", "last Friday")
    const dayMatch = timeframeLower.match(/\b(last\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (dayMatch) {
      const isLast = !!dayMatch[1];
      const dayName = dayMatch[2];
      const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayName);
      
      const start = new Date(now);
      const currentDay = start.getDay();
      let daysBack = currentDay - targetDay;
      
      if (isLast || daysBack <= 0) {
        daysBack += 7;
      }
      
      start.setDate(start.getDate() - daysBack);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      
      return { 
        start: start.toISOString(), 
        end: end.toISOString(), 
        type: 'day', 
        description: `${isLast ? 'last ' : ''}${dayName}` 
      };
    }
    
    // Number-based patterns (e.g., "last 3 days", "past 2 weeks")
    const numberMatch = timeframeLower.match(/\b(last|past)\s+(\d+)\s+(day|days|week|weeks|month|months)\b/);
    if (numberMatch) {
      const number = parseInt(numberMatch[2]);
      const unit = numberMatch[3];
      const start = new Date(now);
      
      if (unit.startsWith('day')) {
        start.setDate(start.getDate() - number);
      } else if (unit.startsWith('week')) {
        start.setDate(start.getDate() - (number * 7));
      } else if (unit.startsWith('month')) {
        start.setMonth(start.getMonth() - number);
      }
      
      start.setHours(0, 0, 0, 0);
      return { 
        start: start.toISOString(), 
        end: now.toISOString(), 
        type: unit.startsWith('day') ? 'days' : unit.startsWith('week') ? 'weeks' : 'months',
        description: `last ${number} ${unit}` 
      };
    }
    
    return null;
  }

  /**
   * Generate follow-up suggestions based on query results
   * @param {Object} parsedQuery - Original parsed query
   * @param {Object} queryResults - Query results
   * @returns {Array} - Array of suggested follow-up queries
   */
  generateFollowUpSuggestions(parsedQuery, queryResults) {
    const suggestions = [];
    
    switch (parsedQuery.intent) {
      case 'find_meetings':
        if (queryResults.totalResults > 0) {
          suggestions.push('Who were the most frequent participants in these meetings?');
          suggestions.push('What documents are associated with these meetings?');
        }
        break;
        
      case 'get_participants':
        if (queryResults.totalResults > 0) {
          suggestions.push('What meetings did these people attend together?');
          suggestions.push('Show me collaboration patterns between these participants');
        }
        break;
        
      case 'find_documents':
        if (queryResults.totalResults > 0) {
          suggestions.push('Who has access to these documents?');
          suggestions.push('What topics are discussed in these documents?');
        }
        break;
        
      case 'analyze_relationships':
        suggestions.push('Show me meetings between the most collaborative pairs');
        suggestions.push('What topics do these people discuss most often?');
        break;
    }
    
    return suggestions;
  }

  /**
   * Analyze collaboration patterns between people
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Collaboration analysis results
   */
  async handleAnalyzeCollaboration(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    let cypher = `
      MATCH (p1:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)<-[:ATTENDED|ORGANIZED]-(p2:Person)
      WHERE p1.email <> p2.email
    `;
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      cypher += ` AND (p1.email IN $people OR p2.email IN $people)`;
      params.people = entities.people;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        cypher += ` AND m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      WITH p1, p2, count(DISTINCT m) as collaborationCount,
           collect(DISTINCT m.title) as meetingTitles
      WHERE collaborationCount >= 2
      RETURN p1.name as person1, p1.email as email1,
             p2.name as person2, p2.email as email2,
             collaborationCount, meetingTitles
      ORDER BY collaborationCount DESC
      LIMIT $limit
    `;
    
    params.limit = neo4j.int(parseInt(parameters.limit) || 20);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const collaborations = result.records.map(record => ({
      person1: { name: record.get('person1'), email: record.get('email1') },
      person2: { name: record.get('person2'), email: record.get('email2') },
      collaborationCount: record.get('collaborationCount').toNumber(),
      meetingTitles: record.get('meetingTitles')
    }));
    
    return {
      type: 'collaboration_analysis',
      totalResults: collaborations.length,
      data: collaborations,
      insights: {
        strongestCollaboration: collaborations[0],
        averageCollaborations: collaborations.reduce((sum, c) => sum + c.collaborationCount, 0) / collaborations.length
      }
    };
  }

  /**
   * Find frequent collaborators for a specific person
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Frequent collaborators results
   */
  async handleFindFrequentCollaborators(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const targetPerson = entities.people?.[0] || context.userEmail;
    
    const cypher = `
      MATCH (target:Person {email: $targetPerson})-[:ATTENDED|ORGANIZED]->(m:Meeting)<-[:ATTENDED|ORGANIZED]-(collaborator:Person)
      WHERE target.email <> collaborator.email
      WITH collaborator, count(DISTINCT m) as meetingCount,
           collect(DISTINCT m.title)[0..5] as recentMeetings
      WHERE meetingCount >= 3
      RETURN collaborator.name as name, collaborator.email as email,
             meetingCount, recentMeetings
      ORDER BY meetingCount DESC
      LIMIT $limit
    `;
    
    const params = {
      targetPerson,
      limit: neo4j.int(parseInt(parameters.limit) || 10)
    };
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const collaborators = result.records.map(record => ({
      name: record.get('name'),
      email: record.get('email'),
      meetingCount: record.get('meetingCount').toNumber(),
      recentMeetings: record.get('recentMeetings')
    }));
    
    return {
      type: 'frequent_collaborators',
      totalResults: collaborators.length,
      data: collaborators,
      targetPerson
    };
  }

  /**
   * Analyze meeting patterns and trends
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Meeting patterns analysis
   */
  async handleAnalyzeMeetingPatterns(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    // Get meeting frequency by day of week
    let cypher = `
      MATCH (m:Meeting)
    `;
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        cypher += ` WHERE m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      WITH m, 
           CASE datetime(m.startTime).dayOfWeek
             WHEN 1 THEN 'Monday'
             WHEN 2 THEN 'Tuesday'
             WHEN 3 THEN 'Wednesday'
             WHEN 4 THEN 'Thursday'
             WHEN 5 THEN 'Friday'
             WHEN 6 THEN 'Saturday'
             WHEN 7 THEN 'Sunday'
           END as dayOfWeek,
           datetime(m.startTime).hour as hour
      RETURN dayOfWeek, hour, count(m) as meetingCount
      ORDER BY dayOfWeek, hour
    `;
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const patterns = result.records.map(record => ({
      dayOfWeek: record.get('dayOfWeek'),
      hour: record.get('hour').toNumber(),
      meetingCount: record.get('meetingCount').toNumber()
    }));
    
    // Analyze patterns
    const dayTotals = {};
    const hourTotals = {};
    
    patterns.forEach(p => {
      dayTotals[p.dayOfWeek] = (dayTotals[p.dayOfWeek] || 0) + p.meetingCount;
      hourTotals[p.hour] = (hourTotals[p.hour] || 0) + p.meetingCount;
    });
    
    const busiestDay = Object.keys(dayTotals).reduce((a, b) => dayTotals[a] > dayTotals[b] ? a : b);
    const busiestHour = Object.keys(hourTotals).reduce((a, b) => hourTotals[a] > hourTotals[b] ? a : b);
    
    return {
      type: 'meeting_patterns',
      totalResults: patterns.length,
      data: patterns,
      insights: {
        busiestDay,
        busiestHour: parseInt(busiestHour),
        dayTotals,
        hourTotals
      }
    };
  }

  /**
   * Get department-specific insights
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Department insights
   */
  async handleGetDepartmentInsights(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    let cypher = `
      MATCH (p:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)
    `;
    
    // Add department filter if specified
    if (entities.departments && entities.departments.length > 0) {
      cypher += ` WHERE p.department IN $departments`;
      params.departments = entities.departments;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        const whereClause = params.departments ? ' AND' : ' WHERE';
        cypher += `${whereClause} m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      WITH p.department as department, count(DISTINCT m) as meetingCount,
           count(DISTINCT p) as peopleCount,
           avg(duration.inSeconds(datetime(m.startTime), datetime(m.endTime)).totalSeconds / 3600.0) as avgMeetingHours
      WHERE department IS NOT NULL
      RETURN department, meetingCount, peopleCount, avgMeetingHours
      ORDER BY meetingCount DESC
    `;
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const departments = result.records.map(record => ({
      department: record.get('department'),
      meetingCount: record.get('meetingCount').toNumber(),
      peopleCount: record.get('peopleCount').toNumber(),
      avgMeetingHours: record.get('avgMeetingHours') ? parseFloat(record.get('avgMeetingHours').toFixed(2)) : 0
    }));
    
    return {
      type: 'department_insights',
      totalResults: departments.length,
      data: departments,
      insights: {
        mostActiveDepartment: departments[0]?.department,
        totalDepartments: departments.length
      }
    };
  }

  /**
   * Analyze topic trends over time
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Topic trends analysis
   */
  async handleAnalyzeTopicTrends(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    let cypher = `
      MATCH (m:Meeting)-[:DISCUSSED]->(t:Topic)
    `;
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        cypher += ` WHERE m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      WITH t.name as topic, 
           count(DISTINCT m) as mentionCount,
           collect(DISTINCT date(datetime(m.startTime))) as mentionDates
      WHERE mentionCount >= 2
      RETURN topic, mentionCount, mentionDates
      ORDER BY mentionCount DESC
      LIMIT $limit
    `;
    
    params.limit = neo4j.int(parseInt(parameters.limit) || 15);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const topics = result.records.map(record => ({
      topic: record.get('topic'),
      mentionCount: record.get('mentionCount').toNumber(),
      mentionDates: record.get('mentionDates')
    }));
    
    return {
      type: 'topic_trends',
      totalResults: topics.length,
      data: topics,
      insights: {
        trendingTopic: topics[0]?.topic,
        totalTopics: topics.length
      }
    };
  }

  /**
   * Find meeting conflicts and scheduling issues
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Meeting conflicts analysis
   */
  async handleFindMeetingConflicts(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const targetPerson = entities.people?.[0] || context.userEmail;
    
    const cypher = `
      MATCH (p:Person {email: $targetPerson})-[:ATTENDED|ORGANIZED]->(m1:Meeting),
            (p)-[:ATTENDED|ORGANIZED]->(m2:Meeting)
      WHERE m1 <> m2 
        AND datetime(m1.startTime) < datetime(m2.endTime)
        AND datetime(m2.startTime) < datetime(m1.endTime)
        AND m1.startTime >= $recentDate
      RETURN m1.title as meeting1, m1.startTime as start1, m1.endTime as end1,
             m2.title as meeting2, m2.startTime as start2, m2.endTime as end2
      ORDER BY m1.startTime DESC
      LIMIT $limit
    `;
    
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30); // Last 30 days
    
    const params = {
      targetPerson,
      recentDate: recentDate.toISOString(),
      limit: neo4j.int(parseInt(parameters.limit) || 20)
    };
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const conflicts = result.records.map(record => ({
      meeting1: {
        title: record.get('meeting1'),
        startTime: record.get('start1'),
        endTime: record.get('end1')
      },
      meeting2: {
        title: record.get('meeting2'),
        startTime: record.get('start2'),
        endTime: record.get('end2')
      }
    }));
    
    return {
      type: 'meeting_conflicts',
      totalResults: conflicts.length,
      data: conflicts,
      targetPerson
    };
  }

  /**
   * Get productivity insights based on meeting patterns
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Productivity insights
   */
  async handleGetProductivityInsights(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const targetPerson = entities.people?.[0] || context.userEmail;
    
    const cypher = `
      MATCH (p:Person {email: $targetPerson})-[:ATTENDED|ORGANIZED]->(m:Meeting)
      WHERE m.startTime >= $startDate
      WITH m, 
           duration.inSeconds(datetime(m.startTime), datetime(m.endTime)).totalSeconds / 3600.0 as durationHours,
           datetime(m.startTime).hour as hour,
           datetime(m.startTime).dayOfWeek as dayOfWeek
      RETURN 
        count(m) as totalMeetings,
        sum(durationHours) as totalMeetingHours,
        avg(durationHours) as avgMeetingDuration,
        collect(DISTINCT hour) as meetingHours,
        collect(DISTINCT dayOfWeek) as meetingDays
    `;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    
    const params = {
      targetPerson,
      startDate: startDate.toISOString()
    };
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const record = result.records[0];
    
    if (!record) {
      return {
        type: 'productivity_insights',
        totalResults: 0,
        data: {},
        targetPerson
      };
    }
    
    const insights = {
      totalMeetings: record.get('totalMeetings').toNumber(),
      totalMeetingHours: parseFloat(record.get('totalMeetingHours').toFixed(2)),
      avgMeetingDuration: parseFloat(record.get('avgMeetingDuration').toFixed(2)),
      meetingHours: record.get('meetingHours').map(h => h.toNumber()),
      meetingDays: record.get('meetingDays').map(d => d.toNumber()),
      meetingsPerDay: parseFloat((record.get('totalMeetings').toNumber() / 30).toFixed(2)),
      focusTimePercentage: parseFloat((((24 * 30) - record.get('totalMeetingHours')) / (24 * 30) * 100).toFixed(1))
    };
    
    return {
      type: 'productivity_insights',
      totalResults: 1,
      data: insights,
      targetPerson
    };
  }

  /**
   * Analyze communication flow patterns
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} - Communication flow analysis
   */
  async handleAnalyzeCommunicationFlow(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const params = {};
    
    let cypher = `
      MATCH (organizer:Person)-[:ORGANIZED]->(m:Meeting)<-[:ATTENDED]-(attendee:Person)
      WHERE organizer.email <> attendee.email
    `;
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        cypher += ` AND m.startTime >= $startTime AND m.startTime <= $endTime`;
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    cypher += `
      WITH organizer, attendee, count(DISTINCT m) as meetingsOrganized
      WHERE meetingsOrganized >= 2
      RETURN organizer.name as organizerName, organizer.email as organizerEmail,
             attendee.name as attendeeName, attendee.email as attendeeEmail,
             meetingsOrganized
      ORDER BY meetingsOrganized DESC
      LIMIT $limit
    `;
    
    params.limit = neo4j.int(parseInt(parameters.limit) || 20);
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    const flows = result.records.map(record => ({
      organizer: {
        name: record.get('organizerName'),
        email: record.get('organizerEmail')
      },
      attendee: {
        name: record.get('attendeeName'),
        email: record.get('attendeeEmail')
      },
      meetingsOrganized: record.get('meetingsOrganized').toNumber()
    }));
    
    // Analyze communication patterns
    const organizerStats = {};
    flows.forEach(flow => {
      const email = flow.organizer.email;
      if (!organizerStats[email]) {
        organizerStats[email] = {
          name: flow.organizer.name,
          email: email,
          totalMeetingsOrganized: 0,
          uniqueAttendees: new Set()
        };
      }
      organizerStats[email].totalMeetingsOrganized += flow.meetingsOrganized;
      organizerStats[email].uniqueAttendees.add(flow.attendee.email);
    });
    
    const topOrganizers = Object.values(organizerStats)
      .map(stats => ({
        ...stats,
        uniqueAttendees: stats.uniqueAttendees.size
      }))
      .sort((a, b) => b.totalMeetingsOrganized - a.totalMeetingsOrganized)
      .slice(0, 5);
    
    return {
      type: 'communication_flow',
      totalResults: flows.length,
      data: flows,
      insights: {
        topOrganizers,
        totalFlows: flows.length
      }
    };
  }

  /**
   * Enhanced fuzzy search for people, topics, and meeting titles
   * @param {string} searchTerm - Search term
   * @param {string} searchType - Type of search (people, topics, meetings)
   * @returns {Promise<Array>} - Fuzzy search results
   */
  async fuzzySearch(searchTerm, searchType = 'all') {
    const results = [];
    const searchTermLower = searchTerm.toLowerCase();
    
    // Search people
    if (searchType === 'all' || searchType === 'people') {
      const peopleQuery = `
        MATCH (p:Person)
        WHERE toLower(p.name) CONTAINS $searchTerm 
           OR toLower(p.email) CONTAINS $searchTerm
        RETURN 'person' as type, p.name as name, p.email as email, p.department as department
        LIMIT 10
      `;
      
      const peopleResult = await graphDatabaseService.executeQuery(peopleQuery, { searchTerm: searchTermLower });
      results.push(...peopleResult.records.map(record => ({
        type: 'person',
        name: record.get('name'),
        email: record.get('email'),
        department: record.get('department'),
        relevance: this.calculateRelevance(searchTermLower, record.get('name').toLowerCase())
      })));
    }
    
    // Search meetings
    if (searchType === 'all' || searchType === 'meetings') {
      const meetingsQuery = `
        MATCH (m:Meeting)
        WHERE toLower(m.title) CONTAINS $searchTerm
           OR toLower(m.description) CONTAINS $searchTerm
        RETURN 'meeting' as type, m.title as title, m.startTime as startTime, m.description as description
        LIMIT 10
      `;
      
      const meetingsResult = await graphDatabaseService.executeQuery(meetingsQuery, { searchTerm: searchTermLower });
      results.push(...meetingsResult.records.map(record => ({
        type: 'meeting',
        title: record.get('title'),
        startTime: record.get('startTime'),
        description: record.get('description'),
        relevance: this.calculateRelevance(searchTermLower, record.get('title').toLowerCase())
      })));
    }
    
    // Search topics
    if (searchType === 'all' || searchType === 'topics') {
      const topicsQuery = `
        MATCH (t:Topic)
        WHERE toLower(t.name) CONTAINS $searchTerm
        RETURN 'topic' as type, t.name as name
        LIMIT 10
      `;
      
      const topicsResult = await graphDatabaseService.executeQuery(topicsQuery, { searchTerm: searchTermLower });
      results.push(...topicsResult.records.map(record => ({
        type: 'topic',
        name: record.get('name'),
        relevance: this.calculateRelevance(searchTermLower, record.get('name').toLowerCase())
      })));
    }
    
    // Sort by relevance and return top results
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, 15);
  }

  /**
   * Calculate relevance score for fuzzy matching
   * @param {string} searchTerm - Search term
   * @param {string} target - Target string to match against
   * @returns {number} - Relevance score (0-1)
   */
  calculateRelevance(searchTerm, target) {
    if (target.includes(searchTerm)) {
      // Exact substring match gets high score
      const position = target.indexOf(searchTerm);
      const lengthRatio = searchTerm.length / target.length;
      const positionScore = 1 - (position / target.length);
      return 0.7 + (0.2 * lengthRatio) + (0.1 * positionScore);
    }
    
    // Calculate word-based similarity
    const searchWords = searchTerm.split(' ');
    const targetWords = target.split(' ');
    let matchingWords = 0;
    
    searchWords.forEach(searchWord => {
      targetWords.forEach(targetWord => {
        if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
          matchingWords++;
        }
      });
    });
    
    return matchingWords / Math.max(searchWords.length, targetWords.length);
  }

  /**
   * Get meeting content and documents for analysis
   * @param {Object} parsedQuery - Parsed query object
   * @param {Object} context - Additional context including user tokens
   * @returns {Promise<Object>} - Meeting content and analysis results
   */
  async handleGetMeetingContent(parsedQuery, context) {
    const { entities, parameters } = parsedQuery;
    const conditions = [];
    const params = {};
    
    console.log('[LLMQueryService] Getting meeting content for analysis');
    console.log('[LLMQueryService] Parsed entities:', JSON.stringify(entities, null, 2));
    console.log('[LLMQueryService] Parameters:', JSON.stringify(parameters, null, 2));
    
    // First, let's check if there are any meetings that match the criteria (with or without documents)
    let testCypher = `MATCH (m:Meeting)`;
    const testConditions = [];
    const testParams = {};
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      testCypher += `-[:ATTENDED|ORGANIZED]-(p:Person)`;
      testConditions.push(`p.email IN $people OR p.name IN $people`);
      testParams.people = entities.people;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        testConditions.push(`m.startTime >= $startTime AND m.startTime <= $endTime`);
        testParams.startTime = timeFilter.start;
        testParams.endTime = timeFilter.end;
      }
    }
    
    if (testConditions.length > 0) {
      testCypher += ` WHERE ${testConditions.join(' AND ')}`;
    }
    
    testCypher += ` RETURN m.title, m.startTime, m.id ORDER BY m.startTime DESC LIMIT 5`;
    
    console.log('[LLMQueryService] Testing for any matching meetings first...');
    console.log('[LLMQueryService] Test query:', testCypher);
    console.log('[LLMQueryService] Test params:', JSON.stringify(testParams, null, 2));
    
    const testResult = await graphDatabaseService.executeQuery(testCypher, testParams);
    console.log('[LLMQueryService] Found', testResult.records.length, 'matching meetings (with or without documents)');
    
    if (testResult.records.length > 0) {
      testResult.records.forEach((record, index) => {
        console.log(`[LLMQueryService] Meeting ${index + 1}:`, {
          title: record.get('m.title'),
          startTime: record.get('m.startTime'),
          id: record.get('m.id')
        });
      });
    }
    
    // Since HAS_DOCUMENT relationships don't exist, let's find meetings first
    // and then check for documents in the document service
    let cypher = `MATCH (m:Meeting)`;
    
    // Add person filter if specified
    if (entities.people && entities.people.length > 0) {
      cypher += `-[:ATTENDED|ORGANIZED]-(p:Person)`;
      conditions.push(`p.email IN $people OR p.name IN $people`);
      params.people = entities.people;
    }
    
    // Add timeframe filter
    if (entities.timeframe) {
      const timeFilter = this.parseTimeframe(entities.timeframe);
      if (timeFilter) {
        conditions.push(`m.startTime >= $startTime AND m.startTime <= $endTime`);
        params.startTime = timeFilter.start;
        params.endTime = timeFilter.end;
      }
    }
    
    // Add meeting title filter if specified
    if (entities.meetings && entities.meetings.length > 0) {
      conditions.push(`any(meeting IN $meetings WHERE toLower(m.title) CONTAINS toLower(meeting))`);
      params.meetings = entities.meetings;
    }
    
    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Include documents in the query using HAS_DOCUMENT relationships
    cypher += ` 
      OPTIONAL MATCH (m)-[:HAS_DOCUMENT]->(d:Document)
      RETURN DISTINCT m, collect(d) as documents 
      ORDER BY m.startTime DESC 
      LIMIT $limit`;
    params.limit = neo4j.int(parseInt(parameters.limit) || 5);
    
    console.log('[LLMQueryService] Final query for meetings with documents:');
    console.log('[LLMQueryService] Cypher:', cypher);
    console.log('[LLMQueryService] Params:', JSON.stringify(params, null, 2));
    
    const result = await graphDatabaseService.executeQuery(cypher, params);
    console.log('[LLMQueryService] Query result: Found', result.records.length, 'meetings');
    
    if (result.records.length === 0) {
      return {
        type: 'meeting_content',
        totalResults: 0,
        data: [],
        message: 'No meetings with documents found matching your criteria.'
      };
    }
    
    const meetingsWithContent = [];
    
    for (const record of result.records) {
      const meeting = record.get('m').properties;
      const documents = record.get('documents') || [];
      
      console.log(`[LLMQueryService] Processing meeting: ${meeting.title} with ${documents.length} documents`);
      
      const meetingContent = {
        meeting: {
          title: meeting.title,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          location: meeting.location,
          description: meeting.description,
          googleEventId: meeting.googleEventId
        },
        documents: [],
        content: []
      };
      
      // Process documents that are already linked in Neo4j
      for (const docNode of documents) {
        if (docNode && docNode.properties) {
          const doc = docNode.properties;
          console.log(`[LLMQueryService] Found document: ${doc.title || doc.id}`);
          
          meetingContent.documents.push({
            id: doc.id,
            title: doc.title || 'Untitled Document',
            url: doc.url || `https://docs.google.com/document/d/${doc.id}`
          });
          
          // Include the document content if it exists in Neo4j
          if (doc.content) {
            meetingContent.content.push({
              title: doc.title || 'Untitled Document',
              content: doc.content,
              summary: doc.summary || 'No summary available'
            });
            console.log(`[LLMQueryService] Added content for document: ${doc.title} (${doc.content.length} chars)`);
          } else {
            console.log(`[LLMQueryService] Document ${doc.title} has no content stored in Neo4j`);
          }
        }
      }
      
      meetingsWithContent.push(meetingContent);
    }
    
    return {
      type: 'meeting_content',
      totalResults: meetingsWithContent.length,
      data: meetingsWithContent,
      hasContent: meetingsWithContent.some(m => m.content.length > 0),
      message: context.userTokens ? 
        'Retrieved meeting content and documents for analysis.' : 
        'Found meetings with documents. Document content requires authentication.'
    };
  }
}

module.exports = new LLMQueryService();
