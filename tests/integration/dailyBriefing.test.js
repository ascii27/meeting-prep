const request = require('supertest');
const app = require('../../app');

describe('Daily Briefing API Integration Tests', () => {
  // Note: These tests require authentication and would need proper session setup
  // For now, we'll test the route structure and basic error handling
  
  describe('POST /api/daily-briefing/generate', () => {
    test('should redirect when not authenticated', async () => {
      const response = await request(app)
        .post('/api/daily-briefing/generate')
        .send({ date: '2025-07-30' });
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
    
    test('should redirect when date is missing (no auth)', async () => {
      // Mock session for this test
      const agent = request.agent(app);
      
      // This would need proper session setup in a real test
      const response = await agent
        .post('/api/daily-briefing/generate')
        .send({});
      
      // Without proper auth, we expect redirect
      expect(response.status).toBe(302);
    });
  });
  
  describe('GET /api/daily-briefing/:date', () => {
    test('should redirect when not authenticated', async () => {
      const response = await request(app)
        .get('/api/daily-briefing/2025-07-30');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });
  
  describe('DELETE /api/daily-briefing/:date', () => {
    test('should redirect when not authenticated', async () => {
      const response = await request(app)
        .delete('/api/daily-briefing/2025-07-30');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });
  
  describe('GET /api/daily-briefing/range/:startDate/:endDate', () => {
    test('should redirect when not authenticated', async () => {
      const response = await request(app)
        .get('/api/daily-briefing/range/2025-07-30/2025-08-06');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });
  
  describe('GET /api/daily-briefing/status/:status', () => {
    test('should redirect when not authenticated', async () => {
      const response = await request(app)
        .get('/api/daily-briefing/status/completed');
      
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');
    });
  });
});
