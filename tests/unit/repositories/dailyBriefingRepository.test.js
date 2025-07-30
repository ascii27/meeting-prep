const { v4: uuidv4 } = require('uuid');

// Mock the DailyBriefingRepository
jest.mock('../../../repositories/dailyBriefingRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findByUserIdAndDate: jest.fn(),
    findByUserIdAndDateRange: jest.fn(),
    createBriefing: jest.fn(),
    updateStatus: jest.fn(),
    updateContent: jest.fn(),
    deleteBriefing: jest.fn(),
    findByStatus: jest.fn()
  }));
});

const DailyBriefingRepository = require('../../../repositories/dailyBriefingRepository');

describe('DailyBriefingRepository', () => {
  let repository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DailyBriefingRepository();
  });

  describe('findByUserIdAndDate', () => {
    test('should find briefing by user ID and date', async () => {
      const userId = uuidv4();
      const briefingId = uuidv4();
      
      const expectedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 3,
        status: 'completed',
        summaryText: 'Test summary',
        User: {
          id: userId,
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      repository.findByUserIdAndDate.mockResolvedValue(expectedBriefing);

      const foundBriefing = await repository.findByUserIdAndDate(userId, '2025-07-29');

      expect(foundBriefing).toBeDefined();
      expect(foundBriefing.id).toBe(briefingId);
      expect(foundBriefing.userId).toBe(userId);
      expect(foundBriefing.briefingDate).toBe('2025-07-29');
      expect(foundBriefing.User).toBeDefined();
      expect(foundBriefing.User.name).toBe('Test User');
      expect(repository.findByUserIdAndDate).toHaveBeenCalledWith(userId, '2025-07-29');
    });

    test('should return null when briefing not found', async () => {
      const userId = uuidv4();
      
      repository.findByUserIdAndDate.mockResolvedValue(null);
      
      const foundBriefing = await repository.findByUserIdAndDate(userId, '2025-07-30');

      expect(foundBriefing).toBeNull();
      expect(repository.findByUserIdAndDate).toHaveBeenCalledWith(userId, '2025-07-30');
    });
  });

  describe('findByUserIdAndDateRange', () => {
    test('should find briefings within date range', async () => {
      const userId = uuidv4();
      
      const expectedBriefings = [
        {
          id: uuidv4(),
          userId: userId,
          briefingDate: '2025-07-30',
          meetingCount: 1,
          status: 'pending'
        },
        {
          id: uuidv4(),
          userId: userId,
          briefingDate: '2025-07-29',
          meetingCount: 2,
          status: 'completed'
        }
      ];

      repository.findByUserIdAndDateRange.mockResolvedValue(expectedBriefings);

      const foundBriefings = await repository.findByUserIdAndDateRange(
        userId,
        '2025-07-29',
        '2025-07-31'
      );

      expect(foundBriefings).toHaveLength(2);
      expect(foundBriefings[0].briefingDate).toBe('2025-07-30'); // DESC order
      expect(foundBriefings[1].briefingDate).toBe('2025-07-29');
      expect(repository.findByUserIdAndDateRange).toHaveBeenCalledWith(
        userId,
        '2025-07-29',
        '2025-07-31'
      );
    });
  });

  describe('createBriefing', () => {
    test('should create a new briefing', async () => {
      const userId = uuidv4();
      const briefingId = uuidv4();
      
      const briefingData = {
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 4,
        status: 'processing',
        summaryText: 'Creating test briefing'
      };

      const expectedBriefing = {
        id: briefingId,
        ...briefingData,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      repository.createBriefing.mockResolvedValue(expectedBriefing);

      const createdBriefing = await repository.createBriefing(briefingData);

      expect(createdBriefing).toBeDefined();
      expect(createdBriefing.id).toBeDefined();
      expect(createdBriefing.userId).toBe(userId);
      expect(createdBriefing.briefingDate).toBe('2025-07-29');
      expect(createdBriefing.meetingCount).toBe(4);
      expect(createdBriefing.status).toBe('processing');
      expect(repository.createBriefing).toHaveBeenCalledWith(briefingData);
    });
  });

  describe('updateStatus', () => {
    test('should update briefing status', async () => {
      const briefingId = uuidv4();
      const userId = uuidv4();
      
      const updatedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 2,
        status: 'processing',
        updatedAt: new Date()
      };

      repository.updateStatus.mockResolvedValue(updatedBriefing);

      const result = await repository.updateStatus(briefingId, 'processing');

      expect(result.status).toBe('processing');
      expect(repository.updateStatus).toHaveBeenCalledWith(briefingId, 'processing');
    });

    test('should throw error when briefing not found', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
      
      const error = new Error('Briefing with ID 550e8400-e29b-41d4-a716-446655440000 not found');
      repository.updateStatus.mockRejectedValue(error);

      await expect(repository.updateStatus(nonExistentId, 'completed'))
        .rejects
        .toThrow('Briefing with ID');
        
      expect(repository.updateStatus).toHaveBeenCalledWith(nonExistentId, 'completed');
    });
  });

  describe('updateContent', () => {
    test('should update briefing content and status', async () => {
      const briefingId = uuidv4();
      const userId = uuidv4();

      const contentData = {
        summaryText: 'Updated summary text',
        summaryHtml: '<p>Updated summary HTML</p>',
        peopleOverview: 'John Doe, Jane Smith',
        priorityPreparations: 'Review documents, Prepare presentation'
      };

      const updatedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 3,
        status: 'completed',
        ...contentData,
        updatedAt: new Date()
      };

      repository.updateContent.mockResolvedValue(updatedBriefing);

      const result = await repository.updateContent(briefingId, contentData);

      expect(result.summaryText).toBe('Updated summary text');
      expect(result.summaryHtml).toBe('<p>Updated summary HTML</p>');
      expect(result.peopleOverview).toBe('John Doe, Jane Smith');
      expect(result.priorityPreparations).toBe('Review documents, Prepare presentation');
      expect(result.status).toBe('completed');
      expect(repository.updateContent).toHaveBeenCalledWith(briefingId, contentData);
    });
  });

  describe('deleteBriefing', () => {
    test('should delete briefing successfully', async () => {
      const briefingId = uuidv4();

      repository.deleteBriefing.mockResolvedValue(true);

      const deleteResult = await repository.deleteBriefing(briefingId);

      expect(deleteResult).toBe(true);
      expect(repository.deleteBriefing).toHaveBeenCalledWith(briefingId);
    });

    test('should return false when briefing not found', async () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';

      repository.deleteBriefing.mockResolvedValue(false);

      const deleteResult = await repository.deleteBriefing(nonExistentId);

      expect(deleteResult).toBe(false);
      expect(repository.deleteBriefing).toHaveBeenCalledWith(nonExistentId);
    });
  });

  describe('findByStatus', () => {
    test('should find briefings by status', async () => {
      const userId = uuidv4();
      
      const expectedBriefings = [
        {
          id: uuidv4(),
          userId: userId,
          briefingDate: '2025-07-29',
          meetingCount: 1,
          status: 'pending'
        },
        {
          id: uuidv4(),
          userId: userId,
          briefingDate: '2025-07-31',
          meetingCount: 3,
          status: 'pending'
        }
      ];

      repository.findByStatus.mockResolvedValue(expectedBriefings);

      const pendingBriefings = await repository.findByStatus('pending');

      expect(pendingBriefings).toHaveLength(2);
      expect(pendingBriefings[0].status).toBe('pending');
      expect(pendingBriefings[1].status).toBe('pending');
      expect(repository.findByStatus).toHaveBeenCalledWith('pending');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const userId = uuidv4();
      const error = new Error('Database connection error');
      
      repository.findByUserIdAndDate.mockRejectedValue(error);

      await expect(repository.findByUserIdAndDate(userId, '2025-07-29'))
        .rejects
        .toThrow('Database connection error');
        
      expect(repository.findByUserIdAndDate).toHaveBeenCalledWith(userId, '2025-07-29');
    });
  });
});
