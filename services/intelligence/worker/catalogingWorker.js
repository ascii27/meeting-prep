/**
 * Cataloging Worker Service
 * Handles asynchronous processing of meeting data
 */
const calendarProcessingService = require('../calendar/calendarProcessingService');
const graphDatabaseService = require('../graph/graphDatabaseService');
const documentService = require('../../documentService');
const { v4: uuidv4 } = require('uuid');

class CatalogingWorker {
  constructor() {
    this.isProcessing = false;
    this.processingStatus = {
      inProgress: false,
      startTime: null,
      endTime: null,
      totalEvents: 0,
      processedEvents: 0,
      errors: []
    };
  }

  /**
   * Start processing calendar data for a user
   * @param {Object} userTokens - User's OAuth tokens
   * @param {Object} user - User information
   * @param {Object} options - Processing options
   * @param {number} options.monthsBack - Number of months to look back (default: 1)
   * @returns {Promise<Object>} - Processing status
   */
  async processCalendarData(userTokens, user, options = {}) {
    // Prevent concurrent processing for the same user
    if (this.isProcessing) {
      return { 
        status: 'already_running', 
        message: 'Calendar processing is already in progress',
        processingStatus: this.processingStatus
      };
    }

    try {
      this.isProcessing = true;
      this.processingStatus = {
        inProgress: true,
        startTime: new Date(),
        endTime: null,
        totalEvents: 0,
        processedEvents: 0,
        errors: []
      };

      // Initialize Neo4j connection
      await graphDatabaseService.initialize();

      // Create or update the user as a Person node
      await graphDatabaseService.createPerson({
        id: user.id,
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        // Ensure photoUrl is null if not provided
        photoUrl: user.photoUrl || null
      });

      // Get calendar events with time boundaries
      const events = await calendarProcessingService.getCalendarEvents(userTokens, options);
      this.processingStatus.totalEvents = events.length;

      // Process each event
      for (const event of events) {
        try {
          // Create the meeting in the graph database
          await graphDatabaseService.createMeeting(event);
          
          // Process documents associated with this event
          await this.processEventDocuments(event, userTokens);
          
          this.processingStatus.processedEvents++;
        } catch (error) {
          console.error(`Error processing event ${event.googleEventId}:`, error);
          this.processingStatus.errors.push({
            eventId: event.googleEventId,
            error: error.message
          });
        }
      }

      this.processingStatus.inProgress = false;
      this.processingStatus.endTime = new Date();
      
      return {
        status: 'completed',
        message: `Processed ${this.processingStatus.processedEvents} of ${this.processingStatus.totalEvents} events`,
        processingStatus: this.processingStatus
      };
    } catch (error) {
      console.error('Error in calendar processing:', error);
      this.processingStatus.inProgress = false;
      this.processingStatus.endTime = new Date();
      this.processingStatus.errors.push({
        error: error.message
      });
      
      return {
        status: 'error',
        message: `Error processing calendar data: ${error.message}`,
        processingStatus: this.processingStatus
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process documents associated with a calendar event
   * @param {Object} event - Calendar event object
   * @param {Object} userTokens - User's OAuth tokens
   * @returns {Promise<void>}
   */
  async processEventDocuments(event, userTokens) {
    try {
      console.log(`Processing documents for event: ${event.summary || event.title} (${event.googleEventId})`);
      
      // Get documents associated with this event
      const documents = await documentService.getDocumentsForEvent(event, userTokens);
      
      if (!documents || documents.length === 0) {
        console.log(`No documents found for event: ${event.googleEventId}`);
        return;
      }
      
      console.log(`Found ${documents.length} document(s) for event: ${event.googleEventId}`);
      
      // Process each document
      for (const doc of documents) {
        try {
          console.log(`Fetching content for document: ${doc.title} (${doc.id})`);
          
          // Fetch the actual document content
          let documentContent = null;
          let actualTitle = doc.title;
          try {
            const contentResult = await documentService.getDocumentContent(doc.id, userTokens);
            if (contentResult && contentResult.content) {
              documentContent = contentResult.content.content; // Extract the actual content string
              actualTitle = contentResult.content.title || doc.title; // Use the actual document title from Google Docs
              console.log(`Successfully fetched content for document: ${actualTitle} (${documentContent.length} characters)`);
            }
          } catch (contentError) {
            console.warn(`Could not fetch content for document ${doc.id}: ${contentError.message}`);
            // Continue processing without content - we'll still store the document metadata
          }
          
          // Create document node in graph database with content
          const documentNode = await graphDatabaseService.createDocument({
            id: doc.id,
            title: actualTitle, // Use the actual title from Google Docs
            url: doc.url,
            type: doc.type || 'google_doc',
            content: documentContent
          });
          
          // Link the meeting to the document
          await graphDatabaseService.linkMeetingToDocument(event.googleEventId, doc.id);
          
          const contentStatus = documentContent ? `with ${documentContent.length} chars of content` : 'metadata only';
          console.log(`Successfully processed document: ${actualTitle} (${doc.id}) - ${contentStatus}`);
        } catch (docError) {
          console.error(`Error processing document ${doc.id}:`, docError);
          this.processingStatus.errors.push({
            eventId: event.googleEventId,
            documentId: doc.id,
            error: `Document processing error: ${docError.message}`
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching documents for event ${event.googleEventId}:`, error);
      this.processingStatus.errors.push({
        eventId: event.googleEventId,
        error: `Document fetching error: ${error.message}`
      });
    }
  }

  /**
   * Get the current processing status
   * @returns {Object} - Current processing status
   */
  getProcessingStatus() {
    return this.processingStatus;
  }
}

module.exports = new CatalogingWorker();
