const DailyBriefingRepository = require('../repositories/dailyBriefingRepository');
const calendarService = require('./calendarService');
const documentService = require('./documentService');
const openaiService = require('./openaiService');
const { MeetingSummary } = require('../models');
const { formatDate, isToday } = require('../utils/dateUtils');
const { marked } = require('marked');

class DailyBriefingService {
  constructor() {
    this.repository = new DailyBriefingRepository();
  }

  /**
   * Generate a daily briefing for a user on a specific date
   * @param {string} userId - User ID
   * @param {string} briefingDate - Date in YYYY-MM-DD format
   * @param {Object} userTokens - OAuth2 tokens for calendar access
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Generated daily briefing
   */
  async generateDailyBriefing(userId, briefingDate, userTokens, progressCallback = null) {
    try {
      console.log(`[DailyBriefingService] Starting daily briefing generation for user ${userId} on ${briefingDate}`);
      
      // Check if briefing already exists
      const existingBriefing = await this.repository.findByUserIdAndDate(userId, briefingDate);
      if (existingBriefing && existingBriefing.status === 'completed') {
        console.log(`[DailyBriefingService] Existing completed briefing found`);
        return existingBriefing;
      }

      // Update progress
      if (progressCallback) progressCallback({ step: 'fetching_meetings', progress: 10 });

      // Get meetings for the date
      const meetings = await calendarService.getEventsByDate(userId, briefingDate, userTokens);
      console.log(`[DailyBriefingService] Found ${meetings.length} meetings for ${briefingDate}`);

      if (meetings.length === 0) {
        console.log(`[DailyBriefingService] No meetings found for ${briefingDate}`);
        return null;
      }

      // Create or update briefing record
      let briefing;
      if (existingBriefing) {
        briefing = await this.repository.updateStatus(existingBriefing.id, 'processing');
      } else {
        briefing = await this.repository.createBriefing({
          userId,
          briefingDate,
          meetingCount: meetings.length,
          status: 'processing'
        });
      }

      console.log(`[DailyBriefingService] Created/updated briefing record: ${briefing.id}`);

      try {
        // Process each meeting
        if (progressCallback) progressCallback({ step: 'processing_meetings', progress: 20 });
        
        const meetingSummaries = [];
        const totalMeetings = meetings.length;
        
        for (let i = 0; i < meetings.length; i++) {
          const meeting = meetings[i];
          const meetingProgress = 20 + ((i / totalMeetings) * 50); // 20-70% for meeting processing
          
          if (progressCallback) {
            progressCallback({ 
              step: 'processing_meeting', 
              progress: meetingProgress,
              meetingTitle: meeting.summary || 'Untitled Meeting',
              meetingIndex: i + 1,
              totalMeetings
            });
          }

          try {
            const summary = await this.processMeeting(meeting, userId);
            if (summary) {
              meetingSummaries.push(summary);
            }
          } catch (error) {
            console.error(`[DailyBriefingService] Error processing meeting ${meeting.id}:`, error);
            // Continue with other meetings even if one fails
          }
        }

        // Generate comprehensive daily briefing
        if (progressCallback) progressCallback({ step: 'generating_briefing', progress: 75 });
        
        const briefingContent = await this.generateComprehensiveBriefing(
          meetings, 
          meetingSummaries, 
          briefingDate
        );

        // Update briefing with generated content
        if (progressCallback) progressCallback({ step: 'finalizing', progress: 90 });
        
        const completedBriefing = await this.repository.updateContent(briefing.id, {
          summaryText: briefingContent.summaryText,
          summaryHtml: briefingContent.summaryHtml,
          peopleOverview: briefingContent.peopleOverview,
          priorityPreparations: briefingContent.priorityPreparations
        });

        if (progressCallback) progressCallback({ step: 'completed', progress: 100 });
        
        console.log(`[DailyBriefingService] Daily briefing generation completed for ${briefingDate}`);
        return completedBriefing;

      } catch (error) {
        // Update briefing status to failed
        await this.repository.updateStatus(briefing.id, 'failed');
        throw error;
      }

    } catch (error) {
      console.error(`[DailyBriefingService] Error generating daily briefing:`, error);
      throw new Error(`Failed to generate daily briefing: ${error.message}`);
    }
  }

  /**
   * Process a single meeting - download documents and generate summary
   * @param {Object} meeting - Meeting object from calendar
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Meeting summary or null if no documents
   */
  async processMeeting(meeting, userId) {
    try {
      console.log(`[DailyBriefingService] Processing meeting: ${meeting.summary}`);

      // Check if we already have a summary for this meeting
      const existingSummary = await MeetingSummary.findOne({
        where: { 
          meetingId: meeting.id,
          userId: userId 
        }
      });

      if (existingSummary) {
        console.log(`[DailyBriefingService] Using existing summary for meeting ${meeting.id}`);
        return {
          meetingId: meeting.id,
          meetingTitle: meeting.summary,
          summary: existingSummary.summaryText,
          keyTopics: existingSummary.keyTopics ? JSON.parse(existingSummary.keyTopics) : [],
          attendees: meeting.attendees || []
        };
      }

      // Download documents for this meeting
      const documents = await documentService.fetchDocumentsForMeeting(meeting.id, userId);
      
      if (!documents || documents.length === 0) {
        console.log(`[DailyBriefingService] No documents found for meeting ${meeting.id}`);
        return null;
      }

      // Generate AI summary for the meeting
      const documentContents = documents.map(doc => ({
        title: doc.title,
        content: doc.content
      }));

      const aiAnalysis = await openaiService.generateMeetingSummary(
        meeting.summary || 'Meeting',
        documentContents
      );

      // Store the summary in the database
      const meetingSummary = await MeetingSummary.create({
        userId: userId,
        meetingId: meeting.id,
        meetingTitle: meeting.summary,
        summaryText: aiAnalysis.summary,
        summaryHtml: marked(aiAnalysis.summary),
        keyTopics: JSON.stringify(aiAnalysis.keyTopics || []),
        preparationSuggestions: JSON.stringify(aiAnalysis.preparationSuggestions || []),
        documentCount: documents.length
      });

      console.log(`[DailyBriefingService] Generated and stored summary for meeting ${meeting.id}`);

      return {
        meetingId: meeting.id,
        meetingTitle: meeting.summary,
        summary: aiAnalysis.summary,
        keyTopics: aiAnalysis.keyTopics || [],
        attendees: meeting.attendees || [],
        preparationSuggestions: aiAnalysis.preparationSuggestions || []
      };

    } catch (error) {
      console.error(`[DailyBriefingService] Error processing meeting ${meeting.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate comprehensive daily briefing from individual meeting summaries
   * @param {Array} meetings - Array of meeting objects
   * @param {Array} meetingSummaries - Array of processed meeting summaries
   * @param {string} briefingDate - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Comprehensive briefing content
   */
  async generateComprehensiveBriefing(meetings, meetingSummaries, briefingDate) {
    try {
      console.log(`[DailyBriefingService] Generating comprehensive briefing for ${meetingSummaries.length} meetings`);

      // Prepare context for AI
      const briefingContext = {
        date: briefingDate,
        isToday: isToday(briefingDate),
        totalMeetings: meetings.length,
        meetingsWithDocuments: meetingSummaries.length,
        meetings: meetings.map(meeting => ({
          id: meeting.id,
          title: meeting.summary,
          startTime: meeting.start?.dateTime || meeting.start?.date,
          endTime: meeting.end?.dateTime || meeting.end?.date,
          attendees: meeting.attendees?.map(a => a.email) || []
        })),
        summaries: meetingSummaries
      };

      // Generate comprehensive briefing using AI
      const comprehensiveBriefing = await openaiService.generateDailyBriefing(briefingContext);

      // Extract people overview
      const allAttendees = new Set();
      meetings.forEach(meeting => {
        if (meeting.attendees) {
          meeting.attendees.forEach(attendee => {
            if (attendee.email && !attendee.email.includes('resource.calendar.google.com')) {
              allAttendees.add(attendee.displayName || attendee.email);
            }
          });
        }
      });

      const peopleOverview = Array.from(allAttendees).slice(0, 10).join(', ');

      // Compile priority preparations
      const allPreparations = [];
      meetingSummaries.forEach(summary => {
        if (summary.preparationSuggestions) {
          allPreparations.push(...summary.preparationSuggestions);
        }
      });

      const priorityPreparations = allPreparations
        .slice(0, 5)
        .map((prep, index) => `${index + 1}. ${prep}`)
        .join('\n');

      return {
        summaryText: comprehensiveBriefing.summary,
        summaryHtml: marked(comprehensiveBriefing.summary),
        peopleOverview: peopleOverview || 'No attendees found',
        priorityPreparations: priorityPreparations || 'No specific preparations identified'
      };

    } catch (error) {
      console.error(`[DailyBriefingService] Error generating comprehensive briefing:`, error);
      throw error;
    }
  }

  /**
   * Get existing daily briefing for a user and date
   * @param {string} userId - User ID
   * @param {string} briefingDate - Date in YYYY-MM-DD format
   * @returns {Promise<Object|null>} Existing briefing or null
   */
  async getDailyBriefing(userId, briefingDate) {
    try {
      return await this.repository.findByUserIdAndDate(userId, briefingDate);
    } catch (error) {
      console.error(`[DailyBriefingService] Error getting daily briefing:`, error);
      throw error;
    }
  }

  /**
   * Get daily briefings for a user within a date range
   * @param {string} userId - User ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of briefings
   */
  async getDailyBriefingsInRange(userId, startDate, endDate) {
    try {
      return await this.repository.findByUserIdAndDateRange(userId, startDate, endDate);
    } catch (error) {
      console.error(`[DailyBriefingService] Error getting daily briefings in range:`, error);
      throw error;
    }
  }

  /**
   * Delete a daily briefing
   * @param {string} briefingId - Briefing ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteDailyBriefing(briefingId) {
    try {
      return await this.repository.deleteBriefing(briefingId);
    } catch (error) {
      console.error(`[DailyBriefingService] Error deleting daily briefing:`, error);
      throw error;
    }
  }

  /**
   * Get briefings by status
   * @param {string} status - Status to filter by
   * @returns {Promise<Array>} Array of briefings
   */
  async getBriefingsByStatus(status) {
    try {
      return await this.repository.findByStatus(status);
    } catch (error) {
      console.error(`[DailyBriefingService] Error getting briefings by status:`, error);
      throw error;
    }
  }
}

module.exports = new DailyBriefingService();
