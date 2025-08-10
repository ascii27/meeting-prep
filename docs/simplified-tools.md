# Simplified Graph Database Tools
## Available Tools for Meeting Intelligence Queries

### 1. find_meetings
**Purpose**: Find meetings based on search criteria
**Input Parameters**:
```json
{
  "person": "Snehal",              // Person name or email (optional)
  "timeframe": "2025-08-08",       // Date, "yesterday", "last week", etc. (optional)
  "keywords": "1:1",               // Keywords in meeting title/description (optional)
  "limit": 50                      // Max results (optional, default: 50)
}
```
**Output**: List of meetings with basic details
**Use Cases**: 
- "Find my meetings with Snehal"
- "What meetings did I have yesterday?"
- "Find all 1:1 meetings last week"

### 2. find_documents
**Purpose**: Find documents and their content
**Input Parameters**:
```json
{
  "meeting_id": "abc123",          // Specific meeting ID (optional)
  "person": "Snehal",              // Person associated with meetings (optional)
  "keywords": "action items",      // Keywords in document title/content (optional)
  "limit": 20                      // Max results (optional, default: 20)
}
```
**Output**: List of documents with full content and associated meeting info
**Use Cases**:
- "Find documents from my meeting with Snehal"
- "Get all documents with action items"
- "What documents are available for meeting X?"

### 3. find_people
**Purpose**: Find people and their participation data
**Input Parameters**:
```json
{
  "name": "Snehal",                // Person name or email to search (optional)
  "meeting_keywords": "1:1",       // Find people in meetings with these keywords (optional)
  "timeframe": "last week",        // Time period to analyze (optional)
  "limit": 20                      // Max results (optional, default: 20)
}
```
**Output**: List of people with participation statistics
**Use Cases**:
- "Who attended 1:1 meetings last week?"
- "Find people I meet with regularly"
- "Who was in the team sync meetings?"

### 4. get_meeting_details
**Purpose**: Get complete details for a specific meeting
**Input Parameters**:
```json
{
  "meeting_id": "abc123"           // Meeting ID or googleEventId (required)
}
```
**Output**: Complete meeting details including documents, attendees, organizers
**Use Cases**:
- "Get full details for meeting X"
- "What documents and attendees were in this meeting?"
- "Show me everything about this specific meeting"

### 5. analyze_patterns
**Purpose**: Analyze patterns in meetings, documents, or collaboration
**Input Parameters**:
```json
{
  "type": "collaboration",         // Analysis type: "collaboration", "meeting_frequency", "document_trends"
  "criteria": {                    // Additional criteria based on analysis type
    "person": "Snehal",
    "timeframe": "last month"
  }
}
```
**Output**: Analysis results with patterns and insights
**Use Cases**:
- "Analyze my collaboration patterns with Snehal"
- "How often do I have meetings?"
- "What are the document trends in our team?"

## Tool Selection Guidelines

### For Content Questions:
- **"What was discussed in my 1:1 with Snehal?"**
  1. Use `find_meetings` with person="Snehal", keywords="1:1"
  2. Use `find_documents` with person="Snehal" to get content
  3. Use `get_meeting_details` for specific meeting if needed

### For Finding Information:
- **"Who did I meet with yesterday?"**
  1. Use `find_meetings` with timeframe="yesterday"
  2. Use `find_people` if you need participation details

### For Analysis:
- **"How often do I meet with my team?"**
  1. Use `analyze_patterns` with type="meeting_frequency"
  2. Use `find_meetings` with appropriate filters for raw data

## Response Format
All tools return consistent format:
```json
{
  "type": "tool_type",
  "count": 5,
  "data": [...],
  "criteria": {...}
}
```

## Important Notes
- All parameters are optional unless marked as required
- Use specific person names/emails for better results
- Timeframe accepts dates (2025-08-08) or relative terms (yesterday, last week)
- Keywords search both titles and content/descriptions
- Tools automatically handle case-insensitive matching
