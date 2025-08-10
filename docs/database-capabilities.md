# Database Capabilities Documentation
## Meeting Intelligence Service - Query Planning Reference

This document provides comprehensive information about the database schema, available query types, and performance characteristics for the Intelligent Query Planning System.

## Database Architecture

### Primary Database: Neo4j Graph Database
- **Type**: Graph database optimized for relationship queries
- **Connection**: `neo4j://localhost:7687`
- **Database**: Configurable via `NEO4J_DATABASE` environment variable
- **Driver**: Neo4j JavaScript driver with session management

### Node Types and Schema

#### 1. Person Nodes
```cypher
(:Person {
  id: string,           // Unique identifier (UUID)
  email: string,        // Primary key, unique email address
  name: string,         // Display name
  photoUrl: string,     // Profile photo URL (optional)
  createdAt: datetime,  // Node creation timestamp
  updatedAt: datetime   // Last update timestamp
})
```

**Relationships:**
- `(:Person)-[:ATTENDED]->(:Meeting)` - Person attended a meeting
- `(:Person)-[:ORGANIZED]->(:Meeting)` - Person organized a meeting

#### 2. Meeting Nodes
```cypher
(:Meeting {
  id: string,              // Unique identifier (UUID)
  googleEventId: string,   // Google Calendar event ID (unique)
  title: string,           // Meeting title
  description: string,     // Meeting description
  startTime: datetime,     // Meeting start time
  endTime: datetime,       // Meeting end time
  location: string,        // Meeting location
  createdAt: datetime,     // Node creation timestamp
  updatedAt: datetime      // Last update timestamp
})
```

**Relationships:**
- `(:Meeting)<-[:ATTENDED]-(:Person)` - Meeting was attended by person
- `(:Meeting)<-[:ORGANIZED]-(:Person)` - Meeting was organized by person
- `(:Meeting)-[:HAS_DOCUMENT]->(:Document)` - Meeting has associated document

#### 3. Document Nodes
```cypher
(:Document {
  id: string,           // Unique identifier (UUID)
  title: string,        // Document title
  url: string,          // Document URL
  type: string,         // Document type ('google_doc', 'google_sheet', etc.)
  content: string,      // Document content (optional, for search)
  createdAt: datetime,  // Node creation timestamp
  updatedAt: datetime   // Last update timestamp
})
```

**Relationships:**
- `(:Document)<-[:HAS_DOCUMENT]-(:Meeting)` - Document is associated with meeting

## Available Query Types

### 1. Core Meeting Queries

#### find_meetings
**Purpose**: Find meetings based on various criteria
**Capabilities**:
- Filter by participants (email or name)
- Filter by timeframe (start/end dates)
- Filter by meeting title/description keywords
- Sort by start time (DESC by default)
- Limit results (default: 20)

**Example Cypher Pattern**:
```cypher
MATCH (m:Meeting)
WHERE m.startTime >= datetime($startDate) 
  AND m.startTime <= datetime($endDate)
  AND (m.title CONTAINS $keyword OR m.description CONTAINS $keyword)
RETURN m
ORDER BY m.startTime DESC
LIMIT $limit
```

**Performance**: Optimized with datetime and text indexes

#### get_participants
**Purpose**: Find people based on meeting participation patterns
**Capabilities**:
- Find participants in specific meetings
- Find people who attended meetings with specific keywords
- Filter by timeframe
- Include participation statistics

**Example Cypher Pattern**:
```cypher
MATCH (p:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)
WHERE m.startTime >= datetime($startDate)
RETURN p, count(m) as meetingCount
ORDER BY meetingCount DESC
```

#### find_documents
**Purpose**: Find documents associated with meetings
**Capabilities**:
- Filter by document title/content
- Filter by associated meeting criteria
- Filter by document type
- Include meeting context

**Example Cypher Pattern**:
```cypher
MATCH (d:Document)<-[:HAS_DOCUMENT]-(m:Meeting)
WHERE d.title CONTAINS $keyword
RETURN d, m
ORDER BY m.startTime DESC
```

#### get_meeting_content
**Purpose**: Retrieve and analyze actual meeting document content
**Capabilities**:
- Find meetings with associated documents
- Fetch full document content from Google Docs
- Extract meeting summaries and key points
- Analyze what was discussed in meetings
- Identify action items and decisions made
- Filter by participants, timeframe, or meeting keywords

**Use Cases**:
- "What was discussed in my 1:1 with [person]?"
- "What were the action items from the [meeting name]?"
- "Summarize the key decisions from meetings last week"
- "What topics were covered in [department] meetings?"

**Example Cypher Pattern**:
```cypher
MATCH (m:Meeting)-[:HAS_DOCUMENT]->(d:Document)
WHERE m.startTime >= datetime($startDate)
  AND EXISTS((m)<-[:ATTENDED|ORGANIZED]-(:Person {email: $userEmail}))
RETURN m, collect(d) as documents
ORDER BY m.startTime DESC
```

**Note**: Requires user authentication tokens to fetch document content from Google Docs API.

### 2. Relationship Analysis Queries

#### analyze_relationships
**Purpose**: Analyze relationships between people and meetings
**Capabilities**:
- Find collaboration patterns
- Identify frequent meeting partners
- Analyze meeting networks
- Calculate relationship strength

**Example Cypher Pattern**:
```cypher
MATCH (p1:Person)-[:ATTENDED|ORGANIZED]->(m:Meeting)<-[:ATTENDED|ORGANIZED]-(p2:Person)
WHERE p1 <> p2
RETURN p1, p2, count(m) as collaborationCount
ORDER BY collaborationCount DESC
```

### 3. Advanced Organizational Intelligence

#### analyze_collaboration
**Purpose**: Deep analysis of collaboration patterns
**Capabilities**:
- Cross-department collaboration analysis
- Collaboration frequency over time
- Team formation patterns
- Collaboration network analysis

#### find_frequent_collaborators
**Purpose**: Identify key working relationships
**Capabilities**:
- Find top N collaborators for a person
- Calculate collaboration strength scores
- Identify collaboration trends
- Filter by timeframe

#### analyze_meeting_patterns
**Purpose**: Analyze meeting frequency and timing patterns
**Capabilities**:
- Meeting frequency by day of week
- Meeting frequency by hour of day
- Meeting duration analysis
- Seasonal meeting patterns

#### get_department_insights
**Purpose**: Department-specific analytics
**Capabilities**:
- Meeting frequency by department (inferred from email domains)
- Cross-department meeting analysis
- Department collaboration patterns
- Department meeting trends

#### analyze_topic_trends
**Purpose**: Content and topic analysis
**Capabilities**:
- Trending meeting topics (from titles/descriptions)
- Topic frequency over time
- Topic correlation analysis
- Emerging topics identification

#### find_meeting_conflicts
**Purpose**: Scheduling conflict detection
**Capabilities**:
- Overlapping meeting detection
- Double-booked participants
- Scheduling pattern analysis
- Conflict resolution suggestions

#### get_productivity_insights
**Purpose**: Personal and team productivity metrics
**Capabilities**:
- Meeting load analysis
- Focus time calculation
- Meeting efficiency metrics
- Productivity trend analysis

#### analyze_communication_flow
**Purpose**: Organizational communication pattern analysis
**Capabilities**:
- Communication network mapping
- Information flow analysis
- Communication bottleneck identification
- Cross-team communication patterns

### 4. Fuzzy Search Capabilities

#### Enhanced Search Features
**Purpose**: Typo-tolerant, relevance-ranked search
**Capabilities**:
- Multi-entity search (people, meetings, topics)
- Substring matching with relevance scoring
- Partial name/email matching
- Word similarity matching
- Top 15 results with confidence scores

## Query Performance Characteristics

### Indexing Strategy
```cypher
// Recommended indexes for optimal performance
CREATE INDEX person_email IF NOT EXISTS FOR (p:Person) ON (p.email);
CREATE INDEX meeting_start_time IF NOT EXISTS FOR (m:Meeting) ON (m.startTime);
CREATE INDEX meeting_google_id IF NOT EXISTS FOR (m:Meeting) ON (m.googleEventId);
CREATE INDEX document_title IF NOT EXISTS FOR (d:Document) ON (d.title);
```

### Performance Guidelines

#### Fast Queries (< 100ms)
- Single person lookup by email
- Meeting lookup by Google Event ID
- Document lookup by ID
- Simple relationship queries with indexed properties

#### Medium Queries (100ms - 1s)
- Meeting searches with date ranges
- Participant queries with aggregation
- Simple collaboration analysis
- Document searches with content filtering

#### Slow Queries (1s - 5s)
- Complex collaboration network analysis
- Large-scale pattern analysis
- Cross-department analytics
- Topic trend analysis over long periods

#### Resource-Intensive Queries (5s+)
- Full organizational network analysis
- Complex multi-step relationship queries
- Large dataset aggregations
- Advanced analytics with multiple joins

### Query Optimization Recommendations

#### Use Indexed Properties
- Always filter by `Person.email` when possible
- Use `Meeting.startTime` for temporal filtering
- Leverage `Meeting.googleEventId` for specific meeting lookups

#### Limit Result Sets
- Default limits: meetings (20), participants (50), documents (30)
- Use pagination for large result sets
- Apply time-based filtering to reduce scope

#### Optimize Relationship Traversals
- Use specific relationship types (`:ATTENDED` vs `:ORGANIZED`)
- Limit traversal depth for network analysis
- Use `LIMIT` clauses in subqueries

## Timeframe Parsing Capabilities

### Supported Natural Language Patterns
- **Absolute**: "today", "yesterday", "this week", "last week", "this month", "last month"
- **Relative**: "recent", "lately", "past few days"
- **Specific Days**: "Monday", "last Friday", "this Tuesday"
- **Number-based**: "last 3 days", "past 2 weeks", "last 30 days"
- **Date Ranges**: "January 2024", "Q1 2024", "this quarter"

### Timeframe Processing
- Returns ISO datetime strings for database queries
- Includes metadata (type, description, boundaries)
- Handles timezone considerations
- Provides fallback defaults (30 days for "recent")

## Error Handling and Limitations

### Common Error Scenarios
1. **Connection Failures**: Neo4j database unavailable
2. **Query Timeouts**: Complex queries exceeding time limits
3. **Memory Limits**: Large result sets causing memory issues
4. **Invalid Parameters**: Malformed dates, invalid UUIDs

### Mitigation Strategies
1. **Connection Retry**: Automatic reconnection with exponential backoff
2. **Query Optimization**: Automatic query simplification for timeouts
3. **Result Pagination**: Chunked result processing for large datasets
4. **Parameter Validation**: Input sanitization and validation

### Resource Limits
- **Max Query Time**: 30 seconds (configurable)
- **Max Result Set**: 10,000 records per query
- **Max Concurrent Sessions**: 100 (configurable)
- **Memory Limit**: 2GB per query (configurable)

## Integration Guidelines for Query Planning

### Query Strategy Considerations
1. **Start Simple**: Begin with indexed lookups, then expand
2. **Use Filters Early**: Apply time/person filters before complex operations
3. **Batch Related Queries**: Combine similar operations when possible
4. **Monitor Performance**: Track query execution times and optimize

### Multi-Step Query Patterns
1. **Person → Meetings → Analysis**: Start with person lookup, find meetings, analyze patterns
2. **Timeframe → Entities → Relationships**: Filter by time, identify entities, analyze relationships
3. **Topic → Meetings → Participants**: Search by topic, find meetings, identify participants

### Recommended Query Sequences
1. **Collaboration Analysis**: Person lookup → Meeting participation → Relationship analysis
2. **Department Insights**: Email domain analysis → Meeting patterns → Cross-department analysis
3. **Productivity Analysis**: Person meetings → Time analysis → Productivity metrics

This documentation provides the foundation for intelligent query planning, enabling the LLM to understand available capabilities and make informed decisions about query strategies.
