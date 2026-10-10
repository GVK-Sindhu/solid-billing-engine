import { Subscription } from '../models/Subscription';

/**
 * ISubscriptionRepository Port
 * Abstracts persistence operations for subscriptions.
 */
export interface ISubscriptionRepository {
  /**
   * Fetch subscription by user ID
   * @param userId - Unique user identifier
   */
  getSubscriptionByUserId(userId: string): Promise<Subscription | null>;

  /**
   * Update the expiration date of a subscription
   * @param subscriptionId - Unique subscription identifier
   * @param newExpiry - The new expiration date
   */
  updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void>;
}
