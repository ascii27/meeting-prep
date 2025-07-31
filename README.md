# Meeting Prep Assistant

An intelligent application that automatically prepares users for upcoming meetings by analyzing calendar events and associated documents, featuring AI-powered daily briefings and comprehensive meeting preparation.

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

### 🎨 **User Experience**
- **Responsive Design**: Clean, modern UI for desktop and mobile use
- **Real-Time Updates**: Live progress tracking during AI generation
- **Professional Interface**: Custom modal and notification systems
- **Intuitive Navigation**: Seamless integration with existing workflow

## Tech Stack

### **Backend Architecture**
- **Runtime**: Node.js with Express framework
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: Google OAuth 2.0 with Passport.js
- **APIs**: Google Calendar API, Google Docs API
- **AI Integration**: OpenAI GPT-4 for document analysis and daily briefings
- **Real-Time Updates**: Server-Sent Events (SSE) for progress tracking

### **Frontend Technologies**
- **Templates**: EJS templating engine
- **Styling**: Custom CSS with responsive design
- **JavaScript**: Vanilla ES6+ with modern async/await patterns
- **UI Components**: Custom modal and notification systems
- **Progress Tracking**: Real-time SSE-based updates

### **Data & Storage**
- **Database Models**: Daily briefings, meeting summaries, user data
- **Caching**: In-memory caching for API responses and AI-generated content
- **File Processing**: Google Docs document analysis and storage
- **Session Management**: Express sessions with secure cookie handling

## Setup

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
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4
   OPENAI_MAX_TOKENS=500
   OPENAI_TEMPERATURE=0.3
   ```
4. Set up Google OAuth credentials in the Google Cloud Console:
   - Create a project in Google Cloud Console
   - Enable the Google Calendar API and Google Docs API
   - Configure OAuth consent screen
   - Create OAuth credentials (Web application)
   - Add the following redirect URI: `http://localhost:3000/auth/google/callback`
   - The application requests these scopes: profile, email, calendar.readonly, documents.readonly
5. Set up your PostgreSQL database and update the database configuration in `config/config.json`

6. Run the application:
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

## Development Status

### ✅ **Completed Features**
- **Calendar Integration**: Full Google Calendar API integration with real-time meeting data
- **Document Processing**: Automatic processing of Google Docs attached to calendar events
- **AI-Powered Meeting Preparation**: Generate comprehensive meeting summaries and preparation suggestions
- **Daily Briefing System**: AI-powered daily overviews with real-time progress tracking
- **Data Storage**: Persistent PostgreSQL storage for briefings, summaries, and user data
- **Authentication**: Secure Google OAuth 2.0 authentication with session management
- **Real-Time UI**: Server-Sent Events for live progress updates
- **Professional Interface**: Custom modal and notification systems

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
