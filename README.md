# Meeting Prep Assistant

An application that automatically prepares users for upcoming meetings by analyzing calendar events and associated documents.

## Features

- Google authentication for secure access to calendar and document data
- Day planner list view of meetings for the current week (Monday-Friday)
- Meeting details including title, time, attendees, and preparation status
- Document processing for meeting-related Google Docs
- AI-powered meeting preparation with document summaries and suggestions
- User notes for personal meeting preparation
- Clean, responsive UI for desktop and mobile use

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript with EJS templating
- **Backend**: Node.js with Express
- **Authentication**: Google OAuth 2.0
- **APIs**: Google Calendar API, Google Docs API
- **AI Integration**: OpenAI for document analysis
- **Database**: PostgreSQL with Sequelize ORM
- **Caching**: In-memory caching for API responses and AI-generated content

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

## Development Roadmap

- ✅ Calendar Integration: Fetch real meeting data from Google Calendar
- ✅ Document Processing: Process documents attached to calendar events
- ✅ AI-Powered Meeting Preparation: Generate meeting summaries and preparation suggestions
- 🔄 User Management: Enhanced user profiles and preferences
- 🔄 Data Storage: Persistent storage for meeting preparations and user notes
- 🔄 Mobile Optimization: Enhanced mobile experience
