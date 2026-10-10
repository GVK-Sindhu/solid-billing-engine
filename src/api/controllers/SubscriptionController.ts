import { Request, Response } from 'express';
import { SubscriptionBillingService } from '../../domain/services/SubscriptionBillingService';
import { PostgresSubscriptionRepository } from '../../infrastructure/adapters/PostgresSubscriptionRepository';
import { PostgresUserRepository } from '../../infrastructure/adapters/PostgresUserRepository';
import { MockPaymentGateway } from '../../infrastructure/adapters/MockPaymentGateway';
import { SystemTimeProvider } from '../../infrastructure/adapters/SystemTimeProvider';
import { ISubscriptionRepository } from '../../domain/ports/ISubscriptionRepository';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPaymentGateway } from '../../domain/ports/IPaymentGateway';
import { ITimeProvider } from '../../domain/ports/ITimeProvider';

export class SubscriptionController {
  private subscriptionRepo?: ISubscriptionRepository;
  private userRepo?: IUserRepository;
  private paymentGateway?: IPaymentGateway;
  private timeProvider?: ITimeProvider;

  constructor(
    subscriptionRepo?: ISubscriptionRepository,
    userRepo?: IUserRepository,
    paymentGateway?: IPaymentGateway,
    timeProvider?: ITimeProvider
  ) {
    this.subscriptionRepo = subscriptionRepo;
    this.userRepo = userRepo;
    this.paymentGateway = paymentGateway;
    this.timeProvider = timeProvider;
  }

  /**
   * HTTP POST /api/renew
   * Reads userId from request body, wires adapters and domain service, and processes renewal.
   */
  renew = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { userId } = req.body;

      if (!userId || typeof userId !== 'string' || userId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
        });
      }

      // Wire dependencies (Inversion of Control)
      const subscriptionRepo = this.subscriptionRepo || new PostgresSubscriptionRepository();
      const userRepo = this.userRepo || new PostgresUserRepository();
      const paymentGateway = this.paymentGateway || new MockPaymentGateway();
      const timeProvider = this.timeProvider || new SystemTimeProvider();

      // Inject adapters into domain service
      const billingService = new SubscriptionBillingService(
        subscriptionRepo,
        userRepo,
        paymentGateway,
        timeProvider
      );

      const result = await billingService.processRenewal(userId.trim());

      if (result.success) {
        return res.status(200).json({
          success: true,
          message: result.message,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  };
}
