# Meeting Prep Data Storage

This document provides information about the data storage feature for the Meeting Prep application.

## Overview

The data storage feature enables persistent storage of meeting-related data including:
- User information
- Meeting details
- Meeting summaries
- Preparation notes
- User preferences

The implementation uses PostgreSQL as the database backend and Sequelize ORM for database interactions.

## Hybrid Storage Approach

The Meeting Prep application uses a hybrid storage approach:
1. **In-memory cache** for fast access to frequently used data
2. **PostgreSQL database** for persistent storage of all data

This approach provides both performance and data durability.

## Setup Instructions

### Prerequisites

- PostgreSQL installed and running
- Node.js and npm installed

### Environment Configuration

1. Copy the `.env.example` file to `.env` and update the database configuration:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=meeting_prep
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   ```

2. Create a PostgreSQL database:
   ```
   createdb meeting_prep
   ```

### Database Initialization

Run the database setup script to create all required tables:

```bash
node scripts/setup-database.js
```

This script will run all migrations and set up the database schema.

## Architecture

### Models

The data storage feature includes the following models:

1. **User** - Stores user information from Google OAuth
2. **Meeting** - Represents calendar events with metadata
3. **MeetingSummary** - Stores AI-generated meeting summaries
4. **PreparationNote** - Stores user notes for meetings
5. **UserPreference** - Stores user preferences

### Repositories

The data access layer uses the repository pattern:

1. **BaseRepository** - Provides common CRUD operations
2. **UserRepository** - Handles user-specific operations
3. **MeetingRepository** - Handles meeting-specific operations
4. **MeetingSummaryRepository** - Handles summary-specific operations
5. **PreparationNoteRepository** - Handles note-specific operations
6. **UserPreferenceRepository** - Handles preference-specific operations

### Services

The data storage feature integrates with the application through:

1. **DataStorageService** - Provides an interface for storing and retrieving data from both database and cache
2. **MeetingPrepService** - Updated to use the data storage service

## API Endpoints

New API endpoints for accessing meeting history:

- `GET /api/history` - Get user's meeting history
- `GET /api/history/:meetingId` - Get details for a specific meeting

## Fallback Mechanism

If the database connection fails, the application will continue to function using only the in-memory cache. This ensures that the core functionality remains available even if the database is unavailable.

## Data Flow

1. When a user generates a meeting summary:
   - The summary is stored in both the cache and the database
   - The meeting details are also stored in the database

2. When a user retrieves a meeting summary:
   - The application first checks the cache
   - If not found in cache, it retrieves from the database
   - The retrieved data is then stored in the cache for future requests

3. When a user saves notes:
   - The notes are stored in both the cache and the database

## Future Enhancements

Potential future enhancements for the data storage feature:

1. User interface for viewing meeting history
2. Ability to search and filter past meetings
3. Export functionality for meeting summaries and notes
4. User preference management UI
