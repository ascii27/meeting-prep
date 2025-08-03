// Mock environment variables
process.env.GOOGLE_CLIENT_ID = 'mock-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'mock-client-secret';
process.env.SESSION_SECRET = 'mock-session-secret';

// Mock marked module to avoid ES module issues
const mockMarked = jest.fn((text) => `<p>${text}</p>`);
mockMarked.setOptions = jest.fn();
mockMarked.parse = jest.fn((text) => `<p>${text}</p>`);

jest.mock('marked', () => ({
  marked: mockMarked
}));
