import { SubscriptionBillingService } from '../../src/domain/services/SubscriptionBillingService';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';
import { Subscription } from '../../src/domain/models/Subscription';
import { User } from '../../src/domain/models/User';

describe('SubscriptionBillingService', () => {
  let mockSubscriptionRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: ITimeProvider;

  const sampleUser: User = {
    id: 'user-123',
    stripe_customer_id: 'cus_test_123',
  };

  const sampleExpiredSubscription: Subscription = {
    id: 'sub-456',
    user_id: 'user-123',
    base_price: 100,
    expires_at: new Date('2023-11-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockSubscriptionRepo = {
      getSubscriptionByUserId: jest.fn().mockResolvedValue({ ...sampleExpiredSubscription }),
      updateExpiration: jest.fn().mockResolvedValue(undefined),
    };

    mockUserRepo = {
      getUserById: jest.fn().mockResolvedValue({ ...sampleUser }),
    };

    mockPaymentGateway = {
      charge: jest.fn().mockResolvedValue(true),
    };

    // Default time: mid-November (non-December)
    mockTimeProvider = {
      getCurrentTime: jest.fn().mockReturnValue(new Date('2023-11-15T10:00:00Z')),
    };
  });

  describe('December Promotional Discount', () => {
    it('should apply a 10% discount in December', async () => {
      // Arrange: Stub clock to December 15th (Month 11 in JS 0-indexed Date)
      const decemberTime = new Date('2023-12-15T10:00:00Z');
      mockTimeProvider = {
        getCurrentTime: () => decemberTime,
      };

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Renewal successful',
      });
      // 100 base price * 0.9 = 90
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_test_123', 90);
      expect(mockSubscriptionRepo.updateExpiration).toHaveBeenCalledTimes(1);

      const expectedNewExpiry = new Date(decemberTime.getTime());
      expectedNewExpiry.setFullYear(2024);
      expect(mockSubscriptionRepo.updateExpiration).toHaveBeenCalledWith('sub-456', expectedNewExpiry);
    });

    it('should charge standard price in non-December months', async () => {
      // Arrange: Stub clock to July 10th
      const julyTime = new Date('2024-07-10T14:30:00Z');
      mockTimeProvider = {
        getCurrentTime: () => julyTime,
      };

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Renewal successful',
      });
      // Standard full price 100
      expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_test_123', 100);
      expect(mockSubscriptionRepo.updateExpiration).toHaveBeenCalledTimes(1);
    });
  });

  describe('Temporal Rules', () => {
    it('should fail if the subscription is not yet expired', async () => {
      // Arrange: Time is set to before the subscription expires
      const currentTime = new Date('2023-10-01T00:00:00Z');
      mockTimeProvider = {
        getCurrentTime: () => currentTime,
      };

      // Subscription expires in the future relative to currentTime
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValueOnce({
        id: 'sub-456',
        user_id: 'user-123',
        base_price: 100,
        expires_at: new Date('2023-11-01T00:00:00Z'),
      });

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Subscription is not yet expired',
      });
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should allow renewal if subscription expired in the past', async () => {
      const currentTime = new Date('2023-11-15T00:00:00Z');
      mockTimeProvider = {
        getCurrentTime: () => currentTime,
      };

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);
      expect(mockPaymentGateway.charge).toHaveBeenCalled();
    });
  });

  describe('Payment Gateway Handling', () => {
    it('should fail gracefully if the payment gateway fails', async () => {
      // Arrange: Gateway returns false (e.g., declined card)
      mockPaymentGateway.charge.mockResolvedValueOnce(false);

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Payment failed',
      });
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });

    it('should catch and handle payment gateway network/API errors', async () => {
      // Arrange: Gateway throws unexpected exception (e.g. timeout / network error)
      mockPaymentGateway.charge.mockRejectedValueOnce(new Error('Connection timed out'));

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      // Act
      const result = await service.processRenewal('user-123');

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Payment gateway error',
      });
      expect(mockSubscriptionRepo.updateExpiration).not.toHaveBeenCalled();
    });
  });

  describe('Entity Existence Validations', () => {
    it('should fail if user is not found', async () => {
      mockUserRepo.getUserById.mockResolvedValueOnce(null);

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      const result = await service.processRenewal('non-existent-user');

      expect(result).toEqual({
        success: false,
        message: 'User not found',
      });
      expect(mockSubscriptionRepo.getSubscriptionByUserId).not.toHaveBeenCalled();
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });

    it('should fail if subscription is not found', async () => {
      mockSubscriptionRepo.getSubscriptionByUserId.mockResolvedValueOnce(null);

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      const result = await service.processRenewal('user-123');

      expect(result).toEqual({
        success: false,
        message: 'Subscription not found',
      });
      expect(mockPaymentGateway.charge).not.toHaveBeenCalled();
    });
  });

  describe('Date Extension Math', () => {
    it('should add exactly 1 year to current time upon successful renewal', async () => {
      const fixedNow = new Date('2024-02-29T12:00:00Z');
      mockTimeProvider = {
        getCurrentTime: () => fixedNow,
      };

      const service = new SubscriptionBillingService(
        mockSubscriptionRepo,
        mockUserRepo,
        mockPaymentGateway,
        mockTimeProvider
      );

      const result = await service.processRenewal('user-123');

      expect(result.success).toBe(true);

      const expectedExpiry = new Date(fixedNow.getTime());
      expectedExpiry.setFullYear(2025);

      expect(mockSubscriptionRepo.updateExpiration).toHaveBeenCalledWith(
        'sub-456',
        expectedExpiry
      );
    });
  });
});
