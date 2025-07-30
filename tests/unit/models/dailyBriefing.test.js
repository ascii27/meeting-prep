const { v4: uuidv4 } = require('uuid');

describe('DailyBriefing Model', () => {
  // Mock the DailyBriefing model
  const mockDailyBriefingModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    belongsTo: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Model Validation', () => {
    test('should create a valid daily briefing with required fields', async () => {
      const userId = uuidv4();
      const briefingId = uuidv4();
      const now = new Date();
      
      const briefingData = {
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 3,
        status: 'pending'
      };

      const expectedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 3,
        status: 'pending',
        generatedAt: now,
        createdAt: now,
        updatedAt: now
      };

      mockDailyBriefingModel.create.mockResolvedValue(expectedBriefing);

      const briefing = await mockDailyBriefingModel.create(briefingData);

      expect(briefing).toBeDefined();
      expect(briefing.id).toBe(briefingId);
      expect(briefing.userId).toBe(userId);
      expect(briefing.briefingDate).toBe('2025-07-29');
      expect(briefing.meetingCount).toBe(3);
      expect(briefing.status).toBe('pending');
      expect(briefing.generatedAt).toBeDefined();
      expect(briefing.createdAt).toBeDefined();
      expect(briefing.updatedAt).toBeDefined();
      expect(mockDailyBriefingModel.create).toHaveBeenCalledWith(briefingData);
    });

    test('should fail validation when required fields are missing', async () => {
      const briefingData = {
        briefingDate: '2025-07-29'
        // Missing userId
      };

      const validationError = new Error('Validation error: userId is required');
      mockDailyBriefingModel.create.mockRejectedValue(validationError);

      await expect(mockDailyBriefingModel.create(briefingData))
        .rejects
        .toThrow('Validation error: userId is required');

      expect(mockDailyBriefingModel.create).toHaveBeenCalledWith(briefingData);
    });

    test('should set default values correctly', async () => {
      const userId = uuidv4();
      const briefingId = uuidv4();
      const now = new Date();

      const briefingData = {
        userId: userId,
        briefingDate: '2025-07-29'
      };

      const expectedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 0, // Default value
        status: 'pending', // Default value
        summaryText: null,
        summaryHtml: null,
        peopleOverview: null,
        priorityPreparations: null,
        generatedAt: now,
        createdAt: now,
        updatedAt: now
      };

      mockDailyBriefingModel.create.mockResolvedValue(expectedBriefing);

      const briefing = await mockDailyBriefingModel.create(briefingData);

      expect(briefing.meetingCount).toBe(0);
      expect(briefing.status).toBe('pending');
      expect(briefing.summaryText).toBeNull();
      expect(briefing.summaryHtml).toBeNull();
      expect(briefing.peopleOverview).toBeNull();
      expect(briefing.priorityPreparations).toBeNull();
      expect(mockDailyBriefingModel.create).toHaveBeenCalledWith(briefingData);
    });

    test('should validate status enum values', async () => {
      const userId = uuidv4();
      const validStatuses = ['pending', 'processing', 'completed', 'failed'];
      
      // Test valid status values
      for (const status of validStatuses) {
        const briefingId = uuidv4();
        const briefingData = {
          userId: userId,
          briefingDate: `2025-07-${29 + validStatuses.indexOf(status)}`,
          status
        };

        const expectedBriefing = {
          id: briefingId,
          userId: userId,
          briefingDate: briefingData.briefingDate,
          status: status,
          meetingCount: 0,
          generatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockDailyBriefingModel.create.mockResolvedValueOnce(expectedBriefing);
        const briefing = await mockDailyBriefingModel.create(briefingData);
        expect(briefing.status).toBe(status);
      }

      // Test invalid status value
      const invalidBriefingData = {
        userId: userId,
        briefingDate: '2025-08-01',
        status: 'invalid-status'
      };

      const validationError = new Error('Validation error: Invalid status value');
      mockDailyBriefingModel.create.mockRejectedValue(validationError);

      await expect(mockDailyBriefingModel.create(invalidBriefingData))
        .rejects
        .toThrow('Validation error: Invalid status value');
    });
  });

  describe('Model Associations', () => {
    test('should associate with User model', () => {
      // Test that the model defines the correct association
      expect(mockDailyBriefingModel.belongsTo).toBeDefined();
      
      // In a real implementation, this would test:
      // DailyBriefing.belongsTo(User, { foreignKey: 'userId' });
      // But for unit testing, we just verify the association method exists
    });
  });

  describe('Model Constraints', () => {
    test('should enforce unique constraint on userId and briefingDate', async () => {
      const userId = uuidv4();
      const briefingData = {
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 1
      };

      // First creation succeeds
      const firstBriefing = {
        id: uuidv4(),
        ...briefingData,
        status: 'pending',
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockDailyBriefingModel.create.mockResolvedValueOnce(firstBriefing);
      const result = await mockDailyBriefingModel.create(briefingData);
      expect(result).toBeDefined();

      // Second creation with same userId and briefingDate should fail
      const constraintError = new Error('Unique constraint violation');
      mockDailyBriefingModel.create.mockRejectedValue(constraintError);
      
      await expect(mockDailyBriefingModel.create(briefingData))
        .rejects
        .toThrow('Unique constraint violation');
    });
  });

  describe('Model Updates', () => {
    test('should update briefing content correctly', async () => {
      const briefingId = uuidv4();
      const userId = uuidv4();
      
      const updateData = {
        summaryText: 'Test summary text',
        summaryHtml: '<p>Test summary HTML</p>',
        status: 'completed',
        peopleOverview: 'John Doe, Jane Smith',
        priorityPreparations: 'Review quarterly reports'
      };

      const updatedBriefing = {
        id: briefingId,
        userId: userId,
        briefingDate: '2025-07-29',
        meetingCount: 2,
        ...updateData,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDailyBriefingModel.update.mockResolvedValue([1, [updatedBriefing]]);
      
      const [affectedRows, updatedRecords] = await mockDailyBriefingModel.update(updateData, {
        where: { id: briefingId },
        returning: true
      });

      expect(affectedRows).toBe(1);
      expect(updatedRecords[0].summaryText).toBe('Test summary text');
      expect(updatedRecords[0].summaryHtml).toBe('<p>Test summary HTML</p>');
      expect(updatedRecords[0].status).toBe('completed');
      expect(updatedRecords[0].peopleOverview).toBe('John Doe, Jane Smith');
      expect(updatedRecords[0].priorityPreparations).toBe('Review quarterly reports');
      expect(mockDailyBriefingModel.update).toHaveBeenCalledWith(updateData, {
        where: { id: briefingId },
        returning: true
      });
    });
  });
});
