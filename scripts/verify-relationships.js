#!/usr/bin/env node

/**
 * Verify Neo4j Relationships Script
 * Checks if all expected relationships exist after cataloging worker runs
 */

const graphDatabaseService = require('../services/intelligence/graph/graphDatabaseService');

async function verifyRelationships() {
  try {
    console.log('🔍 Verifying Neo4j relationships...\n');
    
    // Check node counts
    const nodeQueries = [
      { label: 'Meeting', query: 'MATCH (m:Meeting) RETURN count(m) as count' },
      { label: 'Person', query: 'MATCH (p:Person) RETURN count(p) as count' },
      { label: 'Document', query: 'MATCH (d:Document) RETURN count(d) as count' }
    ];
    
    console.log('📊 Node Counts:');
    for (const { label, query } of nodeQueries) {
      const result = await graphDatabaseService.executeQuery(query);
      const count = result.records[0]?.get('count')?.toNumber() || 0;
      console.log(`   ${label}: ${count}`);
    }
    
    console.log('\n🔗 Relationship Counts:');
    
    // Check relationship counts
    const relationshipQueries = [
      { label: 'HAS_DOCUMENT', query: 'MATCH ()-[r:HAS_DOCUMENT]->() RETURN count(r) as count' },
      { label: 'ATTENDED', query: 'MATCH ()-[r:ATTENDED]->() RETURN count(r) as count' },
      { label: 'ORGANIZED', query: 'MATCH ()-[r:ORGANIZED]->() RETURN count(r) as count' }
    ];
    
    for (const { label, query } of relationshipQueries) {
      const result = await graphDatabaseService.executeQuery(query);
      const count = result.records[0]?.get('count')?.toNumber() || 0;
      console.log(`   ${label}: ${count}`);
    }
    
    // Check for meetings with documents
    console.log('\n📄 Meetings with Documents:');
    const meetingsWithDocsQuery = `
      MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document)
      RETURN m.title as meetingTitle, m.googleEventId as eventId, count(d) as docCount
      ORDER BY m.startTime DESC
      LIMIT 10
    `;
    
    const meetingsResult = await graphDatabaseService.executeQuery(meetingsWithDocsQuery);
    if (meetingsResult.records.length > 0) {
      meetingsResult.records.forEach(record => {
        const title = record.get('meetingTitle') || 'Untitled';
        const eventId = record.get('eventId');
        const docCount = record.get('docCount').toNumber();
        console.log(`   "${title}" (${eventId}): ${docCount} document(s)`);
      });
    } else {
      console.log('   ⚠️  No meetings with documents found!');
    }
    
    // Check for orphaned documents (documents not linked to meetings)
    console.log('\n🔍 Orphaned Documents:');
    const orphanedDocsQuery = `
      MATCH (d:Document)
      WHERE NOT (d)<-[:HAS_DOCUMENT]-()
      RETURN d.title as title, d.id as id
      LIMIT 5
    `;
    
    const orphanedResult = await graphDatabaseService.executeQuery(orphanedDocsQuery);
    if (orphanedResult.records.length > 0) {
      console.log('   ⚠️  Found orphaned documents:');
      orphanedResult.records.forEach(record => {
        const title = record.get('title') || 'Untitled';
        const id = record.get('id');
        console.log(`     "${title}" (${id})`);
      });
    } else {
      console.log('   ✅ No orphaned documents found');
    }
    
    // Check all relationship types that exist
    console.log('\n🏷️  All Relationship Types:');
    const relationshipTypesQuery = `
      MATCH ()-[r]->()
      RETURN DISTINCT type(r) as relType, count(r) as count
      ORDER BY count DESC
    `;
    
    const typesResult = await graphDatabaseService.executeQuery(relationshipTypesQuery);
    if (typesResult.records.length > 0) {
      typesResult.records.forEach(record => {
        const relType = record.get('relType');
        const count = record.get('count').toNumber();
        console.log(`   ${relType}: ${count}`);
      });
    } else {
      console.log('   ⚠️  No relationships found!');
    }
    
    console.log('\n✅ Verification complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error verifying relationships:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  verifyRelationships();
}

module.exports = verifyRelationships;
