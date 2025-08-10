// Debug Queries for Meeting Documents Investigation
// Run these in Neo4j Browser or through your Neo4j client

// 1. Check if there are any Document nodes at all
MATCH (d:Document)
RETURN count(d) as totalDocuments, collect(d.title)[0..5] as sampleTitles;

// 2. Check if there are any HAS_DOCUMENT relationships
MATCH (m:Meeting)-[r:HAS_DOCUMENT]->(d:Document)
RETURN count(r) as totalRelationships, 
       collect(DISTINCT m.title)[0..3] as meetingsWithDocs,
       collect(DISTINCT d.title)[0..3] as documentTitles;

// 3. Find all meetings and check which ones have documents
MATCH (m:Meeting)
OPTIONAL MATCH (m)-[:HAS_DOCUMENT]->(d:Document)
WITH m, collect(d.title) as documents
RETURN m.title, m.startTime, documents
ORDER BY m.startTime DESC
LIMIT 10;

// 4. Look specifically for meetings with "Tae" or similar names
MATCH (m:Meeting)-[:ATTENDED|ORGANIZED]-(p:Person)
WHERE p.name CONTAINS 'Tae' OR p.email CONTAINS 'tae' OR p.name CONTAINS 'mshibuya'
OPTIONAL MATCH (m)-[:HAS_DOCUMENT]->(d:Document)
WITH m, p, collect(d.title) as documents
RETURN m.title, m.startTime, p.name, p.email, documents
ORDER BY m.startTime DESC;

// 5. Check what person records exist for Tae/mshibuya
MATCH (p:Person)
WHERE p.name CONTAINS 'Tae' OR p.email CONTAINS 'tae' OR p.name CONTAINS 'mshibuya' OR p.email CONTAINS 'mshibuya'
RETURN p.name, p.email, p.id;

// 6. Find the most recent 1:1 meetings (meetings with exactly 2 participants)
MATCH (m:Meeting)
WITH m, [(m)<-[:ATTENDED|ORGANIZED]-(p:Person) | p] as participants
WHERE size(participants) = 2
OPTIONAL MATCH (m)-[:HAS_DOCUMENT]->(d:Document)
WITH m, participants, collect(d.title) as documents
RETURN m.title, m.startTime, 
       [p IN participants | p.name] as participantNames,
       [p IN participants | p.email] as participantEmails,
       documents
ORDER BY m.startTime DESC
LIMIT 10;

// 7. Check if documents exist but aren't linked to meetings
MATCH (d:Document)
WHERE NOT EXISTS((d)<-[:HAS_DOCUMENT]-(:Meeting))
RETURN count(d) as unlinkedDocuments, collect(d.title)[0..5] as sampleUnlinkedTitles;

// 8. Find all relationship types in the database to understand the schema
CALL db.relationshipTypes() YIELD relationshipType
RETURN relationshipType
ORDER BY relationshipType;

// 9. Check what Document nodes exist (if any)
MATCH (d:Document)
RETURN d.id, d.title, d.url, d.createdAt
LIMIT 10;

// 10. Check if documents are stored differently or with different relationships
MATCH (n)
WHERE n:Document
OPTIONAL MATCH (n)-[r]-(connected)
RETURN n, type(r) as relationshipType, labels(connected) as connectedNodeLabels
LIMIT 10;
