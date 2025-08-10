# Meeting Prep Assistant

An intelligent application that automatically prepares users for upcoming meetings by analyzing calendar events and associated documents, featuring AI-powered daily briefings, comprehensive meeting preparation, and meeting intelligence services.

## Features

### 🤖 **AI-Powered Daily Briefings**
- **Comprehensive Daily Overview**: Generate AI-powered summaries of your entire day's meetings
- **Real-Time Progress Tracking**: Watch briefing generation with live progress updates
- **Smart Insights**: Get key people overviews and priority preparation items
- **Beautiful UI**: Custom modal system with professional styling
- **Full Management**: View, generate, and delete daily briefings

### 📅 **Meeting Preparation**
- **Google Calendar Integration**: Secure access to calendar and document data
- **Day Planner View**: Clean list view of meetings for the current week (Monday-Friday)
- **Meeting Details**: Title, time, attendees, and preparation status
- **Document Processing**: Automatic processing of meeting-related Google Docs
- **AI-Powered Summaries**: Generate meeting summaries and preparation suggestions
- **User Notes**: Personal meeting preparation and note-taking

### 🧠 **Meeting Intelligence Service**
- **Relationship Mapping**: Graph-based tracking of meeting participants and connections
- **Meeting Analytics**: Process and analyze calendar events for insights
- **Participant Tracking**: Identify key stakeholders and meeting frequency
- **Topic Cataloging**: Automatically extract and categorize meeting topics
- **Network Visualization**: Understand organizational relationships and communication patterns

### 🎨 **User Experience**
- **Responsive Design**: Clean, modern UI for desktop and mobile use
- **Real-Time Updates**: Live progress tracking during AI generation
- **Professional Interface**: Custom modal and notification systems
- **Intuitive Navigation**: Seamless integration with existing workflow

## Tech Stack

### **Backend Architecture**
- **Runtime**: Node.js with Express framework
- **Databases**: 
  - **Relational**: PostgreSQL with Sequelize ORM
  - **Graph**: Neo4j for relationship mapping and network analysis
- **Authentication**: Google OAuth 2.0 with Passport.js
- **APIs**: Google Calendar API, Google Docs API
- **AI Integration**: LiteLLM with support for multiple providers (OpenAI GPT-4, Anthropic Claude, etc.)
- **Real-Time Updates**: Server-Sent Events (SSE) for progress tracking

### **LLM Integration**

The application supports multiple LLM providers through a flexible service architecture:

- **Service Selection**: Choose between OpenAI direct integration or LiteLLM for multi-provider support
- **Provider Flexibility**: Use LiteLLM to access OpenAI, Anthropic, and other providers
- **Fallback Chains**: Automatic fallback to alternative models if primary model fails (with LiteLLM)
- **Service Router**: Centralized AI service router that directs requests to the appropriate service
- **Clean Separation**: OpenAI and LiteLLM services operate independently for better maintainability
- **Unified API**: Consistent interface for all AI operations regardless of the underlying provider

### **Frontend Technologies**
- **Templates**: EJS templating engine
- **Styling**: Custom CSS with responsive design
- **JavaScript**: Vanilla ES6+ with modern async/await patterns
- **UI Components**: Custom modal and notification systems
- **Progress Tracking**: Real-time SSE-based updates

### **Data & Storage**
- **Database Models**: Daily briefings, meeting summaries, user data
- **Graph Database**: Neo4j for relationship and network data modeling
- **Caching**: In-memory caching for API responses and AI-generated content
- **File Processing**: Google Docs document analysis and storage
- **Session Management**: Express sessions with secure cookie handling

## Setup

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL database
- Neo4j database (v4.4 or higher)
- Google Cloud project with Calendar and Docs APIs enabled
- LLM provider API keys (OpenAI required, Anthropic optional)

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables (see `.env.example`):
   ```
   PORT=3000
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   SESSION_SECRET=your_session_secret
   
   # AI Service Configuration
   AI_SERVICE=openai                # Options: 'openai' or 'litellm'
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4
   OPENAI_MAX_TOKENS=1000
   OPENAI_TEMPERATURE=0.7
   
   # LiteLLM Configuration
   LLM_PROVIDER_DEFAULT=openai      # Default provider for LiteLLM
   ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional
   LLM_TEMPERATURE=0.7
   LLM_MAX_TOKENS=1000
   LLM_MODEL_MAPPING={"gpt-4":"claude-2","gpt-3.5-turbo":"claude-instant-1"}
   
   # Database Configuration
   DB_NAME=meeting_prep
   DB_USER=postgres
   DB_PASSWORD=your_db_password
   DB_HOST=localhost
   ```

4. Set up Google OAuth credentials in the Google Cloud Console:
   - Create a project in Google Cloud Console
   - Enable the Google Calendar API and Google Docs API
   - Configure OAuth consent screen
   - Create OAuth credentials (Web application)
   - Add the following redirect URI: `http://localhost:3000/auth/google/callback`
   - The application requests these scopes: profile, email, calendar.readonly, documents.readonly

5. Set up your PostgreSQL database and update the database configuration in `config/config.json`

6. Set up Neo4j using the provided setup script:
   ```
   ./scripts/setup-neo4j.sh
   ```
   This script will:
   - Install Neo4j if not already installed (using Homebrew)
   - Start the Neo4j service
   - Set up the required password
   - Create necessary constraints and indexes
   - Update your .env file with the correct Neo4j configuration

7. Run the application:
   ```
   npm run dev
   ```

   To reset the database structure (this will alter tables to match models):
   ```
   npm run dev:reset-db
   ```
   
   To run a one-time database reset without starting the development server:
   ```
   npm run reset-db
   ```

8. Running the Intelligence Worker:
   The intelligence worker runs as a separate process to analyze calendar data and build relationship graphs in Neo4j.

   ### Setting Up OAuth for Command-Line Use
   The worker should use its own separate OAuth client credentials (distinct from the web application):

   1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
   2. Select your project
   3. Navigate to "APIs & Services" > "Credentials"
   4. Click "Create Credentials" > "OAuth client ID"
   5. Select "Desktop app" as the application type
   6. Give it a name like "Meeting Prep Worker"
   7. Click "Create"
   8. Copy the client ID and client secret
   9. Add them to your `.env` file as separate variables:
      ```
      WORKER_GOOGLE_CLIENT_ID=your_worker_client_id
      WORKER_GOOGLE_CLIENT_SECRET=your_worker_client_secret
      ```
      
      > **Note**: These should be different from your web application's OAuth credentials

   ### Authentication Flow
   When you run the worker for the first time:

   1. The worker will start a local server on port 3000 to handle the OAuth callback
   2. A browser window should open automatically with the authorization URL
   3. You'll be prompted to sign in with your Google account
   4. After signing in, you'll be asked to grant the application permission to access your calendar and documents
   5. After granting permission, you'll be automatically redirected back to the local server
   6. The worker will receive the authorization code and exchange it for access and refresh tokens
   7. You'll see a success message in your browser
   8. If you used the `--save-tokens` option, these tokens will be saved for future use
   9. The local server will shut down automatically

   ### Running the Worker
   ```
   # Process data for a specific user
   npm run intelligence-worker -- --userId <user-id>
   
   # Process data for all users
   npm run intelligence-worker -- --all
   
   # Specify number of months of historical data to process
   npm run intelligence-worker -- --all --months 3
   
   # Enable verbose logging
   npm run intelligence-worker -- --all --verbose
   
   # Use saved tokens (after first authentication)
   npm run intelligence-worker -- --all --tokens worker-tokens.json
   
   # Save tokens to a custom location
   npm run intelligence-worker -- --all --save-tokens ./config/my-tokens.json
   ```
   
   After the first authentication, you can use the saved tokens to avoid having to authenticate each time.

## Development Status

### ✅ **Completed Features**
- **Calendar Integration**: Full Google Calendar API integration with real-time meeting data
- **Document Processing**: Automatic processing of Google Docs attached to calendar events
- **AI-Powered Meeting Preparation**: Generate comprehensive meeting summaries and preparation suggestions
- **Daily Briefing System**: AI-powered daily overviews with real-time progress tracking
- **Meeting Intelligence**: Graph-based relationship mapping and participant analysis
- **Data Storage**: Persistent PostgreSQL and Neo4j storage for all application data
- **Authentication**: Secure Google OAuth 2.0 authentication with session management
- **Real-Time UI**: Server-Sent Events for live progress updates
- **Professional Interface**: Custom modal and notification systems
- **Comprehensive Testing**: Full test coverage with 200+ unit and integration tests

### 🚀 **Production Ready**
The application is currently **production-ready** with:
- Comprehensive error handling and logging
- Secure API endpoints with authentication
- Responsive UI for desktop and mobile
- Scalable architecture with clean separation of concerns
- Full test coverage for critical components

### 🔮 **Future Enhancements**
- **Enhanced User Profiles**: Customizable preferences and settings
- **Advanced Analytics**: Meeting preparation insights and trends
- **Team Collaboration**: Shared briefings and preparation notes
- **Mobile App**: Native mobile application
- **Integration Expansion**: Support for additional calendar and document platforms
- **AI Improvements**: Enhanced prompt engineering and model fine-tuning

## API Endpoints

### **Daily Briefing API**
- `POST /api/daily-briefing/generate` - Generate a new daily briefing with SSE progress
- `GET /api/daily-briefing/:date` - Retrieve existing briefing for a specific date
- `DELETE /api/daily-briefing/:date` - Delete a daily briefing
- `GET /api/daily-briefing/range/:startDate/:endDate` - Get briefings within date range
- `GET /api/daily-briefing/status/:status` - Get briefings by status (pending, completed, failed)

### **Meeting Preparation API**
- `POST /api/preparation/generate` - Generate meeting preparation with progress tracking
- `GET /api/preparation/:meetingId` - Get preparation data for a specific meeting
- `POST /api/preparation/:meetingId/notes` - Save user notes for a meeting

### **Authentication**
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Handle OAuth callback
- `GET /auth/logout` - Logout user

### **Intelligence API**
- `POST /api/intelligence/process` - Start calendar processing for intelligence data
- `GET /api/intelligence/status` - Check processing status
- `GET /api/intelligence/meetings` - Get recent meetings with intelligence data
- `GET /api/intelligence/meetings/:id/participants` - Get participants for a specific meeting
- `GET /api/intelligence/people` - Get people and their meeting connections

*All API endpoints require authentication except the auth routes*

## Usage

### **Daily Briefing Workflow**
1. **View Dashboard**: See your week's meetings with briefing status
2. **Generate Briefing**: Click "Generate Daily Briefing" for any day
3. **Watch Progress**: Real-time progress updates during AI generation
4. **Review Content**: View comprehensive daily overview with key insights
5. **Manage Briefings**: Delete or regenerate briefings as needed

### **Meeting Preparation Workflow**
1. **Select Meeting**: Click on any meeting card from the dashboard
2. **AI Analysis**: System processes attached documents and generates summaries
3. **Review Preparation**: View AI-generated talking points and document insights
4. **Add Notes**: Include personal preparation notes and action items
5. **Track Progress**: Monitor preparation status across all meetings
