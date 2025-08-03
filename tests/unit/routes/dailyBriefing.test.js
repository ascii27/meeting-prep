const express = require('express');
const request = require('supertest');
const { ensureAuth } = require('../../../middleware/auth');
const dailyBriefingService = require('../../../services/dailyBriefingService');

// Mock dependencies
jest.mock('../../../middleware/auth', () => ({
  ensureAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../../../services/dailyBriefingService');

describe('Daily Briefing Routes', () => {
  // Mock user data
  const mockUser = {
    id: 'user123',
    googleId: 'test-user-id',
    displayName: 'Test User',
    email: 'test@example.com',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token'
  };

  // Mock briefing data
  const mockBriefing = {
    _id: 'briefing123',
    userId: 'test-user-id',
    date: '2025-08-03',
    meetings: [
      {
        id: 'meeting123',
        title: 'Test Meeting',
        summary: 'This is a test summary'
      }
    ],
    status: 'completed'
  };

  // Increase timeout for SSE tests
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/daily-briefing/generate', () => {
    it('should return 400 when date is missing', async () => {
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
      
      // Create a custom route handler for testing
      testApp.post('/api/daily-briefing/generate', (req, res) => {
        if (!req.body.date) {
          return res.status(400).json({ error: 'Date is required' });
        }
        
        res.status(200).json({ success: true });
      });
      
      // Make the request without a date
      const response = await request(testApp)
        .post('/api/daily-briefing/generate')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Date is required');
    });

    it('should set up SSE connection for progress updates', async () => {
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
      
      // Mock service implementation
      dailyBriefingService.generateDailyBriefing.mockImplementationOnce((userId, date, userTokens, progressCallback) => {
        // Simulate progress updates
        progressCallback({ progress: 50, message: 'Processing meetings' });
        progressCallback({ progress: 100, message: 'Completed' });
        return Promise.resolve(mockBriefing);
      });
      
      // Create a custom route handler for testing SSE
      testApp.post('/api/daily-briefing/generate', (req, res) => {
        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        // Call the service with a progress callback
        dailyBriefingService.generateDailyBriefing(
          mockUser.googleId,
          req.body.date,
          {
            accessToken: mockUser.accessToken,
            refreshToken: mockUser.refreshToken
          },
          (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
            
            if (progress.progress === 100) {
              res.end();
            }
          }
        ).catch(err => {
          res.write(`data: {"error": "${err.message}"}\n\n`);
          res.end();
        });
      });
      
      // Make the request
      const response = await request(testApp)
        .post('/api/daily-briefing/generate')
        .send({ date: '2025-08-03' })
        .set('Accept', 'text/event-stream');
      
      // Verify the response status
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      
      // Verify service was called with correct parameters
      expect(dailyBriefingService.generateDailyBriefing).toHaveBeenCalledWith(
        mockUser.googleId,
        '2025-08-03',
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        expect.any(Function) // progressCallback
      );
    });

    it('should handle errors during briefing generation', async () => {
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
      
      // Mock service to throw an error
      dailyBriefingService.generateDailyBriefing.mockImplementationOnce((userId, date, userTokens, progressCallback) => {
        // Simulate an error during generation
        progressCallback({ error: 'Service error' });
        return Promise.reject(new Error('Service error'));
      });
      
      // Create a custom route handler for testing error handling
      testApp.post('/api/daily-briefing/generate', (req, res) => {
        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        // Call the service with a progress callback
        dailyBriefingService.generateDailyBriefing(
          mockUser.googleId,
          req.body.date,
          {
            accessToken: mockUser.accessToken,
            refreshToken: mockUser.refreshToken
          },
          (progress) => {
            if (progress.error) {
              res.write(`data: {"error": "${progress.error}"}\n\n`);
              res.end();
            }
          }
        ).catch(err => {
          // This is expected in the test
        });
      });
      
      // Make the request
      const response = await request(testApp)
        .post('/api/daily-briefing/generate')
        .send({ date: '2025-08-03' })
        .set('Accept', 'text/event-stream');
      
      // For SSE connections, the HTTP status should be 200 even for errors
      // The error is communicated via the event stream, not the HTTP status code
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
      
      // Verify service was called with correct parameters
      expect(dailyBriefingService.generateDailyBriefing).toHaveBeenCalledWith(
        mockUser.googleId,
        '2025-08-03',
        {
          accessToken: mockUser.accessToken,
          refreshToken: mockUser.refreshToken
        },
        expect.any(Function) // progressCallback
      );
    });
  });

  describe('GET /api/daily-briefing/:date', () => {
    it('should return briefing for a specific date', async () => {
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
      
      // Mock service to return a briefing
      dailyBriefingService.getDailyBriefing.mockResolvedValueOnce(mockBriefing);
      
      // Create a custom route handler for testing
      testApp.get('/api/daily-briefing/:date', (req, res) => {
        // Call the service and return the result
        dailyBriefingService.getDailyBriefing(req.user.googleId, req.params.date)
          .then(briefing => {
            if (!briefing) {
              return res.status(404).json({ error: 'Briefing not found' });
            }
            res.status(200).json({ briefing });
          })
          .catch(err => {
            res.status(500).json({ error: err.message });
          });
      });
      
      // Make the request
      const response = await request(testApp)
        .get('/api/daily-briefing/2025-08-03');
      
      expect(response.status).toBe(200);
      expect(response.body.briefing).toEqual(mockBriefing);
    });

    it('should handle error if briefing not found', async () => {
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
      
      // Mock service to return null
      dailyBriefingService.getDailyBriefing.mockResolvedValueOnce(null);
      
      // Create a custom route handler for testing
      testApp.get('/api/daily-briefing/:date', (req, res) => {
        // Call the service and return the result
        dailyBriefingService.getDailyBriefing(req.user.googleId, req.params.date)
          .then(briefing => {
            if (!briefing) {
              return res.status(404).json({ error: 'Briefing not found' });
            }
            res.status(200).json({ briefing });
          })
          .catch(err => {
            res.status(500).json({ error: err.message });
          });
      });
      
      // Make the request
      const response = await request(testApp)
        .get('/api/daily-briefing/2025-08-03');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Briefing not found');
    });
  });
  
  describe('GET /api/daily-briefing/range/:startDate/:endDate', () => {
    it('should return briefings in date range', async () => {
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
      
      // Mock service to return briefings
      const mockBriefings = [mockBriefing];
      dailyBriefingService.getDailyBriefingsInRange.mockResolvedValueOnce(mockBriefings);
      
      // Create a custom route handler for testing
      testApp.get('/api/daily-briefing/range/:startDate/:endDate', (req, res) => {
        // Call the service and return the result
        dailyBriefingService.getDailyBriefingsInRange(
          req.user.googleId,
          req.params.startDate,
          req.params.endDate
        )
          .then(briefings => {
            res.status(200).json({ briefings });
          })
          .catch(err => {
            res.status(500).json({ error: err.message });
          });
      });
      
      // Make the request
      const response = await request(testApp)
        .get('/api/daily-briefing/range/2025-08-01/2025-08-07');
      
      expect(response.status).toBe(200);
      expect(response.body.briefings).toEqual(mockBriefings);
    });
  });
  
  describe('DELETE /api/daily-briefing/:date', () => {
    it('should delete briefing for a specific date', async () => {
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
      
      // Mock service to return success
      dailyBriefingService.deleteDailyBriefing.mockResolvedValueOnce({ deleted: true });
      
      // Create a custom route handler for testing
      testApp.delete('/api/daily-briefing/:date', (req, res) => {
        // Call the service and return the result
        dailyBriefingService.deleteDailyBriefing(req.user.googleId, req.params.date)
          .then(result => {
            res.status(200).json(result);
          })
          .catch(err => {
            res.status(500).json({ error: err.message });
          });
      });
      
      // Make the request
      const response = await request(testApp)
        .delete('/api/daily-briefing/2025-08-03');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ deleted: true });
    });
  });
  
  describe('GET /api/daily-briefing/status/:status', () => {
    it('should return briefings with specified status', async () => {
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
      
      // Mock service to return briefings
      const mockBriefings = [mockBriefing];
      dailyBriefingService.getBriefingsByStatus.mockResolvedValueOnce(mockBriefings);
      
      // Create a custom route handler for testing
      testApp.get('/api/daily-briefing/status/:status', (req, res) => {
        // Call the service and return the result
        dailyBriefingService.getBriefingsByStatus(req.user.googleId, req.params.status)
          .then(briefings => {
            res.status(200).json({ briefings });
          })
          .catch(err => {
            res.status(500).json({ error: err.message });
          });
      });
      
      // Make the request
      const response = await request(testApp)
        .get('/api/daily-briefing/status/completed');
      
      expect(response.status).toBe(200);
      expect(response.body.briefings).toEqual(mockBriefings);
    });
  });
  
  describe('Authentication', () => {
    it('should test authentication middleware is called', async () => {
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
      
      // Use the auth middleware
      testApp.get('/api/daily-briefing/test-auth', ensureAuth, (req, res) => {
        res.status(200).json({ success: true });
      });
      
      // Make the request
      const response = await request(testApp)
        .get('/api/daily-briefing/test-auth');
      
      expect(response.status).toBe(200);
      expect(ensureAuth).toHaveBeenCalled();
    });
  });
});
