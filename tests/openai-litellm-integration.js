/**
 * OpenAI-LiteLLM Integration Test
 * This script tests the integration between OpenAI service and LiteLLM
 */

require('dotenv').config();
const openaiService = require('../services/openaiService');
const litellmService = require('../services/litellmService');

async function testOpenAILiteLLMIntegration() {
  console.log('Starting OpenAI-LiteLLM integration test...');
  
  try {
    // Test OpenAI service with a simple document summary request
    console.log('Testing document summary generation via OpenAI service...');
    
    const documentContent = `
      Meeting Agenda: Q3 Planning Session
      Date: August 5, 2025
      
      1. Review of Q2 Performance
         - Sales targets: Exceeded by 15%
         - Customer acquisition: 2,500 new customers (target: 2,000)
         - Product launch: Successfully launched Product X with positive feedback
      
      2. Q3 Goals and Objectives
         - Increase sales by 20% compared to Q2
         - Launch Product Y by end of quarter
         - Expand into European market
         - Hire 5 new developers for the mobile team
      
      3. Budget Allocation
         - Marketing: $500,000
         - R&D: $750,000
         - Operations: $300,000
         
      4. Action Items
         - John: Prepare European market entry strategy
         - Sarah: Finalize Product Y specifications
         - Michael: Review hiring plan for mobile team
         - Everyone: Submit department budgets by August 15
    `;
    
    const documentId = 'test-doc-123';
    const meetingId = 'test-meeting-456';
    
    const summary = await openaiService.generateSummary(documentContent, documentId, meetingId);
    
    console.log('Summary generated successfully:');
    console.log(summary);
    console.log('---\n');
    
    // Test meeting summary generation
    console.log('Testing meeting summary generation...');
    
    const meetingTitle = 'Q3 Planning Session';
    const documents = [
      { content: documentContent, title: 'Meeting Agenda' }
    ];
    
    const meetingSummary = await openaiService.generateMeetingSummary(meetingTitle, documents);
    
    console.log('Meeting summary generated successfully:');
    console.log('Summary:', meetingSummary.summary.substring(0, 100) + '...');
    console.log('Key Topics:', meetingSummary.keyTopics);
    console.log('Preparation Suggestions:', meetingSummary.preparationSuggestions);
    console.log('---\n');
    
    console.log('OpenAI-LiteLLM integration test completed successfully!');
  } catch (error) {
    console.error('Error during OpenAI-LiteLLM integration test:', error);
  }
}

// Run the test
testOpenAILiteLLMIntegration();
