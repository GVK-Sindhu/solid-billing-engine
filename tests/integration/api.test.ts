import request from 'supertest';
import express from 'express';
import { SubscriptionController } from '../../src/api/controllers/SubscriptionController';
import { ISubscriptionRepository } from '../../src/domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../src/domain/ports/IUserRepository';
import { IPaymentGateway } from '../../src/domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../src/domain/ports/ITimeProvider';

describe('POST /api/renew Integration Tests', () => {
  let app: express.Express;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockPaymentGateway: jest.Mocked<IPaymentGateway>;
  let mockTimeProvider: ITimeProvider;

  beforeEach(() => {
    mockSubRepo = {
      getSubscriptionByUserId: jest.fn(),
      updateExpiration: jest.fn().mockResolvedValue(undefined),
    };
    mockUserRepo = {
      getUserById: jest.fn(),
    };
    mockPaymentGateway = {
      charge: jest.fn().mockResolvedValue(true),
    };
    mockTimeProvider = {
      getCurrentTime: jest.fn().mockReturnValue(new Date('2024-06-01T00:00:00Z')),
    };

    const controller = new SubscriptionController(
      mockSubRepo,
      mockUserRepo,
      mockPaymentGateway,
      mockTimeProvider
    );

    app = express();
    app.use(express.json());
    app.post('/api/renew', controller.renew);
  });

  it('should return 400 Bad Request if userId is missing', async () => {
    const res = await request(app)
      .post('/api/renew')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'userId is required',
    });
  });

  it('should return 200 OK on successful renewal with valid expired user', async () => {
    mockUserRepo.getUserById.mockResolvedValueOnce({
      id: 'user-expired-1',
      stripe_customer_id: 'cus_stripe_expired_1',
    });

    mockSubRepo.getSubscriptionByUserId.mockResolvedValueOnce({
      id: 'sub-expired-1',
      user_id: 'user-expired-1',
      base_price: 100,
      expires_at: new Date('2020-01-01T00:00:00Z'),
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-expired-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Renewal successful',
    });
    expect(mockPaymentGateway.charge).toHaveBeenCalledWith('cus_stripe_expired_1', 100);
    expect(mockSubRepo.updateExpiration).toHaveBeenCalledTimes(1);
  });

  it('should return 400 Bad Request if subscription is not yet expired', async () => {
    mockUserRepo.getUserById.mockResolvedValueOnce({
      id: 'user-unexpired-2',
      stripe_customer_id: 'cus_stripe_unexpired_2',
    });

    mockSubRepo.getSubscriptionByUserId.mockResolvedValueOnce({
      id: 'sub-unexpired-2',
      user_id: 'user-unexpired-2',
      base_price: 150,
      expires_at: new Date('2099-12-31T23:59:59Z'),
    });

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-unexpired-2' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Subscription is not yet expired',
    });
  });

  it('should return 400 Bad Request if user does not exist', async () => {
    mockUserRepo.getUserById.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/renew')
      .send({ userId: 'user-nonexistent-999' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'User not found',
    });
  });
});
