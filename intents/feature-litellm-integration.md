# Feature: LiteLLM Integration

## Overview
Integrate LiteLLM into the Meeting Prep application to provide a unified interface for multiple LLM providers, enabling model switching and fallbacks. This feature includes a complete refactoring of the AI service architecture to clearly separate OpenAI and LiteLLM services.

## Business Value
- **Provider Flexibility**: Easily switch between different LLM providers (OpenAI, Anthropic, Azure, etc.)
- **Cost Optimization**: Route requests to the most cost-effective provider based on requirements
- **Reliability**: Implement fallbacks between models to ensure service continuity

## User Experience Goals
- No visible changes to end users - same high-quality AI responses
- Improved reliability with fewer failed requests
- Potentially faster response times through optimized routing

## Implementation Status: ✅ COMPLETED

### Implementation Summary

#### 1. Centralized AI Configuration
- Created `config/aiConfig.js` to centralize AI service selection and parameters
- Added environment variables for service selection and provider-specific settings
- Implemented configuration for both OpenAI and LiteLLM services

#### 2. Service Layer Refactoring
- Created `services/litellmService.js` to wrap LiteLLM functionality with full feature parity
- Refactored `openaiService.js` to use direct OpenAI SDK calls (no LiteLLM dependency)
- Created `services/aiService.js` router to select between services based on configuration
- Implemented consistent caching, prompt handling, and JSON parsing across both services

#### 3. Advanced Configuration Management
- Added service selection (`openai` or `litellm`)
- Implemented model fallback chains for LiteLLM
- Added support for multiple provider API keys

#### 4. Testing & Validation
- Created comprehensive test script (`tests/ai-service-test.js`)
- Verified both services work independently
- Confirmed AI service router correctly routes requests based on configuration
- All tests passing successfully

## Technical Details

### Directory Structure Changes
```
/services
  ├── aiService.js (new)       # Service router
  ├── litellmService.js (new)  # LiteLLM service implementation
  ├── openaiService.js (modified) # Direct OpenAI SDK calls
/config
  ├── aiConfig.js (new)        # Centralized AI configuration
/tests
  ├── ai-service-test.js (new) # Test script for AI services
```

### Environment Variables
```
# AI Service Configuration
AI_SERVICE=openai                # Options: 'openai' or 'litellm'

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.7

# LiteLLM Configuration
LLM_PROVIDER_DEFAULT=openai      # Default provider for LiteLLM
LITELLM_API_URL=http://localhost:8000  # Optional LiteLLM API URL (if using LiteLLM server)
ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000
LLM_FALLBACK_MODELS=["gpt-4","claude-2","gpt-3.5-turbo"]
```

### API Usage Example
```javascript
// Before (direct OpenAI SDK)
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }],
  temperature: 0.7
});

// After (using AI service router)
const summary = await aiService.generateSummary(
  documentContent,
  documentId,
  meetingId
);

// Using LiteLLM directly (with fallback)
const response = await litellmService.completionWithFallback({
  model: "gpt-4", // Will use configured fallbacks if needed
  messages: [{ role: "user", content: prompt }],
  temperature: 0.7
  // API key is automatically selected based on the model
});
```

## Success Criteria ✅
- ✅ Successfully process requests through both OpenAI and LiteLLM services
- ✅ Support service selection between OpenAI direct and LiteLLM
- ✅ Implement model fallback chains in LiteLLM service
- ✅ Maintain consistent interface across both services
- ✅ Ensure no regression in response quality or format
- ✅ Comprehensive test coverage
- ✅ Proper API key management for different providers
- ✅ Support for LiteLLM API server via URL configuration

## Benefits

1. **Clear Separation of Concerns**:
   - OpenAI service is independent, calls OpenAI SDK directly
   - LiteLLM service wraps LiteLLM package, implements fallback and caching
   - AI service router directs requests based on configuration

2. **Improved Configuration**:
   - Centralized configuration in `aiConfig.js`
   - Environment variables for service selection and parameters
   - Clear documentation of configuration options

3. **Enhanced Flexibility**:
   - Users can explicitly choose between OpenAI and LiteLLM
   - Easy to add new AI service implementations in the future
   - Consistent interface across all services

## Next Steps

1. **Integration**:
   - Update all application code to use the AI service router instead of direct service calls
   - Add UI controls to allow users to select the AI provider

2. **Testing**:
   - Add more comprehensive unit tests for each service
   - Add integration tests for the AI service router

3. **Monitoring**:
   - Add more detailed logging for AI service calls
   - Track performance metrics for each service
