/**
 * IPaymentGateway Port
 * Decouples domain logic from external payment APIs (e.g., Stripe, PayPal).
 */
export interface IPaymentGateway {
  /**
   * Attempts to charge a user a specific amount
   * @param customerId - Customer identifier for the payment provider
   * @param amount - Charge amount
   * @returns boolean indicating success
   */
  charge(customerId: string, amount: number): Promise<boolean>;
}
