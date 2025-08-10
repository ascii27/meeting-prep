#!/usr/bin/env node

/**
 * Clear Neo4j Database Script
 * Simple script to clear all nodes and relationships from Neo4j
 */

const graphDatabaseService = require('../services/intelligence/graph/graphDatabaseService');

async function clearNeo4j() {
  try {
    console.log('🗑️  Clearing Neo4j database...');
    
    // Delete all nodes and relationships
    const clearQuery = `
      MATCH (n)
      DETACH DELETE n
    `;
    
    const result = await graphDatabaseService.executeQuery(clearQuery);
    console.log('✅ Neo4j database cleared successfully');
    
    // Verify it's empty
    const countQuery = `
      MATCH (n)
      RETURN count(n) as nodeCount
    `;
    
    const countResult = await graphDatabaseService.executeQuery(countQuery);
    const nodeCount = countResult.records[0]?.get('nodeCount')?.toNumber() || 0;
    
    console.log(`📊 Remaining nodes: ${nodeCount}`);
    
    if (nodeCount === 0) {
      console.log('🎉 Database is completely empty and ready for fresh data!');
    } else {
      console.log('⚠️  Warning: Some nodes may still exist');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error clearing Neo4j database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  clearNeo4j();
}

module.exports = clearNeo4j;
