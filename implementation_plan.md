# Meeting Prep Assistant - Implementation Plan

## Phase 1: Basic Authentication and Dashboard

This document outlines the initial implementation steps to create a minimal viable product (MVP) with Google authentication and a basic dashboard view.

### 1. Project Setup

1. Initialize a Node.js project
   ```
   npm init -y
   ```

2. Install core dependencies
   ```
   npm install express express-session passport passport-google-oauth20 dotenv
   ```

3. Create basic project structure
   ```
   /meeting-prep
     /public
       /css
       /js
     /views
     /routes
     /config
     /models
     server.js
     .env
   ```

4. Set up environment variables in `.env`
   ```
   PORT=3000
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   SESSION_SECRET=your_session_secret
   ```

### 2. Google OAuth Setup

1. Create a project in Google Cloud Console
   - Go to https://console.cloud.google.com/
   - Create a new project
   - Enable Google Calendar API and Google Docs API
   - Configure OAuth consent screen
   - Create OAuth client ID credentials
   - Set authorized redirect URIs (e.g., http://localhost:3000/auth/google/callback)

2. Configure Passport.js for Google authentication
   - Create `/config/passport.js` to set up Google OAuth strategy
   - Implement user serialization/deserialization
   - Request appropriate scopes for Calendar and Docs access

### 3. Server Setup

1. Create Express server in `server.js`
   - Configure middleware (express-session, passport, etc.)
   - Set up view engine (EJS or similar)
   - Configure static file serving
   - Initialize routes

2. Implement authentication routes in `/routes/auth.js`
   - Login route
   - Google OAuth callback
   - Logout route
   - Authentication middleware for protected routes

### 4. Basic Frontend

1. Create login page in `/views/login.ejs`
   - Simple design with Google login button
   - Brief app description

2. Create dashboard page in `/views/dashboard.ejs`
   - Header with user info and logout button
   - Day planner list view for current week (Monday-Friday)
   - Placeholder for meeting list

### 5. Calendar Integration

1. Implement Google Calendar API integration
   - Create helper functions to fetch user's calendar events
   - Focus on retrieving events for the current week
   - Extract relevant meeting information (title, time, attendees, etc.)

2. Create dashboard route in `/routes/dashboard.js`
   - Fetch calendar events for the current week
   - Process and format meeting data for display
   - Render dashboard view with meeting data

### 6. Basic Dashboard Functionality

1. Implement frontend JavaScript for dashboard in `/public/js/dashboard.js`
   - Display meetings organized by day
   - Show meeting details (time, title, attendees)
   - Add basic styling for readability

2. Create basic CSS in `/public/css/style.css`
   - Responsive design for mobile and desktop
   - Clean, minimal UI for the day planner view

### 7. Testing and Deployment

1. Test authentication flow
   - Verify Google login works correctly
   - Ensure session persistence works
   - Test access control for protected routes

2. Test calendar integration
   - Verify calendar events are fetched correctly
   - Ensure meetings display properly in the day planner view

3. Deploy to development environment
   - Set up hosting (e.g., Heroku, Vercel, etc.)
   - Configure environment variables
   - Test deployed application

## Next Steps (Future Phases)

- Implement document processing functionality
- Add OpenAI integration for meeting summaries
- Develop document association interface
- Create meeting detail view
- Implement data storage for meeting preparations
