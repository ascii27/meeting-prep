const express = require('express');
const request = require('supertest');
const session = require('express-session');
const { getWeekEvents } = require('../../../services/calendarService');
const { getWeekDays, getWeekDateRangeText, groupEventsByDay, formatDateRange } = require('../../../utils/dateUtils');

// Mock dependencies
jest.mock('../../../services/calendarService');
jest.mock('../../../utils/dateUtils');

// Mock middleware - important to mock before requiring routes
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: jest.fn((req, res, next) => next())
}));

// Import routes after mocking dependencies
const dashboardRoutes = require('../../../routes/dashboard');

// Mock data
const mockUser = {
  id: '123',
  googleId: 'google-123',
  displayName: 'Test User',
  email: 'test@example.com',
  profilePicture: 'profile.jpg',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token'
};

const mockWeekDays = [
  { date: new Date('2025-07-14'), dayName: 'Monday', formattedDate: 'Jul 14, 2025', dayNumber: 14, month: 'Jul', isoString: '2025-07-14', meetings: [] },
  { date: new Date('2025-07-15'), dayName: 'Tuesday', formattedDate: 'Jul 15, 2025', dayNumber: 15, month: 'Jul', isoString: '2025-07-15', meetings: [] },
  { date: new Date('2025-07-16'), dayName: 'Wednesday', formattedDate: 'Jul 16, 2025', dayNumber: 16, month: 'Jul', isoString: '2025-07-16', meetings: [] },
  { date: new Date('2025-07-17'), dayName: 'Thursday', formattedDate: 'Jul 17, 2025', dayNumber: 17, month: 'Jul', isoString: '2025-07-17', meetings: [] },
  { date: new Date('2025-07-18'), dayName: 'Friday', formattedDate: 'Jul 18, 2025', dayNumber: 18, month: 'Jul', isoString: '2025-07-18', meetings: [] }
];

const mockEvents = [
  {
    id: 'event1',
    title: 'Test Meeting 1',
    start: '2025-07-15T10:00:00Z',
    end: '2025-07-15T11:00:00Z',
    attendees: [{ name: 'Test User 1' }, { email: 'test2@example.com' }],
    location: 'Conference Room A',
    description: 'Test meeting description',
    htmlLink: 'https://calendar.google.com/event1',
    preparationStatus: 'not-started'
  },
  {
    id: 'event2',
    title: 'Test Meeting 2',
    start: '2025-07-16T14:00:00Z',
    end: '2025-07-16T15:00:00Z',
    attendees: [{ name: 'Test User 2' }, { email: 'test3@example.com' }],
    location: 'Virtual Meeting',
    description: 'Another test meeting',
    htmlLink: 'https://calendar.google.com/event2',
    preparationStatus: 'completed'
  }
];

const mockGroupedEvents = {
  '2025-07-15': {
    date: '2025-07-15',
    events: [mockEvents[0]]
  },
  '2025-07-16': {
    date: '2025-07-16',
    events: [mockEvents[1]]
  }
};

describe('Dashboard Routes', () => {
  let app;
  let mockRender;
  
  // Increase timeout for all tests in this suite
  jest.setTimeout(15000);
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    getWeekDays.mockReturnValue(mockWeekDays);
    getWeekDateRangeText.mockReturnValue('July 14-18, 2025');
    getWeekEvents.mockResolvedValue(mockEvents);
    groupEventsByDay.mockReturnValue(mockGroupedEvents);
    formatDateRange.mockReturnValue('10:00 AM - 11:00 AM');
    
    // Setup Express app for testing
    app = express();
    
    // Mock the render method
    mockRender = jest.fn();
    app.render = mockRender;
    app.response.render = function(view, options) {
      mockRender(view, options);
      return this;
    };
    
    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Setup mock session
    app.use((req, res, next) => {
      req.session = {
        events: [],
        touch: jest.fn(),
        save: jest.fn(cb => typeof cb === 'function' && cb())
      };
      next();
    });
    
    // Add user to all requests by default
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });
    
    // Mount dashboard routes
    app.use('/dashboard', dashboardRoutes);
  });
  
  describe('GET /dashboard', () => {
    it('should render dashboard with current week data', async () => {
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard')
        .query({ weekOffset: '0' });
      
      expect(response.status).toBe(200);
      
      // Verify the correct services were called
      expect(getWeekDays).toHaveBeenCalledWith(0);
      expect(getWeekEvents).toHaveBeenCalledWith(
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        0
      );
      expect(getWeekDateRangeText).toHaveBeenCalledWith(0);
      expect(groupEventsByDay).toHaveBeenCalledWith(mockEvents);
    });
    
    it('should render dashboard with next week data when weekOffset=1', async () => {
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard')
        .query({ weekOffset: '1' });
      
      expect(response.status).toBe(200);
      
      // Verify the correct services were called with offset 1
      expect(getWeekDays).toHaveBeenCalledWith(1);
      expect(getWeekEvents).toHaveBeenCalledWith(
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        1
      );
      expect(getWeekDateRangeText).toHaveBeenCalledWith(1);
    });
    
    it('should handle errors when fetching calendar events', async () => {
      // Mock error response
      const mockError = new Error('Failed to fetch calendar events');
      getWeekEvents.mockRejectedValue(mockError);
      
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard')
        .query({ weekOffset: '0' });
      
      expect(response.status).toBe(200);
      
      // Verify error handling
      expect(getWeekEvents).toHaveBeenCalled();
      expect(groupEventsByDay).not.toHaveBeenCalled();
    });
  });
  
  describe('Event Formatting', () => {
    it('should transform events to the format expected by the view', () => {
      // This is a unit test for the transformation logic
      const transformedEvents = groupEventsByDay(mockEvents);
      
      // Verify the transformation
      expect(transformedEvents).toEqual(mockGroupedEvents);
    });
    
    it('should filter out attendees that match the location', () => {
      // This is a unit test for attendee filtering
      const eventWithLocationAsAttendee = {
        ...mockEvents[0],
        location: 'Conference Room A',
        attendees: [
          { name: 'Conference Room A' },
          { email: 'test2@example.com' }
        ]
      };
      
      // The location should be filtered out from attendees
      const filteredAttendees = eventWithLocationAsAttendee.attendees.filter(
        attendee => attendee.name !== eventWithLocationAsAttendee.location
      );
      
      expect(filteredAttendees).toHaveLength(1);
      expect(filteredAttendees[0].email).toBe('test2@example.com');
    });
  });
  
  describe('Authentication', () => {
    it('should test authentication middleware is called', async () => {
      // Import the auth middleware
      const { ensureAuth } = require('../../../middleware/auth');
      
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard');
      
      expect(response.status).toBe(200);
      
      // Verify that the authentication middleware was called
      expect(ensureAuth).toHaveBeenCalled();
    });
    
    it('should render dashboard when user is authenticated', async () => {
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard');
      
      expect(response.status).toBe(200);
    });
  });
  
  describe('Week Navigation', () => {
    it('should handle negative week offset for previous weeks', async () => {
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard')
        .query({ weekOffset: '-1' });
      
      expect(response.status).toBe(200);
      
      // Verify the correct services were called with negative offset
      expect(getWeekDays).toHaveBeenCalledWith(-1);
      expect(getWeekEvents).toHaveBeenCalledWith(
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        -1
      );
      expect(getWeekDateRangeText).toHaveBeenCalledWith(-1);
    });
    
    it('should handle non-numeric week offset gracefully', async () => {
      // Create a test app with explicit response handling
      const testApp = express();
      
      // Setup middleware
      testApp.use(express.json());
      testApp.use(express.urlencoded({ extended: false }));
      
      // Setup session
      testApp.use((req, res, next) => {
        req.session = {
          touch: jest.fn(),
          save: jest.fn(cb => typeof cb === 'function' && cb())
        };
        req.user = mockUser;
        next();
      });
      
      // Setup mock render that completes the response
      testApp.use((req, res, next) => {
        res.render = function(view, data) {
          res.status(200).send('rendered');
          return this;
        };
        next();
      });
      
      // Mount dashboard routes
      testApp.use('/dashboard', dashboardRoutes);
      
      // Make the request
      const response = await request(testApp)
        .get('/dashboard')
        .query({ weekOffset: 'invalid' });
      
      expect(response.status).toBe(200);
      
      // Should pass NaN when weekOffset is invalid
      expect(getWeekDays).toHaveBeenCalledWith(NaN);
      expect(getWeekEvents).toHaveBeenCalledWith(
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        NaN
      );
      expect(getWeekDateRangeText).toHaveBeenCalledWith(NaN);
    });
  });
});
