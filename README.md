# Meeting Prep Assistant

An application that automatically prepares users for upcoming meetings by analyzing calendar events and associated documents.

## Features

- Google authentication for secure access to calendar and document data
- Day planner list view of meetings for the current week (Monday-Friday)
- Meeting details including title, time, attendees, and preparation status
- Clean, responsive UI for desktop and mobile use

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript with EJS templating
- **Backend**: Node.js with Express
- **Authentication**: Google OAuth 2.0
- **APIs**: Google Calendar API, Google Docs API (planned)
- **AI Integration**: OpenAI for document analysis (planned)

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   SESSION_SECRET=your_session_secret
   ```
4. Set up Google OAuth credentials in the Google Cloud Console:
   - Create a project in Google Cloud Console
   - Enable the Google Calendar API and Google Docs API
   - Configure OAuth consent screen
   - Create OAuth credentials (Web application)
   - Add the following redirect URI: `http://localhost:3000/auth/google/callback`
   - The application requests these scopes: profile, email, calendar.readonly, documents.readonly
5. Run the application:
   ```
   npm run dev
   ```

## Development Roadmap

- Calendar Integration: Fetch real meeting data from Google Calendar
- Document Processing: Process documents attached to calendar events
- AI-Powered Meeting Preparation: Generate meeting summaries and preparation suggestions
- Data Storage: Store meeting summaries and preparation notes
