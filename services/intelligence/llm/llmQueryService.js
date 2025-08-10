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
      find_meetings: this.handleFindMeetings.bind(this),
      get_participants: this.handleGetParticipants.bind(this),
      find_documents: this.handleFindDocuments.bind(this),
      analyze_relationships: this.handleAnalyzeRelationships.bind(this),
      general_query: this.handleGeneralQuery.bind(this)
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
      
      return {
        query: query,
        intent: parsedQuery.intent,
        confidence: parsedQuery.confidence,
        results: queryResults,
        response: naturalLanguageResponse,
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
    const meetings = result.records.map(record => record.get('m').properties);
    
    return {
      type: 'meetings',
      totalResults: meetings.length,
      data: meetings,
      query: cypher,
      parameters: params
    };
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
   * Parse timeframe strings into date ranges
   * @param {string} timeframe - Natural language timeframe
   * @returns {Object|null} - Start and end dates
   */
  parseTimeframe(timeframe) {
    const now = new Date();
    const timeframeLower = timeframe.toLowerCase();
    
    if (timeframeLower.includes('today')) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    
    if (timeframeLower.includes('yesterday')) {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    
    if (timeframeLower.includes('last week')) {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    
    if (timeframeLower.includes('last month')) {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    
    // Add more timeframe parsing as needed
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
}

module.exports = new LLMQueryService();
