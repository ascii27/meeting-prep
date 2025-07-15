const express = require('express');
const session = require('express-session');
const { getWeekEvents } = require('../../../services/calendarService');
const { getWeekDays, getWeekDateRangeText, groupEventsByDay } = require('../../../utils/dateUtils');

// Mock dependencies
jest.mock('../../../services/calendarService');
jest.mock('../../../utils/dateUtils');
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: (req, res, next) => next()
}));

// Mock data
const mockUser = {
  id: '123',
  displayName: 'Test User',
  email: 'test@example.com',
  image: 'profile.jpg',
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
  }
];

const mockGroupedEvents = {
  '2025-07-15': {
    date: '2025-07-15',
    events: [mockEvents[0]]
  }
};

describe('Dashboard Routes', () => {
  let app;
  let mockRender;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    getWeekDays.mockReturnValue(mockWeekDays);
    getWeekDateRangeText.mockReturnValue('July 14-18, 2025');
    getWeekEvents.mockResolvedValue(mockEvents);
    groupEventsByDay.mockReturnValue(mockGroupedEvents);
    
    // Create a fresh Express app for each test
    app = express();
    
    // Mock the render method
    mockRender = jest.fn();
    app.render = mockRender;
    app.response.render = function(view, options) {
      mockRender(view, options);
      return this;
    };
    
    // Setup session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Add user to session for testing
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });
    
    // Import and use dashboard routes
    const dashboardRoutes = require('../../../routes/dashboard');
    app.use('/dashboard', dashboardRoutes);
  });
  
  describe('GET /dashboard', () => {
    it('should call getWeekDays with offset 0 for current week', () => {
      // Create a mock request
      const req = {
        query: {},
        user: mockUser
      };
      
      // Create a mock response
      const res = {
        render: mockRender
      };
      
      // Get the route handler directly
      const dashboardRoute = require('../../../routes/dashboard');
      const routeHandler = dashboardRoute.stack[0].route.stack[1].handle;
      
      // Call the route handler directly
      routeHandler(req, res);
      
      // Verify getWeekDays was called with offset 0
      expect(getWeekDays).toHaveBeenCalledWith(0);
    });
    
    it('should call getWeekDays with offset 1 for next week', () => {
      // Create a mock request
      const req = {
        query: { weekOffset: '1' },
        user: mockUser
      };
      
      // Create a mock response
      const res = {
        render: mockRender
      };
      
      // Get the route handler directly
      const dashboardRoute = require('../../../routes/dashboard');
      const routeHandler = dashboardRoute.stack[0].route.stack[1].handle;
      
      // Call the route handler directly
      routeHandler(req, res);
      
      // Verify getWeekDays was called with offset 1
      expect(getWeekDays).toHaveBeenCalledWith(1);
    });
    
    it('should handle errors when fetching calendar events', () => {
      // Mock getWeekEvents to throw an error
      getWeekEvents.mockRejectedValueOnce(new Error('API Error'));
      
      // Create a mock request
      const req = {
        query: {},
        user: mockUser
      };
      
      // Create a mock response with a render method
      const res = {
        render: mockRender
      };
      
      // Get the route handler directly
      const dashboardRoute = require('../../../routes/dashboard');
      const routeHandler = dashboardRoute.stack[0].route.stack[1].handle;
      
      // Call the route handler directly
      return routeHandler(req, res).catch(() => {
        // Verify render was called with error data
        expect(mockRender).toHaveBeenCalledWith(
          'error',
          expect.objectContaining({
            message: 'Failed to fetch calendar events'
          })
        );
      });
    });
  });
});
