/**
 * Graph Database Service Tests
 */
const graphDatabaseService = require('../graph/graphDatabaseService');

// Mock neo4j-driver
jest.mock('neo4j-driver', () => {
  const mockSession = {
    run: jest.fn().mockImplementation((query, params) => {
      // For createMeeting, return meeting properties
      if (query.includes('Meeting') && params.googleEventId) {
        return Promise.resolve({
          records: [
            {
              get: jest.fn().mockImplementation(key => ({
                properties: { 
                  id: 'meeting-id', 
                  googleEventId: params.googleEventId,
                  title: params.title
                }
              }))
            }
          ]
        });
      }
      
      // Default response for other queries
      return Promise.resolve({
        records: [
          {
            get: jest.fn().mockImplementation(key => ({
              properties: { id: 'test-id', email: 'test@example.com', name: 'Test User' }
            }))
          }
        ]
      });
    }),
    close: jest.fn().mockResolvedValue(null)
  };
  
  const mockDriver = {
    session: jest.fn().mockReturnValue(mockSession),
    close: jest.fn().mockResolvedValue(null)
  };
  
  return {
    driver: jest.fn().mockReturnValue(mockDriver),
    auth: {
      basic: jest.fn().mockReturnValue({ username: 'neo4j', password: 'password' })
    }
  };
});

describe('Graph Database Service', () => {
  beforeEach(() => {
    // Reset the initialized state before each test
    graphDatabaseService.initialized = false;
    graphDatabaseService.driver = null;
    jest.clearAllMocks();
  });
  
  afterAll(async () => {
    await graphDatabaseService.close();
  });
  
  test('should initialize connection to Neo4j', async () => {
    await graphDatabaseService.initialize();
    expect(graphDatabaseService.initialized).toBe(true);
    expect(graphDatabaseService.driver).not.toBeNull();
  });
  
  test('should execute a Cypher query', async () => {
    const result = await graphDatabaseService.executeQuery('MATCH (n) RETURN n');
    expect(result).toBeDefined();
    expect(result.records).toHaveLength(1);
  });
  
  test('should create a Person node', async () => {
    const person = {
      email: 'test@example.com',
      name: 'Test User',
      photoUrl: 'https://example.com/photo.jpg'
    };
    
    const result = await graphDatabaseService.createPerson(person);
    expect(result).toBeDefined();
    expect(result.email).toBe('test@example.com');
  });
  
  test('should create a Meeting node with relationships', async () => {
    const meeting = {
      googleEventId: 'test-event-id',
      title: 'Test Meeting',
      description: 'Test Description',
      startTime: '2023-01-01T10:00:00Z',
      endTime: '2023-01-01T11:00:00Z',
      location: 'Test Location',
      organizer: {
        email: 'organizer@example.com',
        name: 'Organizer'
      },
      attendees: [
        {
          email: 'attendee1@example.com',
          name: 'Attendee 1'
        },
        {
          email: 'attendee2@example.com',
          name: 'Attendee 2'
        }
      ]
    };
    
    const result = await graphDatabaseService.createMeeting(meeting);
    expect(result).toBeDefined();
    // The createMeeting method returns just the meeting node properties
    expect(result.googleEventId).toBe('test-event-id');
    expect(result.title).toBe('Test Meeting');
  });
  
  test('should get recent meetings', async () => {
    const meetings = await graphDatabaseService.getRecentMeetings(5);
    expect(meetings).toBeDefined();
    expect(Array.isArray(meetings)).toBe(true);
  });
  
  test('should get meeting participants', async () => {
    const participants = await graphDatabaseService.getMeetingParticipants('test-id');
    expect(participants).toBeDefined();
    expect(Array.isArray(participants)).toBe(true);
  });
  
  test('should get meetings for a person', async () => {
    const meetings = await graphDatabaseService.getMeetingsForPerson('test@example.com', 5);
    expect(meetings).toBeDefined();
    expect(Array.isArray(meetings)).toBe(true);
  });
});
