#!/usr/bin/env node

/**
 * Database Reload Script
 * Clears Neo4j database and reloads all meeting and document data with proper relationships
 */

const graphDatabaseService = require('../services/intelligence/graph/graphDatabaseService');
const catalogingWorker = require('../services/intelligence/worker/catalogingWorker');
const fs = require('fs').promises;
const path = require('path');

class DatabaseReloader {
  constructor() {
    this.stats = {
      startTime: null,
      endTime: null,
      meetingsProcessed: 0,
      documentsProcessed: 0,
      relationshipsCreated: 0,
      errors: []
    };
  }

  /**
   * Main reload process
   */
  async reload(userTokens, user, options = {}) {
    console.log('🚀 Starting database reload process...');
    this.stats.startTime = new Date();

    try {
      // Step 1: Clear existing data
      await this.clearDatabase();

      // Step 2: Load user tokens if not provided
      if (!userTokens) {
        userTokens = await this.loadUserTokens();
      }

      // Step 3: Process calendar data with documents
      await this.processCalendarData(userTokens, user, options);

      // Step 4: Verify relationships were created
      await this.verifyRelationships();

      this.stats.endTime = new Date();
      const duration = (this.stats.endTime - this.stats.startTime) / 1000;

      console.log('✅ Database reload completed successfully!');
      console.log(`📊 Stats:`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Meetings: ${this.stats.meetingsProcessed}`);
      console.log(`   Documents: ${this.stats.documentsProcessed}`);
      console.log(`   Relationships: ${this.stats.relationshipsCreated}`);
      console.log(`   Errors: ${this.stats.errors.length}`);

      if (this.stats.errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        this.stats.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`);
        });
      }

      return {
        success: true,
        stats: this.stats
      };

    } catch (error) {
      console.error('❌ Database reload failed:', error);
      this.stats.errors.push(error.message);
      this.stats.endTime = new Date();
      
      return {
        success: false,
        error: error.message,
        stats: this.stats
      };
    }
  }

  /**
   * Clear all data from Neo4j database
   */
  async clearDatabase() {
    console.log('🗑️  Clearing existing database...');
    
    try {
      // Delete all nodes and relationships
      const clearQuery = `
        MATCH (n)
        DETACH DELETE n
      `;
      
      await graphDatabaseService.executeQuery(clearQuery);
      console.log('✅ Database cleared successfully');
      
    } catch (error) {
      console.error('❌ Error clearing database:', error);
      throw new Error(`Failed to clear database: ${error.message}`);
    }
  }

  /**
   * Load user tokens from worker-tokens.json
   */
  async loadUserTokens() {
    try {
      const tokensPath = path.join(__dirname, '../worker-tokens.json');
      const tokensData = await fs.readFile(tokensPath, 'utf8');
      const tokens = JSON.parse(tokensData);
      console.log('✅ User tokens loaded successfully');
      return tokens;
    } catch (error) {
      console.error('❌ Error loading user tokens:', error);
      throw new Error('Failed to load user tokens. Make sure worker-tokens.json exists.');
    }
  }

  /**
   * Process calendar data using the cataloging worker
   */
  async processCalendarData(userTokens, user, options) {
    console.log('📅 Processing calendar data...');
    
    const worker = new catalogingWorker();
    const defaultOptions = {
      monthsBack: 3, // Process last 3 months by default
      ...options
    };

    const result = await worker.processCalendarData(userTokens, user, defaultOptions);
    
    if (result.status === 'completed') {
      this.stats.meetingsProcessed = result.processingStatus.processedEvents;
      console.log(`✅ Calendar processing completed: ${result.processingStatus.processedEvents} meetings processed`);
    } else {
      throw new Error(`Calendar processing failed: ${result.message}`);
    }

    // Add any errors from the worker
    if (result.processingStatus.errors && result.processingStatus.errors.length > 0) {
      this.stats.errors.push(...result.processingStatus.errors.map(e => e.error || e));
    }
  }

  /**
   * Verify that relationships were created properly
   */
  async verifyRelationships() {
    console.log('🔍 Verifying relationships...');

    try {
      // Check HAS_DOCUMENT relationships
      const docRelQuery = `
        MATCH (m:Meeting)-[r:HAS_DOCUMENT]->(d:Document)
        RETURN count(r) as hasDocumentCount
      `;
      const docRelResult = await graphDatabaseService.executeQuery(docRelQuery);
      const hasDocumentCount = docRelResult.records[0]?.get('hasDocumentCount')?.toNumber() || 0;
      
      // Check ATTENDED relationships
      const attendedQuery = `
        MATCH (p:Person)-[r:ATTENDED]->(m:Meeting)
        RETURN count(r) as attendedCount
      `;
      const attendedResult = await graphDatabaseService.executeQuery(attendedQuery);
      const attendedCount = attendedResult.records[0]?.get('attendedCount')?.toNumber() || 0;

      // Check ORGANIZED relationships
      const organizedQuery = `
        MATCH (p:Person)-[r:ORGANIZED]->(m:Meeting)
        RETURN count(r) as organizedCount
      `;
      const organizedResult = await graphDatabaseService.executeQuery(organizedQuery);
      const organizedCount = organizedResult.records[0]?.get('organizedCount')?.toNumber() || 0;

      // Count documents
      const docCountQuery = `
        MATCH (d:Document)
        RETURN count(d) as documentCount
      `;
      const docCountResult = await graphDatabaseService.executeQuery(docCountQuery);
      const documentCount = docCountResult.records[0]?.get('documentCount')?.toNumber() || 0;

      this.stats.documentsProcessed = documentCount;
      this.stats.relationshipsCreated = hasDocumentCount + attendedCount + organizedCount;

      console.log('📊 Relationship verification:');
      console.log(`   HAS_DOCUMENT: ${hasDocumentCount}`);
      console.log(`   ATTENDED: ${attendedCount}`);
      console.log(`   ORGANIZED: ${organizedCount}`);
      console.log(`   Documents: ${documentCount}`);

      if (hasDocumentCount === 0) {
        console.log('⚠️  Warning: No HAS_DOCUMENT relationships found!');
      }

    } catch (error) {
      console.error('❌ Error verifying relationships:', error);
      this.stats.errors.push(`Verification error: ${error.message}`);
    }
  }
}

// CLI usage
if (require.main === module) {
  const reloader = new DatabaseReloader();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const monthsBack = args.includes('--months') ? parseInt(args[args.indexOf('--months') + 1]) || 3 : 3;
  
  console.log(`Starting database reload (${monthsBack} months back)...`);
  
  reloader.reload(null, null, { monthsBack })
    .then(result => {
      if (result.success) {
        console.log('🎉 Database reload completed successfully!');
        process.exit(0);
      } else {
        console.error('💥 Database reload failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = DatabaseReloader;
