const request = require('supertest');
const express = require('express');
const indexRoutes = require('../../../routes/index');

// Mock the auth middleware
jest.mock('../../../middleware/auth', () => ({
  ensureGuest: jest.fn((req, res, next) => next())
}));

const { ensureGuest } = require('../../../middleware/auth');

describe('Index Routes', () => {
  let app;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    
    // Set up view engine for testing
    app.set('view engine', 'ejs');
    app.set('views', '/fake/views'); // Mock views directory
    
    // Mock res.render to avoid actual template rendering
    app.use((req, res, next) => {
      const originalRender = res.render;
      res.render = jest.fn((template, data) => {
        res.status(200).json({ template, data });
      });
      next();
    });
    
    app.use('/', indexRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should render login page for guests', async () => {
      const response = await request(app)
        .get('/');
      
      expect(response.status).toBe(200);
      expect(response.body.template).toBe('login');
      expect(ensureGuest).toHaveBeenCalled();
    });

    it('should call ensureGuest middleware', async () => {
      await request(app).get('/');
      
      expect(ensureGuest).toHaveBeenCalledTimes(1);
    });

    it('should handle ensureGuest middleware blocking access', async () => {
      // Mock ensureGuest to redirect authenticated users
      ensureGuest.mockImplementationOnce((req, res, next) => {
        res.redirect('/dashboard');
      });
      
      const response = await request(app)
        .get('/');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/dashboard');
    });

    it('should handle ensureGuest middleware errors', async () => {
      // Mock ensureGuest to throw an error
      ensureGuest.mockImplementationOnce((req, res, next) => {
        next(new Error('Middleware error'));
      });
      
      // Add error handler
      app.use((err, req, res, next) => {
        res.status(500).json({ error: err.message });
      });
      
      const response = await request(app)
        .get('/');
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Middleware error');
    });
  });

  describe('Route Configuration', () => {
    it('should be configured with correct middleware', () => {
      expect(ensureGuest).toBeDefined();
    });

    it('should handle requests to root path', async () => {
      const response = await request(app)
        .get('/');
      
      // Should not return 404
      expect(response.status).not.toBe(404);
    });
  });
});
