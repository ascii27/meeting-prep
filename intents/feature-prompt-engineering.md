# Feature Intent: Prompt Engineering & Management

## Overview

The Prompt Engineering & Management feature aims to improve the quality and maintainability of AI-generated content throughout the Meeting Prep Assistant by centralizing prompt management and iteratively refining prompt templates. This will enhance the usefulness of meeting summaries, daily briefings, and other AI-generated content while making the system more maintainable.

## Why We Need This Feature

### Business Value
- **Improved Content Quality**: Better prompts lead to more useful, actionable meeting summaries and daily briefings
- **Consistency**: Standardized prompt structure ensures consistent output format and quality
- **Maintainability**: Centralized prompt management makes updates and improvements easier
- **Iteration Speed**: Dedicated prompt files enable rapid experimentation and A/B testing
- **Cost Optimization**: More efficient prompts can reduce token usage and API costs

### User Experience Goals
- **More Relevant Insights**: Summaries and briefings that highlight truly important information
- **Better Preparation Guidance**: Clearer, more actionable preparation suggestions
- **Personalized Content**: Content tailored to user's role and meeting context
- **Consistent Format**: Predictable structure that users can quickly scan and understand
- **Reduced Noise**: Less generic content, more specific and useful information

## Current Limitations

### Technical Issues
- **Scattered Prompts**: Prompt templates are embedded directly in service files, making them hard to locate and update
- **Inconsistent Structure**: Different prompts follow different formats and approaches
- **Limited Context**: Prompts don't effectively leverage all available meeting and document context
- **No Version Control**: Changes to prompts are difficult to track and roll back if needed
- **Hardcoded Parameters**: Temperature, max tokens, and other parameters are hardcoded in service files

### Content Quality Issues
- **Generic Summaries**: Meeting summaries often contain obvious or generic information
- **Lack of Prioritization**: Important information isn't distinguished from routine details
- **Missing Context**: Cross-meeting relationships and patterns aren't identified
- **Weak Action Items**: Preparation suggestions lack specificity and actionability
- **Poor Formatting**: Content structure doesn't optimize for quick scanning and comprehension

## Current Prompt Analysis

### Document Analysis Prompt

#### Current Implementation
```javascript
{
  role: 'system',
  content: 'I have a long internal meeting document. Please extract the following: 1. Short Narrative Summary (3–5 sentences): Capture the purpose and main themes of the meeting in a natural tone, suitable for sharing in an internal update.  2. High-Value Preparation List: Provide a short list (5–7 bullets max) of the most important actions, follow-ups, or items I should prepare before the next meeting. Focus on high-leverage items that drive planning, decision-making, or unblock others.  Keep your response concise, clear, and focused on execution.'
}
```

#### Example Input
```
Meeting Title: Q3 Product Roadmap Review
Date: August 15, 2025
Document Content:

Q3 Product Roadmap Review

Attendees: Sarah Johnson (Product Manager), Michael Chen (Engineering Lead), Priya Patel (UX Designer), David Wilson (QA Lead), Emma Rodriguez (Marketing)

Agenda:
1. Review Q2 deliverables and milestones
2. Discuss customer feedback from recent releases
3. Prioritize features for Q3
4. Allocate resources and set timelines
5. Address technical debt concerns

Q2 Review:
- Successfully launched v2.3 with 85% of planned features
- User engagement increased by 18% after UI redesign
- API performance improved by 32% after backend optimizations
- Mobile app downloads up 24% MoM
- Received 4.2/5 average rating from user feedback

Customer Feedback Highlights:
- Users love the new dashboard layout (+92% positive sentiment)
- Search functionality still causing frustration (-65% sentiment)
- Export feature highly requested (156 mentions in feedback)
- Mobile notification system needs refinement (42 support tickets)

Q3 Feature Priorities Discussion:
1. Search functionality overhaul
   - Michael suggests implementing Elasticsearch
   - Estimated effort: 3 sprints
   - Dependencies: Data migration, API updates

2. Export functionality
   - Multiple format support (PDF, CSV, Excel)
   - Estimated effort: 2 sprints
   - Priya to design export UI by next week

3. Mobile notification improvements
   - User preference settings
   - Quiet hours feature
   - Categorized notifications
   - David to coordinate testing plan

4. Technical debt reduction
   - Refactor authentication system
   - Update deprecated libraries
   - Improve test coverage (currently at 72%)

Resource Allocation:
- Search team: 3 engineers, 1 designer
- Export feature: 2 engineers
- Mobile notifications: 2 engineers, 1 QA
- Technical debt: 1 dedicated engineer per sprint

Timelines:
- Search overhaul: Start Aug 20, complete by Oct 1
- Export feature: Start Aug 25, complete by Sept 15
- Mobile notifications: Start Sept 10, complete by Oct 5
- Technical debt: Ongoing, 20% of sprint capacity

Action Items:
- Sarah to finalize Q3 roadmap document by Aug 18
- Michael to create technical specifications for search by Aug 22
- Priya to deliver export UI mockups by Aug 20
- Emma to prepare communication plan for customers by Sept 1
- David to update test automation framework by Aug 30

Next Steps:
- Weekly progress reviews every Monday at 10am
- Mid-quarter review scheduled for Sept 15
- Start Q4 planning process in early September
```

#### Current Output
```html
<h1>Meeting Summary</h1>
<p>The Q3 Product Roadmap Review meeting focused on evaluating Q2 achievements, analyzing customer feedback, and planning priorities for Q3. The team reviewed successful Q2 deliverables including a v2.3 launch, increased user engagement, and improved API performance. Based on customer feedback, they identified key areas for improvement including search functionality, export features, and mobile notifications.</p>

<h2>High-Value Preparation List</h2>
<ul>
<li>Review the finalized Q3 roadmap document from Sarah (due Aug 18)</li>
<li>Examine technical specifications for the search overhaul (due Aug 22)</li>
<li>Evaluate export UI mockups from Priya (due Aug 20)</li>
<li>Prepare questions/input for the resource allocation plan, especially regarding technical debt reduction</li>
<li>Consider implications of the search functionality overhaul on other system components</li>
</ul>
```

#### Desired Output
```html
<h1>Q3 Product Roadmap Review</h1>

<h2>Key Context</h2>
<p>This meeting evaluates Q2 results and sets Q3 priorities based on customer feedback and technical needs. The team achieved strong Q2 results (v2.3 launch, 18% engagement increase) but identified critical improvement areas from user feedback.</p>

<h2>Critical Decisions Needed</h2>
<ul>
<li><strong>Resource Allocation Priority:</strong> Search overhaul vs. export functionality - both are high customer priorities but have overlapping timelines</li>
<li><strong>Technical Debt Approach:</strong> Need to decide if 20% sprint capacity is sufficient given authentication system risks</li>
</ul>

<h2>Strategic Preparation Actions</h2>
<ul>
<li><strong>Review Search Data:</strong> Examine specific user complaints about search (42 support tickets) to identify exact pain points</li>
<li><strong>Evaluate Elasticsearch Implementation:</strong> Assess Michael's proposal against alternatives considering the 3-sprint timeline</li>
<li><strong>Export Feature Scope:</strong> Prepare position on whether all three formats (PDF, CSV, Excel) are necessary for initial release</li>
<li><strong>Technical Debt Risk Assessment:</strong> Review authentication system vulnerabilities mentioned in the technical debt section</li>
<li><strong>Timeline Conflicts:</strong> Identify potential resource conflicts between the Aug 20-Sept 15 overlapping project timelines</li>
</ul>

<h2>People Dynamics</h2>
<ul>
<li><strong>Michael (Engineering Lead):</strong> Advocating for Elasticsearch solution and likely concerned about technical debt</li>
<li><strong>Priya (UX Designer):</strong> Focused on export UI design with tight deadline (by next week)</li>
<li><strong>David (QA Lead):</strong> Responsible for test automation framework updates and mobile testing coordination</li>
</ul>
```

### Meeting Preparation Prompt

#### Current Implementation
```javascript
const prompt = `You are an AI assistant helping to prepare for a meeting. Please analyze the following documents for the meeting "${meetingTitle}" and provide:

1. A concise summary (2-3 paragraphs) of the key information
2. A list of key topics that will likely be discussed
3. Specific preparation suggestions for the attendee

Documents:
${combinedContent}

Please format your response as JSON with the following structure:
{
  "summary": "Your summary here",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "preparationSuggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;  
```

#### Example Input
```
Meeting Title: Annual Budget Review with Finance Department

Documents:

Document 1: Budget Proposal FY2026

FY2026 BUDGET PROPOSAL
Prepared by: Finance Department
Date: July 25, 2025

EXECUTIVE SUMMARY

This budget proposal outlines the financial plan for FY2026, with a total requested budget of $4.2M, representing a 12% increase from FY2025. The increase is primarily driven by the expansion of the engineering team, infrastructure costs for the new cloud migration project, and marketing expenses for the Q2 product launch.

DEPARTMENT BREAKDOWN

Engineering ($1.8M, +18%)
- Headcount increase: 6 new positions (2 senior engineers, 3 mid-level, 1 QA)
- Cloud infrastructure expansion: $320K (+25%)
- Development tools and licenses: $150K (+5%)
- Training and conferences: $80K (unchanged)

Product Management ($450K, +8%)
- Headcount increase: 1 new product manager
- User research tools: $45K (+12%)
- Prototyping software: $25K (unchanged)
- Customer feedback programs: $60K (+20%)

Marketing ($750K, +15%)
- Digital advertising: $300K (+25%)
- Event sponsorships: $200K (+5%)
- Content creation: $150K (+20%)
- Marketing automation tools: $100K (unchanged)

Sales ($650K, +5%)
- Sales commission structure: No changes
- CRM and sales tools: $120K (+10%)
- Sales training: $80K (unchanged)
- Travel and entertainment: $150K (+15%)

Operations ($550K, +8%)
- Office space: $300K (+5%)
- Equipment and supplies: $100K (+10%)
- Administrative staff: No changes
- Professional services: $150K (+15%)

COST-SAVING INITIATIVES

1. Vendor consolidation expected to save $85K
2. Remote work policy reducing office space needs by 15%
3. Automation of financial reporting saving approximately 120 person-hours

RISK FACTORS

1. Cloud migration costs may exceed estimates by up to 20%
2. Hiring timeline delays could impact product roadmap
3. Economic uncertainty may affect Q3/Q4 sales projections

Document 2: FY2025 Budget Performance Report

FY2025 BUDGET PERFORMANCE REPORT
Prepared by: Finance Department
Date: July 20, 2025

OVERALL PERFORMANCE

The company operated at 103% of planned budget for FY2025, with total expenditures of $3.85M against a budget of $3.75M. Revenue targets were exceeded by 8%, resulting in a positive net margin despite the budget overage.

KEY VARIANCES

Over Budget Areas:
1. Engineering (+8%)
   - Cloud costs exceeded estimates due to increased data processing needs
   - Emergency security consultant hired after Q2 incident ($45K unplanned)

2. Marketing (+5%)
   - Additional campaign for competitive response in Q3 ($35K unplanned)
   - Higher than expected digital ad costs due to market conditions

3. Operations (+7%)
   - Office renovation costs exceeded estimates by $30K
   - Unexpected equipment replacements after power surge incident

Under Budget Areas:
1. Product Management (-3%)
   - Delayed hiring of junior product manager (position still open)
   - Lower travel expenses due to virtual customer meetings

2. Sales (-2%)
   - Reduced travel and entertainment due to continued virtual selling
   - CRM implementation costs lower than projected

LESSONS LEARNED

1. Cloud cost forecasting needs more detailed modeling
2. Security budget should include contingency funds
3. Equipment replacement schedule should be more conservative
4. Virtual collaboration continues to offer cost savings opportunities

RECOMMENDATIONS FOR FY2026

1. Implement quarterly cloud cost reviews with Engineering
2. Add 10% contingency to infrastructure and security budgets
3. Develop more detailed models for marketing performance vs. spend
4. Continue hybrid work model to optimize office space utilization
```

#### Current Output
```json
{
  "summary": "The upcoming Annual Budget Review with the Finance Department will focus on the FY2026 budget proposal of $4.2M, which represents a 12% increase from FY2025. The increase is primarily driven by expansion in the engineering team, cloud migration infrastructure costs, and marketing expenses for a Q2 product launch. The previous fiscal year (FY2025) operated at 103% of the planned budget with total expenditures of $3.85M against a budget of $3.75M, though revenue targets were exceeded by 8%, resulting in a positive net margin despite the overage.\n\nThe proposed budget includes significant increases across departments: Engineering ($1.8M, +18%) for new positions and cloud infrastructure; Product Management ($450K, +8%) adding a new product manager; Marketing ($750K, +15%) with increased digital advertising and content creation; Sales ($650K, +5%) with minimal changes; and Operations ($550K, +8%) with moderate increases in office space and professional services. Several cost-saving initiatives are also proposed, including vendor consolidation, reduced office space needs due to remote work, and automation of financial reporting.",
  "keyTopics": [
    "FY2026 budget proposal of $4.2M (12% increase from FY2025)",
    "Department-specific budget allocations and justifications",
    "FY2025 budget performance and key variances",
    "Cost-saving initiatives and their expected impact",
    "Risk factors including cloud migration costs and hiring timeline delays",
    "Lessons learned from FY2025 budget performance"
  ],
  "preparationSuggestions": [
    "Review the detailed breakdown of the 18% increase in Engineering budget, particularly the cloud infrastructure expansion costs",
    "Prepare questions about the cloud cost forecasting model given the overages in FY2025",
    "Ask about contingency plans for the identified risk factors, especially the potential 20% increase in cloud migration costs",
    "Inquire about the specific metrics used to determine marketing budget effectiveness, given the 15% increase proposed",
    "Discuss the implementation timeline for the cost-saving initiatives, particularly the vendor consolidation expected to save $85K",
    "Request more details on the automation of financial reporting and how the 120 person-hours savings was calculated"
  ]
}
```

#### Desired Output
```json
{
  "summary": "The Annual Budget Review centers on a proposed $4.2M budget for FY2026 (12% increase) against last year's 3% overspend. Engineering requests the largest increase (18%) for cloud migration and headcount, while Marketing seeks 15% more for the Q2 product launch campaign. FY2025 performance revealed systematic underestimation of cloud costs and security needs, though revenue exceeded targets by 8%. The finance team has implemented cost-saving measures including vendor consolidation ($85K) and office space reduction (15%), but flagged significant risks around cloud migration costs potentially exceeding estimates by 20%.",
  
  "keyTopics": [
    "Engineering budget justification - 18% increase including cloud migration risks",
    "Marketing ROI - 15% budget increase vs. expected Q2 launch performance",
    "FY2025 pattern of cloud cost underestimation and mitigation strategy",
    "Headcount expansion timeline and contingency planning",
    "Cost-saving initiatives validation and implementation timeline",
    "Contingency planning for identified risk factors"
  ],
  
  "preparationSuggestions": [
    "Calculate cloud cost per customer to determine if 25% infrastructure increase aligns with growth projections",
    "Prepare alternative headcount scenarios if hiring delays occur (identified as a key risk)",
    "Review marketing performance metrics from FY2025 to validate if the 15% budget increase is justified by ROI",
    "Analyze the vendor consolidation proposal ($85K savings) - request vendor transition risk assessment",
    "Prepare questions about the 20% potential cloud cost overrun - what specific mitigations exist?",
    "Review Q2 product launch revenue projections to ensure marketing budget alignment"
  ],
  
  "criticalQuestions": [
    "What specific cloud cost modeling improvements have been implemented since last year's 8% engineering overspend?",
    "If the cloud migration exceeds budget by 20% as identified in risks, which other areas would be reduced to compensate?",
    "How does the 15% marketing increase correlate to expected revenue from the Q2 product launch?",
    "What's the contingency plan if the 6 new engineering positions can't be filled on schedule?",
    "Can the vendor consolidation savings be validated with specific vendor quotes or contracts?"
  ],
  
  "keyMetrics": {
    "budgetIncrease": "12% overall ($4.2M total)",
    "largestDepartmentIncreases": [
      "Engineering: 18% (+$275K)",
      "Marketing: 15% (+$98K)",
      "Product Management: 8% (+$33K)"
    ],
    "previousYearOverspend": "3% ($3.85M vs $3.75M budget)",
    "revenuePerformance": "8% above target in FY2025",
    "costSavings": "$85K from vendor consolidation, 15% office space reduction"
  },
  
  "stakeholderConcerns": {
    "engineering": "Cloud migration costs, hiring timeline",
    "marketing": "Campaign ROI for Q2 product launch",
    "finance": "Overall 12% increase justification, contingency planning",
    "operations": "Office space reduction implementation"
  }
}
```

### Daily Briefing Prompt

#### Current Implementation
```javascript
const prompt = `You are an AI assistant creating a comprehensive daily briefing. Please analyze the following information about meetings ${timeContext} and create a unified briefing.

Date: ${date}
Total Meetings: ${totalMeetings}
Meetings with Documents: ${meetingsWithDocuments}

All Meetings:
${meetingsList}

Detailed Summaries (for meetings with documents):
${summariesText}

Please create a comprehensive daily briefing that:
1. Provides an executive summary of the day's meetings
2. Highlights key themes and connections across meetings
3. Identifies important decisions or actions needed
4. Suggests strategic preparation priorities

Format your response as JSON:
{
  "summary": "Your comprehensive briefing summary here (3-4 paragraphs)"
}`;  
```

#### Example Input
```
Date: August 5, 2025
Total Meetings: 4
Meetings with Documents: 2

All Meetings:
1. Product Standup (9:00 AM - 9:30 AM)
   Attendees: Development Team (8 people)
   No documents attached

2. Client Proposal Review - Acme Corp (10:00 AM - 11:30 AM)
   Attendees: Sales Team (3 people), Client Representatives (2 people)
   Documents: Acme_Proposal_v2.docx, Pricing_Sheet_Q3.xlsx

3. Engineering Planning (1:00 PM - 2:30 PM)
   Attendees: Engineering Team (6 people), Product Manager
   Documents: Q3_Roadmap.pdf, Technical_Specifications.docx

4. Team Check-in (4:00 PM - 4:30 PM)
   Attendees: Department Managers (4 people)
   No documents attached

Detailed Summaries (for meetings with documents):

Client Proposal Review - Acme Corp:
The meeting will review the updated proposal for Acme Corporation's enterprise implementation. The proposal includes a phased rollout approach over 6 months with custom integrations for their existing CRM system. Pricing has been adjusted to reflect the extended support package they requested. Key discussion points will include implementation timeline, resource allocation, and contract terms. Acme has expressed concerns about the migration timeline and data security measures.

Engineering Planning:
This meeting will focus on finalizing the Q3 roadmap priorities. The technical specifications document outlines the architecture changes needed for the upcoming cloud migration. Key topics include resource allocation across teams, dependency management between features, and testing strategy. There are several technical challenges to resolve regarding the authentication system redesign and database performance optimizations. The team needs to decide between two competing approaches to the API redesign.
```

#### Current Output
```json
{
  "summary": "Your day on August 5, 2025, consists of four meetings spanning from morning to late afternoon, with two significant meetings containing detailed documentation. The day begins with a routine Product Standup at 9:00 AM, followed by an important Client Proposal Review with Acme Corp at 10:00 AM. This client meeting will focus on reviewing an enterprise implementation proposal featuring a phased 6-month rollout with custom CRM integrations. Key discussion points include implementation timeline, resource allocation, and addressing Acme's concerns about migration timeline and data security.\n\nIn the afternoon, you have an Engineering Planning session at 1:00 PM that will finalize Q3 roadmap priorities and address technical specifications for an upcoming cloud migration. This meeting requires decisions on resource allocation, dependency management, and choosing between competing API redesign approaches. Additionally, technical challenges regarding authentication system redesign and database performance optimizations need resolution. The day concludes with a Team Check-in with Department Managers at 4:00 PM.\n\nTo prepare strategically for the day, prioritize reviewing the Acme proposal documents and pricing sheets before the 10:00 AM meeting, particularly focusing on addressing their concerns about migration timeline and security measures. For the Engineering Planning meeting, familiarize yourself with the Q3 roadmap and technical specifications, forming an opinion on the API redesign approaches. The bookend meetings (Product Standup and Team Check-in) appear to be regular check-ins that likely require less intensive preparation, allowing you to focus your energy on the two documented meetings where key decisions and client relationships are at stake."
}
```

#### Desired Output
```json
{
  "executiveSummary": "Your August 5th schedule features 4 meetings with two critical sessions requiring decisions: the Acme Corp client proposal review (10:00 AM) addressing their enterprise implementation concerns, and the Engineering Planning meeting (1:00 PM) where you'll need to resolve competing API redesign approaches for the cloud migration project. The day begins with a routine Product Standup and ends with a Department Managers check-in.",
  
  "peopleOverview": [
    "Acme Corp Representatives (2) - First client interaction since their timeline and security concerns",
    "Sales Team (3) - Supporting you in the Acme proposal, prepared pricing adjustments",
    "Engineering Team (6) - Divided on API redesign approach, need clear direction",
    "Product Manager - Will need alignment between client commitments and engineering roadmap"
  ],
  
  "priorityPreparations": [
    "Review Acme's security concerns in Acme_Proposal_v2.docx (specific section on page 12)",
    "Decide position on API redesign approaches (REST vs. GraphQL debate from last week)",
    "Connect with Sales lead for 5 minutes before Acme meeting to align on pricing concessions",
    "Prepare to bridge communication between morning client commitments and afternoon engineering planning"
  ],
  
  "keyDecisions": [
    "Acme Timeline Commitment: Can we meet their requested timeline or need to propose alternatives?",
    "API Redesign Approach: Must select implementation strategy to unblock Q3 roadmap",
    "Resource Allocation: Engineering team assignments between Acme implementation and product roadmap"
  ],
  
  "meetingConnections": [
    "Acme implementation timeline decisions will directly impact resource availability discussed in Engineering Planning",
    "Team Check-in will require summary of Acme commitments and engineering decisions",
    "Product Standup may surface issues that affect Acme proposal or engineering plans"
  ],
  
  "timeManagement": {
    "focusBlocks": [
      "9:30-10:00: Review Acme proposal documents",
      "11:30-12:30: Lunch and preparation for Engineering Planning",
      "2:30-3:30: Documentation of decisions for Team Check-in"
    ],
    "quickPrep": "Review Q3_Roadmap.pdf pages 3-5 (API redesign options)"
  }
}
```

## Technical Implementation Plan

### Phase 1: Prompt Centralization

#### 1. Create Prompt Template System
- Create a dedicated `prompts` directory
- Implement a template loading and rendering system
- Support variable substitution for dynamic content
- Include metadata like version, author, and purpose

#### 2. Extract Existing Prompts
- Move all prompts from service files to template files
- Standardize prompt structure and format
- Document each prompt's purpose and expected output
- Create a prompt registry for easy lookup

#### 3. Implement Prompt Service
- Create `services/promptService.js` to manage prompt templates
- Add methods for loading, rendering, and caching templates
- Support prompt versioning and A/B testing
- Add telemetry to track prompt performance

### Phase 2: Prompt Optimization

#### 1. Meeting Summary Prompts
- Enhance context inclusion (attendees, roles, documents)
- Improve extraction of key discussion points
- Better identify action items and decisions
- Add personalization based on user's relationship to meeting

#### 2. Daily Briefing Prompts
- Improve cross-meeting insights and patterns
- Better prioritize preparation needs
- Enhance people overview with relationship context
- Add time management suggestions based on meeting schedule

#### 3. Document Analysis Prompts
- Improve extraction of key information from different document types
- Better summarization of long documents
- Enhanced identification of meeting-relevant content
- Support for more document formats and structures

### Phase 3: Evaluation & Iteration

#### 1. Prompt Evaluation Framework
- Define metrics for prompt effectiveness
- Implement A/B testing capability
- Create feedback collection mechanism
- Establish regular review and iteration process

#### 2. Advanced Prompt Techniques
- Implement chain-of-thought reasoning
- Add few-shot examples for complex tasks
- Explore retrieval-augmented generation
- Test different temperature and sampling parameters

## Implementation Details

### Directory Structure
```
/prompts
  /meeting-summary
    summary-template.md
    action-items-template.md
    attendee-analysis-template.md
  /daily-briefing
    overview-template.md
    people-overview-template.md
    priority-prep-template.md
  /document-analysis
    doc-summary-template.md
    key-points-template.md
  /shared
    formatting-instructions.md
    system-instructions.md
```

### Prompt Service API
```javascript
// Load and render a prompt template
const renderedPrompt = await promptService.renderTemplate('meeting-summary/summary-template', {
  meeting: meetingData,
  documents: documentData,
  user: userData
});

// Send prompt to OpenAI with appropriate parameters
const result = await openaiService.generateCompletion(renderedPrompt, {
  temperature: 0.3,
  max_tokens: 500
});
```

### Template Format
```markdown
# {{templateName}}
version: {{version}}
purpose: {{purpose}}

## System Instructions
{{> shared/system-instructions}}

## Context
You are analyzing a meeting titled "{{meeting.title}}" scheduled for {{meeting.formattedDate}}.
Attendees include: {{#each meeting.attendees}}{{this.name}} ({{this.role}}), {{/each}}

## Task
{{taskDescription}}

## Available Information
{{#each documents}}
- Document: {{this.title}}
  Summary: {{this.summary}}
{{/each}}

## Output Format
{{> shared/formatting-instructions}}
```

## Success Criteria

### Functional Requirements
- All prompts are extracted to template files in the prompts directory
- Prompt service correctly loads, renders, and caches templates
- All AI-generated content uses the new prompt system
- Template variables are properly substituted with context data
- System supports versioning and A/B testing of prompts

### Technical Requirements
- No degradation in system performance or reliability
- Comprehensive test coverage for prompt service
- Clean separation of prompt content from application logic
- Efficient caching to minimize file I/O
- Proper error handling for template rendering failures

### User Experience Requirements
- Meeting summaries contain more specific, actionable information
- Daily briefings provide better cross-meeting insights
- Preparation suggestions are more relevant and personalized
- Content is consistently formatted for easy scanning
- Users report higher satisfaction with AI-generated content

## Evaluation Metrics
- Reduction in generic or obvious content
- Increase in specific, actionable insights
- Improved user engagement with AI-generated content
- Faster time-to-value for users reviewing content
- Reduced token usage for equivalent content generation

## Prompt Testing & Evaluation Methodology

### Testing Framework

#### 1. Baseline Establishment
- Collect outputs from current prompts using standardized test inputs
- Document current performance metrics (usefulness, specificity, actionability)
- Establish benchmark scores for each prompt type

#### 2. A/B Testing Process
- Create variant prompts with specific improvements
- Run both original and new prompts against identical inputs
- Compare outputs using objective evaluation criteria
- Collect user feedback on comparative usefulness

#### 3. Evaluation Criteria

**Quantitative Metrics:**
- **Specificity Score**: Ratio of specific, actionable content vs. generic statements
- **Information Density**: Useful information per token
- **Relevance Precision**: Percentage of output directly relevant to meeting context
- **Token Efficiency**: Quality of output relative to token usage

**Qualitative Assessment:**
- **Actionability**: How directly useful is the output for meeting preparation?
- **Insight Quality**: Does it provide non-obvious, valuable insights?
- **Personalization**: How well does it adapt to the user's context and role?
- **Formatting Effectiveness**: How scannable and digestible is the content?

#### 4. User Feedback Integration
- Implement feedback collection after AI-generated content is viewed
- Simple rating system (1-5) for usefulness
- Optional qualitative feedback field
- Track improvement trends over time

### Example Evaluation Scorecard

```
Prompt Evaluation Scorecard
--------------------------
Prompt Type: Daily Briefing
Prompt Version: v2.1
Test Date: 2025-08-01

Quantitative Metrics:
- Specificity Score: 8.5/10 (+1.2 from baseline)
- Information Density: 7.9/10 (+0.8 from baseline)
- Relevance Precision: 92% (+5% from baseline)
- Token Efficiency: 9.1/10 (+1.5 from baseline)

Qualitative Assessment:
- Actionability: 8/10 - Clear action items with context
- Insight Quality: 7/10 - Good connections between meetings
- Personalization: 8/10 - Adapts well to user's role
- Formatting: 9/10 - Excellent scannable structure

User Feedback:
- Average Rating: 4.2/5 (from 10 users)
- Key Comments: "Much more useful for quick preparation"

Decision: ADOPT new prompt version
```

## Timeline
- Phase 1 (Prompt Centralization): 1 week
- Phase 2 (Prompt Optimization): 2 weeks
- Phase 3 (Evaluation & Iteration): Ongoing with bi-weekly review cycles
