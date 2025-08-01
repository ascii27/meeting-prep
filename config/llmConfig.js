/**
 * LLM Configuration
 * This file contains configuration for LiteLLM integration
 */

const config = {
  // Default provider to use
  defaultProvider: process.env.LLM_PROVIDER_DEFAULT || 'openai',
  
  // Model mappings for fallbacks
  // Format: { "primary-model": "fallback-model" }
  modelMappings: process.env.LLM_MODEL_MAPPING ? 
    JSON.parse(process.env.LLM_MODEL_MAPPING) : 
    {
      "gpt-4": "claude-2",
      "gpt-3.5-turbo": "claude-instant-1"
    },
  
  // Provider-specific configurations
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY
    }
  },
  
  // Default parameters for completions
  defaultParams: {
    temperature: 0.7,
    maxTokens: 1000
  }
};

module.exports = config;
