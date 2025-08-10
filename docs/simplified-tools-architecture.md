# Simplified Graph Database Tools Architecture

## Overview

This document describes the new simplified architecture for LLM interaction with the graph database. The goal is to reduce complexity and improve LLM query planning accuracy by providing a clean, focused set of tools.

## Problem Statement

The original system had several issues:
- **Too many complex tools** (14 different functions)
- **Confusing parameter formats** and requirements
- **LLM struggles** to understand what tools to use
- **Complex documentation** that confused the LLM

## Solution: Simplified Tools Architecture

### Core Components

1. **`simplifiedGraphTools.js`** - Core data access layer
   - 5 focused tools wrapping graph database calls
   - Clean input/output formats
   - Consistent parameter handling

2. **`simplifiedLLMQueryService.js`** - LLM interface layer
   - Maps LLM requests to graph tools
   - Tool suggestion and parameter extraction
   - Error handling and validation

3. **`simplifiedIterativeQueryService.js`** - Query orchestration
   - Intelligent query planning
   - Multi-step query execution
   - Result synthesis

4. **`simplified-tools.md`** - Clean documentation
   - Focus only on available tools
   - Clear input/output specifications
   - Simple use case examples

## Available Tools

### 1. `find_meetings(criteria)`
Find meetings by person, timeframe, or keywords.

**Example:**
```javascript
await find_meetings({
  person: "Snehal",
  timeframe: "last week",
  keywords: "1:1"
});
```

### 2. `find_documents(criteria)`
Find documents and their content from meetings.

**Example:**
```javascript
await find_documents({
  person: "Snehal",
  keywords: "action items"
});
```

### 3. `find_people(criteria)`
Find people and their participation data.

**Example:**
```javascript
await find_people({
  meeting_keywords: "standup",
  timeframe: "last month"
});
```

### 4. `get_meeting_details(meeting_id)`
Get complete details for a specific meeting.

**Example:**
```javascript
await get_meeting_details("abc123");
```

### 5. `analyze_patterns(type, criteria)`
Analyze patterns in meetings, documents, or collaboration.

**Example:**
```javascript
await analyze_patterns("collaboration", {
  person: "Snehal",
  timeframe: "last month"
});
```

## API Endpoints

### New Simplified Intelligence API

- **`POST /api/simplified-intelligence/query`** - Process natural language queries
- **`POST /api/simplified-intelligence/test-tool`** - Test individual tools
- **`GET /api/simplified-intelligence/tools`** - Get available tools
- **`POST /api/simplified-intelligence/suggest-tool`** - Get tool suggestions

### Example Usage

```javascript
// Natural language query
POST /api/simplified-intelligence/query
{
  "query": "What did I discuss with Snehal yesterday?"
}

// Direct tool testing
POST /api/simplified-intelligence/test-tool
{
  "tool": "find_meetings",
  "parameters": {
    "person": "Snehal",
    "timeframe": "yesterday"
  }
}
```

## Benefits

1. **Reduced Complexity**: 5 tools instead of 14
2. **Clear Interface**: Consistent input/output formats
3. **Better LLM Understanding**: Simplified documentation
4. **Improved Accuracy**: Focused tool selection
5. **Easier Maintenance**: Clean separation of concerns

## Migration Strategy

1. **Phase 1**: Create simplified tools (✅ Complete)
2. **Phase 2**: Test and validate functionality (✅ Complete)
3. **Phase 3**: Update LLM strategy prompts (✅ Complete)
4. **Phase 4**: Replace complex query handlers (✅ Complete)
5. **Phase 5**: Remove legacy tools (✅ Complete)

## Testing

Run the test script to validate functionality:

```bash
node test-simplified-tools.js
```

## File Structure

```
services/intelligence/
├── graph/
│   └── simplifiedGraphTools.js          # Core data access
├── llm/
│   └── simplifiedLLMQueryService.js     # LLM interface
└── simplifiedIterativeQueryService.js   # Query orchestration

docs/
├── simplified-tools.md                  # LLM documentation
└── simplified-tools-architecture.md     # This file

routes/
└── simplified-intelligence.js           # API endpoints

test-simplified-tools.js                 # Test script
```

## Next Steps

1. **Test with real queries** to validate functionality
2. **Update LLM strategy prompts** to use simplified tools
3. **Monitor performance** and accuracy improvements
4. **Gather feedback** and iterate on tool design
5. **Complete migration** from legacy system

## Success Metrics

- ✅ Reduced tool count from 14 to 5
- ✅ Clean, consistent API interface
- ✅ Simplified documentation for LLM
- ✅ Complete migration from legacy system
- ✅ All simplified tools validated and functional
- ✅ LLM strategy prompts updated for new tools
- ✅ Parameter extraction working correctly
- ✅ Tool coverage complete (5/5 tools available)
- 🔄 Improved LLM query planning accuracy (to be measured in production)
- 🔄 Faster query execution (to be measured in production)
- 🔄 Better user experience (to be measured in production)
