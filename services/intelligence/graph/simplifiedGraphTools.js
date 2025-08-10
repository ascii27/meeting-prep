/**
 * Simplified Graph Database Tools
 * Clean, focused tools for LLM interaction with Neo4j graph database
 */

const graphDatabaseService = require('./graphDatabaseService');
const neo4j = require('neo4j-driver');

class SimplifiedGraphTools {
  constructor() {
    this.tools = {
      find_meetings: this.findMeetings.bind(this),
      find_documents: this.findDocuments.bind(this),
      find_people: this.findPeople.bind(this),
      get_meeting_details: this.getMeetingDetails.bind(this),
      analyze_patterns: this.analyzePatterns.bind(this)
    };
  }

  /**
   * Find meetings based on various criteria
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.person - Person name or email to filter by
   * @param {string} criteria.timeframe - Time period (e.g., "2025-08-08", "last week", "yesterday")
   * @param {string} criteria.keywords - Keywords to search in meeting titles/descriptions
   * @param {number} criteria.limit - Maximum number of results (default: 50)
   * @returns {Promise<Object>} - Meeting results with metadata
   */
  async findMeetings(criteria = {}) {
    try {
      console.log('[SimplifiedGraphTools] Finding meetings with criteria:', criteria);
      
      let cypher = 'MATCH (m:Meeting)';
      const conditions = [];
      const params = {};
      
      // Add person filter
      if (criteria.person) {
        cypher += '-[:ATTENDED|ORGANIZED]-(p:Person)';
        conditions.push('(toLower(p.name) CONTAINS toLower($person) OR toLower(p.email) CONTAINS toLower($person))');
        params.person = criteria.person;
      }
      
      // Add timeframe filter
      if (criteria.timeframe) {
        const timeFilter = this.parseTimeframe(criteria.timeframe);
        if (timeFilter) {
          conditions.push('m.startTime >= $startTime AND m.startTime <= $endTime');
          params.startTime = timeFilter.start;
          params.endTime = timeFilter.end;
        }
      }
      
      // Add keyword filter
      if (criteria.keywords) {
        conditions.push('(toLower(m.title) CONTAINS toLower($keywords) OR toLower(m.description) CONTAINS toLower($keywords))');
        params.keywords = criteria.keywords;
      }
      
      // Build WHERE clause
      if (conditions.length > 0) {
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add return and ordering
      cypher += ` RETURN DISTINCT m ORDER BY m.startTime DESC LIMIT $limit`;
      params.limit = neo4j.int(criteria.limit || 50);
      
      console.log('[SimplifiedGraphTools] Query:', cypher);
      console.log('[SimplifiedGraphTools] Params:', params);
      
      const result = await graphDatabaseService.executeQuery(cypher, params);
      const meetings = result.records.map(record => {
        const meeting = record.get('m').properties;
        return {
          id: meeting.id,
          googleEventId: meeting.googleEventId,
          title: meeting.title,
          description: meeting.description,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          location: meeting.location
        };
      });
      
      return {
        type: 'meetings',
        count: meetings.length,
        data: meetings,
        criteria: criteria
      };
      
    } catch (error) {
      console.error('[SimplifiedGraphTools] Error finding meetings:', error);
      throw error;
    }
  }

  /**
   * Find documents and their content
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.meeting_id - Specific meeting ID or googleEventId
   * @param {string} criteria.person - Person associated with meetings that have documents
   * @param {string} criteria.keywords - Keywords to search in document titles/content
   * @param {number} criteria.limit - Maximum number of results (default: 20)
   * @returns {Promise<Object>} - Document results with content
   */
  async findDocuments(criteria = {}) {
    try {
      console.log('[SimplifiedGraphTools] Finding documents with criteria:', criteria);
      
      let cypher = 'MATCH (d:Document)';
      const conditions = [];
      const params = {};
      
      // If specific meeting requested
      if (criteria.meeting_id) {
        cypher = 'MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document)';
        conditions.push('(m.id = $meetingId OR m.googleEventId = $meetingId)');
        params.meetingId = criteria.meeting_id;
      }
      // If person filter requested
      else if (criteria.person) {
        cypher = 'MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document), (m)-[:ATTENDED|ORGANIZED]-(p:Person)';
        conditions.push('(toLower(p.name) CONTAINS toLower($person) OR toLower(p.email) CONTAINS toLower($person))');
        params.person = criteria.person;
      }
      // General document search
      else {
        cypher = 'MATCH (d:Document)<-[:HAS_DOCUMENT]-(m:Meeting)';
      }
      
      // Add keyword filter
      if (criteria.keywords) {
        conditions.push('(toLower(d.title) CONTAINS toLower($keywords) OR toLower(d.content) CONTAINS toLower($keywords))');
        params.keywords = criteria.keywords;
      }
      
      // Build WHERE clause
      if (conditions.length > 0) {
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add return and ordering
      cypher += ` RETURN DISTINCT d, m ORDER BY m.startTime DESC LIMIT $limit`;
      params.limit = neo4j.int(criteria.limit || 20);
      
      console.log('[SimplifiedGraphTools] Query:', cypher);
      
      const result = await graphDatabaseService.executeQuery(cypher, params);
      const documents = result.records.map(record => {
        const doc = record.get('d').properties;
        const meeting = record.get('m') ? record.get('m').properties : null;
        
        return {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          url: doc.url,
          type: doc.type,
          meeting: meeting ? {
            id: meeting.id,
            title: meeting.title,
            startTime: meeting.startTime
          } : null
        };
      });
      
      return {
        type: 'documents',
        count: documents.length,
        data: documents,
        criteria: criteria
      };
      
    } catch (error) {
      console.error('[SimplifiedGraphTools] Error finding documents:', error);
      throw error;
    }
  }

  /**
   * Find people and their participation data
   * @param {Object} criteria - Search criteria
   * @param {string} criteria.name - Person name or email to search for
   * @param {string} criteria.meeting_keywords - Find people who attended meetings with these keywords
   * @param {string} criteria.timeframe - Time period to analyze
   * @param {number} criteria.limit - Maximum number of results (default: 20)
   * @returns {Promise<Object>} - People results with participation stats
   */
  async findPeople(criteria = {}) {
    try {
      console.log('[SimplifiedGraphTools] Finding people with criteria:', criteria);
      
      let cypher = 'MATCH (p:Person)';
      const conditions = [];
      const params = {};
      
      // Add name filter
      if (criteria.name) {
        conditions.push('(toLower(p.name) CONTAINS toLower($name) OR toLower(p.email) CONTAINS toLower($name))');
        params.name = criteria.name;
      }
      
      // Add meeting participation filter
      if (criteria.meeting_keywords || criteria.timeframe) {
        cypher += '-[:ATTENDED|ORGANIZED]->(m:Meeting)';
        
        if (criteria.meeting_keywords) {
          conditions.push('toLower(m.title) CONTAINS toLower($keywords)');
          params.keywords = criteria.meeting_keywords;
        }
        
        if (criteria.timeframe) {
          const timeFilter = this.parseTimeframe(criteria.timeframe);
          if (timeFilter) {
            conditions.push('m.startTime >= $startTime AND m.startTime <= $endTime');
            params.startTime = timeFilter.start;
            params.endTime = timeFilter.end;
          }
        }
      }
      
      // Build WHERE clause
      if (conditions.length > 0) {
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Add return with participation count
      if (cypher.includes('(m:Meeting)')) {
        cypher += ` RETURN DISTINCT p, count(m) as meetingCount ORDER BY meetingCount DESC LIMIT $limit`;
      } else {
        cypher += ` RETURN DISTINCT p LIMIT $limit`;
      }
      
      params.limit = neo4j.int(criteria.limit || 20);
      
      const result = await graphDatabaseService.executeQuery(cypher, params);
      const people = result.records.map(record => {
        const person = record.get('p').properties;
        const meetingCount = record.has('meetingCount') ? record.get('meetingCount').toNumber() : 0;
        
        return {
          id: person.id,
          name: person.name,
          email: person.email,
          photoUrl: person.photoUrl,
          meetingCount: meetingCount
        };
      });
      
      return {
        type: 'people',
        count: people.length,
        data: people,
        criteria: criteria
      };
      
    } catch (error) {
      console.error('[SimplifiedGraphTools] Error finding people:', error);
      throw error;
    }
  }

  /**
   * Get complete details for a specific meeting including documents and participants
   * @param {string} meetingId - Meeting ID or googleEventId
   * @returns {Promise<Object>} - Complete meeting details
   */
  async getMeetingDetails(meetingId) {
    try {
      console.log('[SimplifiedGraphTools] Getting meeting details for:', meetingId);
      
      const cypher = `
        MATCH (m:Meeting)
        WHERE m.id = $meetingId OR m.googleEventId = $meetingId
        OPTIONAL MATCH (m)-[:HAS_DOCUMENT]->(d:Document)
        OPTIONAL MATCH (m)<-[:ATTENDED]-(attendee:Person)
        OPTIONAL MATCH (m)<-[:ORGANIZED]-(organizer:Person)
        RETURN m, 
               collect(DISTINCT d) as documents,
               collect(DISTINCT attendee) as attendees,
               collect(DISTINCT organizer) as organizers
      `;
      
      const result = await graphDatabaseService.executeQuery(cypher, { meetingId });
      
      if (result.records.length === 0) {
        return {
          type: 'meeting_details',
          found: false,
          message: 'Meeting not found'
        };
      }
      
      const record = result.records[0];
      const meeting = record.get('m').properties;
      const documents = record.get('documents').map(d => d ? d.properties : null).filter(Boolean);
      const attendees = record.get('attendees').map(p => p ? p.properties : null).filter(Boolean);
      const organizers = record.get('organizers').map(p => p ? p.properties : null).filter(Boolean);
      
      return {
        type: 'meeting_details',
        found: true,
        data: {
          meeting: {
            id: meeting.id,
            googleEventId: meeting.googleEventId,
            title: meeting.title,
            description: meeting.description,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            location: meeting.location
          },
          documents: documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            url: doc.url,
            type: doc.type
          })),
          attendees: attendees.map(person => ({
            id: person.id,
            name: person.name,
            email: person.email
          })),
          organizers: organizers.map(person => ({
            id: person.id,
            name: person.name,
            email: person.email
          }))
        }
      };
      
    } catch (error) {
      console.error('[SimplifiedGraphTools] Error getting meeting details:', error);
      throw error;
    }
  }

  /**
   * Analyze patterns in meetings, documents, or collaboration
   * @param {string} type - Analysis type: 'collaboration', 'meeting_frequency', 'document_trends'
   * @param {Object} criteria - Analysis criteria
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzePatterns(type, criteria = {}) {
    try {
      console.log('[SimplifiedGraphTools] Analyzing patterns:', type, criteria);
      
      switch (type) {
        case 'collaboration':
          return await this.analyzeCollaboration(criteria);
        case 'meeting_frequency':
          return await this.analyzeMeetingFrequency(criteria);
        case 'document_trends':
          return await this.analyzeDocumentTrends(criteria);
        default:
          throw new Error(`Unknown analysis type: ${type}`);
      }
      
    } catch (error) {
      console.error('[SimplifiedGraphTools] Error analyzing patterns:', error);
      throw error;
    }
  }

  /**
   * Parse timeframe string into start/end dates
   * @param {string} timeframe - Human-readable timeframe
   * @returns {Object|null} - {start, end} datetime strings or null
   */
  parseTimeframe(timeframe) {
    const now = new Date();
    let start, end;
    
    if (timeframe.includes('-')) {
      // Specific date like "2025-08-08"
      const date = new Date(timeframe);
      if (!isNaN(date)) {
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      }
    } else if (timeframe.toLowerCase().includes('yesterday')) {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe.toLowerCase().includes('last week')) {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
    } else if (timeframe.toLowerCase().includes('last month')) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      end = now;
    }
    
    if (start && end) {
      return {
        start: start.toISOString(),
        end: end.toISOString()
      };
    }
    
    return null;
  }

  // Helper methods for pattern analysis
  async analyzeCollaboration(criteria) {
    // Implementation for collaboration analysis
    return { type: 'collaboration_analysis', message: 'Not implemented yet' };
  }

  async analyzeMeetingFrequency(criteria) {
    // Implementation for meeting frequency analysis
    return { type: 'meeting_frequency_analysis', message: 'Not implemented yet' };
  }

  async analyzeDocumentTrends(criteria) {
    // Implementation for document trends analysis
    return { type: 'document_trends_analysis', message: 'Not implemented yet' };
  }
}

module.exports = new SimplifiedGraphTools();
