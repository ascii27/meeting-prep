// Test query to find Snehal meetings with documents

// 1. Find all meetings with Snehal
MATCH (m:Meeting)-[:ATTENDED|ORGANIZED]-(p:Person)
WHERE p.email CONTAINS 'snehal' OR toLower(p.name) CONTAINS 'snehal'
RETURN m.title, m.startTime, m.googleEventId, p.name, p.email
ORDER BY m.startTime DESC
LIMIT 10;

// 2. Find meetings with "1:1" and "Snehal" in title
MATCH (m:Meeting)
WHERE toLower(m.title) CONTAINS '1:1' AND toLower(m.title) CONTAINS 'snehal'
RETURN m.title, m.startTime, m.googleEventId
ORDER BY m.startTime DESC;

// 3. Find the specific meeting with documents
MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document)
WHERE toLower(m.title) CONTAINS '1:1' AND toLower(m.title) CONTAINS 'snehal'
RETURN m.title, m.startTime, m.googleEventId, d.title, d.id
ORDER BY m.startTime DESC;

// 4. Check if there are any Person nodes with "Snehal"
MATCH (p:Person)
WHERE toLower(p.name) CONTAINS 'snehal' OR toLower(p.email) CONTAINS 'snehal'
RETURN p.name, p.email;
