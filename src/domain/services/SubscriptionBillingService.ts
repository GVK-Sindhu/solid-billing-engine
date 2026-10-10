import { ISubscriptionRepository } from '../ports/ISubscriptionRepository';
import { IUserRepository } from '../ports/IUserRepository';
import { IPaymentGateway } from '../ports/IPaymentGateway';
import { ITimeProvider } from '../ports/ITimeProvider';

export interface RenewalResult {
  success: boolean;
  message: string;
}

export class SubscriptionBillingService {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly userRepo: IUserRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly timeProvider: ITimeProvider
  ) {}

  /**
   * Orchestrates the subscription renewal process following business rules:
   * 1. Validate user and subscription existence.
   * 2. Validate subscription is expired against injected time provider.
   * 3. Apply December promotional discount (10% off) if current month is December (month 11 in 0-indexed JS).
   * 4. Charge customer via payment gateway.
   * 5. Extend subscription expiry by 1 year from current time on success.
   */
  async processRenewal(userId: string): Promise<RenewalResult> {
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    const sub = await this.subscriptionRepo.getSubscriptionByUserId(userId);
    if (!sub) {
      return { success: false, message: "Subscription not found" };
    }

    const now = this.timeProvider.getCurrentTime();
    const expiryDate = sub.expires_at instanceof Date ? sub.expires_at : new Date(sub.expires_at);

    // BUSINESS RULE 1: Cannot renew if not expired
    if (expiryDate.getTime() > now.getTime()) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    let chargeAmount = Number(sub.base_price);

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    if (now.getMonth() === 11) {
      chargeAmount = chargeAmount * 0.9;
    }

    try {
      const paymentSuccess = await this.paymentGateway.charge(user.stripe_customer_id, chargeAmount);

      if (paymentSuccess) {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now.getTime());
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        await this.subscriptionRepo.updateExpiration(sub.id, newExpiry);
        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}
