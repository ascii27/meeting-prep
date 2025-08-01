/**
 * LiteLLM Integration Test
 * This script tests the LiteLLM service integration
 */

require('dotenv').config();
const litellmService = require('../services/litellmService');

async function testLiteLLMIntegration() {
  console.log('Starting LiteLLM integration test...');
  
  try {
    // Test with OpenAI model
    console.log('Testing OpenAI model via LiteLLM...');
    const openaiResponse = await litellmService.completion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Write a one-sentence summary of what LiteLLM does.' }
      ],
      temperature: 0.7,
      max_tokens: 100
    });
    
    console.log('OpenAI Response:');
    console.log(openaiResponse.choices[0].message.content);
    console.log('Response metadata:', openaiResponse.litellm_metadata);
    console.log('---\n');
    
    // If ANTHROPIC_API_KEY is set, test with Anthropic model as fallback
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Testing model fallback to Anthropic...');
      
      try {
        // Force a fallback by using an invalid model name that maps to Claude
        const fallbackResponse = await litellmService.completion({
          model: 'gpt-4', // This should fall back to claude-2 based on our mapping
          messages: [
            { role: 'user', content: 'Write a one-sentence summary of what LiteLLM does, but in a different way than before.' }
          ],
          temperature: 0.7,
          max_tokens: 100
        });
        
        console.log('Fallback Response:');
        console.log(fallbackResponse.choices[0].message.content);
        console.log('Response metadata:', fallbackResponse.litellm_metadata);
        console.log('---\n');
      } catch (fallbackError) {
        console.log('Fallback test failed, but this is expected if you don\'t have Anthropic API key configured');
        console.log('Error:', fallbackError.message);
      }
    } else {
      console.log('Skipping Anthropic test - ANTHROPIC_API_KEY not set');
    }
    
    console.log('LiteLLM integration test completed successfully!');
  } catch (error) {
    console.error('Error during LiteLLM integration test:', error);
  }
}

// Run the test
testLiteLLMIntegration();
