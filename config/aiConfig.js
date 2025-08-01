/**
 * AI Service Configuration
 * This file contains configuration for AI service selection and parameters
 */

const config = {
  // Which service to use: 'openai' or 'litellm'
  service: process.env.AI_SERVICE || 'openai',
  
  // OpenAI specific configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000')
  },
  
  // LiteLLM specific configuration
  litellm: {
    defaultProvider: process.env.LLM_PROVIDER_DEFAULT || 'openai',
    // LiteLLM API URL and authentication (optional)
    apiUrl: process.env.LITELLM_API_URL,
    apiKey: process.env.LITELLM_API_KEY,
    // Fallback models array
    // Format: Array of models to try in order ["primary-model", "fallback-model-1", "fallback-model-2"]
    fallbackModels: process.env.LLM_FALLBACK_MODELS ? 
      JSON.parse(process.env.LLM_FALLBACK_MODELS) : 
      ["gpt-4", "claude-2", "gpt-3.5-turbo"],
    // Provider-specific configurations
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4'
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-2'
      }
    },
    // Default parameters for completions
    defaultParams: {
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000')
    }
  }
};

module.exports = config;
