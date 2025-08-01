/**
 * Test script for AI Service Router
 * Tests both OpenAI and LiteLLM services independently and through the router
 */

require('dotenv').config();
const aiService = require('../services/aiService');
const openaiService = require('../services/openaiService');
const litellmService = require('../services/litellmService');
const aiConfig = require('../config/aiConfig');

// Sample document content for testing
const sampleDocument = {
  content: `
Meeting Agenda: Q3 Product Roadmap Review
Date: September 15, 2023
Attendees: Product Team, Engineering Leads, Design Team

1. Introduction (10 min)
   - Welcome and meeting objectives
   - Review of Q2 accomplishments

2. Product Roadmap Updates (30 min)
   - Feature prioritization for Q3
   - Timeline adjustments
   - Resource allocation

3. Engineering Considerations (20 min)
   - Technical debt assessment
   - Infrastructure scaling plans
   - API improvements

4. Design Updates (15 min)
   - UI/UX refresh progress
   - User testing results
   - Accessibility improvements

5. Go-to-Market Strategy (15 min)
   - Launch timeline
   - Marketing campaign coordination
   - Success metrics

6. Q&A and Next Steps (10 min)
   - Open discussion
   - Action items assignment
  `,
  id: 'test-doc-001',
  meetingId: 'test-meeting-001'
};

// Test functions
async function testOpenAIDirectly() {
  console.log('\n=== Testing OpenAI Service Directly ===');
  try {
    console.log('Generating document summary...');
    const summary = await openaiService.generateSummary(
      sampleDocument.content,
      sampleDocument.id,
      sampleDocument.meetingId
    );
    console.log('Summary generated successfully!');
    console.log('Summary preview:', summary.substring(0, 150) + '...');
    return true;
  } catch (error) {
    console.error('OpenAI direct test failed:', error);
    return false;
  }
}

async function testLiteLLMDirectly() {
  console.log('\n=== Testing LiteLLM Service Directly ===');
  try {
    console.log('Generating document summary...');
    const summary = await litellmService.generateSummary(
      sampleDocument.content,
      sampleDocument.id,
      sampleDocument.meetingId
    );
    console.log('Summary generated successfully!');
    console.log('Summary preview:', summary.substring(0, 150) + '...');
    return true;
  } catch (error) {
    console.error('LiteLLM direct test failed:', error);
    return false;
  }
}

async function testAIServiceRouter(service) {
  console.log(`\n=== Testing AI Service Router with ${service.toUpperCase()} ===`);
  
  // Temporarily override the service setting
  const originalService = aiConfig.service;
  aiConfig.service = service;
  
  try {
    console.log(`Generating document summary using AI service router (${service})...`);
    const summary = await aiService.generateSummary(
      sampleDocument.content,
      sampleDocument.id,
      sampleDocument.meetingId
    );
    console.log('Summary generated successfully!');
    console.log('Summary preview:', summary.substring(0, 150) + '...');
    
    // Restore original service setting
    aiConfig.service = originalService;
    return true;
  } catch (error) {
    console.error(`AI service router test with ${service} failed:`, error);
    // Restore original service setting
    aiConfig.service = originalService;
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('Starting AI Service tests...');
  console.log('Current AI service configuration:');
  console.log(`- Active service: ${aiConfig.service}`);
  console.log(`- OpenAI model: ${aiConfig.openai.model}`);
  console.log(`- LiteLLM default provider: ${aiConfig.litellm.defaultProvider}`);
  
  // Test results
  const results = {
    openaiDirect: false,
    litellmDirect: false,
    routerWithOpenAI: false,
    routerWithLiteLLM: false
  };
  
  // Run tests
  results.openaiDirect = await testOpenAIDirectly();
  results.litellmDirect = await testLiteLLMDirectly();
  results.routerWithOpenAI = await testAIServiceRouter('openai');
  results.routerWithLiteLLM = await testAIServiceRouter('litellm');
  
  // Print summary
  console.log('\n=== Test Results Summary ===');
  console.log(`OpenAI Direct: ${results.openaiDirect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`LiteLLM Direct: ${results.litellmDirect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Router with OpenAI: ${results.routerWithOpenAI ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Router with LiteLLM: ${results.routerWithLiteLLM ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
