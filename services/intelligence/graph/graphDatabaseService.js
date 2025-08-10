/**
 * Graph Database Service
 * Handles interactions with Neo4j graph database
 */
const neo4j = require('neo4j-driver');
const config = require('../../../config/neo4j');
const { v4: uuidv4 } = require('uuid');

class GraphDatabaseService {
  constructor() {
    this.driver = null;
    this.initialized = false;
  }

  /**
   * Initialize the Neo4j driver connection
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.driver = neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        { database: config.database }
      );
      
      // Test the connection
      const session = this.driver.session();
      await session.run('RETURN 1 AS result');
      await session.close();
      
      this.initialized = true;
      console.log('Neo4j connection established successfully');
    } catch (error) {
      console.error('Failed to establish Neo4j connection:', error);
      throw error;
    }
  }

  /**
   * Close the Neo4j driver connection
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      this.initialized = false;
      console.log('Neo4j connection closed');
    }
  }

  /**
   * Execute a Cypher query
   * @param {string} query - Cypher query
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - Query results
   */
  async executeQuery(query, params = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const session = this.driver.session();
    try {
      const result = await session.run(query, params);
      return result;
    } finally {
      await session.close();
    }
  }

  /**
   * Create a Person node
   * @param {Object} person - Person data
   * @returns {Promise<Object>} - Created person node
   */
  async createPerson(person) {
    const { id, email, name, photoUrl = null } = person;
    
    const query = `
      MERGE (p:Person {email: $email})
      ON CREATE SET p.id = $id, p.name = $name, p.photoUrl = $photoUrl, p.createdAt = datetime()
      ON MATCH SET p.name = $name, p.photoUrl = $photoUrl, p.updatedAt = datetime()
      RETURN p
    `;
    
    const params = {
      id: person.id || uuidv4(),
      email,
      name,
      photoUrl
    };
    
    const result = await this.executeQuery(query, params);
    return result.records[0].get('p').properties;
  }

  /**
   * Create a Meeting node
   * @param {Object} meeting - Meeting data
   * @returns {Promise<Object>} - Created meeting node
   */
  async createMeeting(meeting) {
    const {
      googleEventId,
      title,
      description,
      startTime,
      endTime,
      location,
      organizer,
      attendees = []
    } = meeting;
    
    // First create the meeting node
    const meetingQuery = `
      MERGE (m:Meeting {googleEventId: $googleEventId})
      ON CREATE SET 
        m.id = $id,
        m.title = $title,
        m.description = $description,
        m.startTime = datetime($startTime),
        m.endTime = datetime($endTime),
        m.location = $location,
        m.createdAt = datetime()
      ON MATCH SET 
        m.title = $title,
        m.description = $description,
        m.startTime = datetime($startTime),
        m.endTime = datetime($endTime),
        m.location = $location,
        m.updatedAt = datetime()
      RETURN m
    `;
    
    const meetingParams = {
      id: meeting.id || uuidv4(),
      googleEventId,
      title,
      description: description || '',
      startTime,
      endTime,
      location: location || ''
    };
    
    const meetingResult = await this.executeQuery(meetingQuery, meetingParams);
    const meetingNode = meetingResult.records[0].get('m').properties;
    
    // Then create the organizer if not exists and relationship
    if (organizer) {
      await this.createPerson(organizer);
      
      const organizerQuery = `
        MATCH (p:Person {email: $email})
        MATCH (m:Meeting {id: $meetingId})
        MERGE (p)-[r:ORGANIZED]->(m)
        ON CREATE SET r.createdAt = datetime()
        RETURN r
      `;
      
      await this.executeQuery(organizerQuery, {
        email: organizer.email,
        meetingId: meetingNode.id
      });
    }
    
    // Then create attendees if not exists and relationships
    for (const attendee of attendees) {
      await this.createPerson(attendee);
      
      const attendeeQuery = `
        MATCH (p:Person {email: $email})
        MATCH (m:Meeting {id: $meetingId})
        MERGE (p)-[r:ATTENDED]->(m)
        ON CREATE SET r.createdAt = datetime()
        RETURN r
      `;
      
      await this.executeQuery(attendeeQuery, {
        email: attendee.email,
        meetingId: meetingNode.id
      });
    }
    
    return meetingNode;
  }

  /**
   * Get recent meetings
   * @param {number} limit - Maximum number of meetings to return
   * @returns {Promise<Array>} - List of recent meetings
   */
  async getRecentMeetings(limit = 10) {
    const query = `
      MATCH (m:Meeting)
      RETURN m
      ORDER BY m.startTime DESC
      LIMIT $limit
    `;
    
    const result = await this.executeQuery(query, { limit: parseInt(limit) });
    return result.records.map(record => record.get('m').properties);
  }

  /**
   * Get meeting participants
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} - List of meeting participants
   */
  async getMeetingParticipants(meetingId) {
    const query = `
      MATCH (p:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting {id: $meetingId})
      RETURN p
    `;
    
    const result = await this.executeQuery(query, { meetingId });
    return result.records.map(record => record.get('p').properties);
  }

  /**
   * Get meetings for a person
   * @param {string} email - Person's email
   * @param {number} limit - Maximum number of meetings to return
   * @returns {Promise<Array>} - List of meetings
   */
  async getMeetingsForPerson(email, limit = 10) {
    const query = `
      MATCH (p:Person {email: $email})-[:ATTENDED|ORGANIZED]->(m:Meeting)
      RETURN m
      ORDER BY m.startTime DESC
      LIMIT $limit
    `;
    
    const result = await this.executeQuery(query, { 
      email, 
      limit: parseInt(limit) 
    });
    
    return result.records.map(record => record.get('m').properties);
  }

  /**
   * Create or update a document node
   * @param {Object} document - Document information
   * @param {string} document.id - Document ID
   * @param {string} document.title - Document title
   * @param {string} document.url - Document URL
   * @param {string} document.type - Document type (e.g., 'google_doc', 'google_sheet')
   * @param {string} document.content - Document content (optional)
   * @returns {Promise<Object>} - Created/updated document properties
   */
  async createDocument(document) {
    const { id, title, url, type = 'google_doc', content = null } = document;
    
    const query = `
      MERGE (d:Document {id: $id})
      ON CREATE SET 
        d.title = $title, 
        d.url = $url, 
        d.type = $type,
        d.content = $content,
        d.createdAt = datetime()
      ON MATCH SET 
        d.title = $title, 
        d.url = $url, 
        d.type = $type,
        d.content = $content,
        d.updatedAt = datetime()
      RETURN d
    `;
    
    const params = {
      id: id || uuidv4(),
      title,
      url,
      type,
      content
    };
    
    const result = await this.executeQuery(query, params);
    return result.records[0].get('d').properties;
  }

  /**
   * Create relationship between meeting and document
   * @param {string} meetingId - Meeting ID
   * @param {string} documentId - Document ID
   * @param {string} relationshipType - Type of relationship (default: 'HAS_DOCUMENT')
   * @returns {Promise<void>}
   */
  async linkMeetingToDocument(meetingId, documentId, relationshipType = 'HAS_DOCUMENT') {
    const query = `
      MATCH (m:Meeting {id: $meetingId})
      MATCH (d:Document {id: $documentId})
      MERGE (m)-[:${relationshipType}]->(d)
    `;
    
    await this.executeQuery(query, { meetingId, documentId });
  }

  /**
   * Get documents for a meeting
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Array>} - List of documents associated with the meeting
   */
  async getDocumentsForMeeting(meetingId) {
    const query = `
      MATCH (m:Meeting {id: $meetingId})-[:HAS_DOCUMENT]->(d:Document)
      RETURN d
      ORDER BY d.createdAt DESC
    `;
    
    const result = await this.executeQuery(query, { meetingId });
    return result.records.map(record => record.get('d').properties);
  }

  /**
   * Get meetings that reference a specific document
   * @param {string} documentId - Document ID
   * @returns {Promise<Array>} - List of meetings that reference the document
   */
  async getMeetingsForDocument(documentId) {
    const query = `
      MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document {id: $documentId})
      RETURN m
      ORDER BY m.startTime DESC
    `;
    
    const result = await this.executeQuery(query, { documentId });
    return result.records.map(record => record.get('m').properties);
  }
}

module.exports = new GraphDatabaseService();
