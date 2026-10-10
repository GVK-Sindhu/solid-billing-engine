import { IPaymentGateway } from '../../domain/ports/IPaymentGateway';

/**
 * MockPaymentGateway Adapter
 * Simulates third-party HTTP payment calls (e.g., Stripe API).
 */
export class MockPaymentGateway implements IPaymentGateway {
  private apiKey: string;
  private shouldSucceed: boolean;

  constructor(apiKey?: string, shouldSucceed = true) {
    this.apiKey = apiKey || process.env.PAYMENT_API_KEY || 'mock_stripe_key_123';
    this.shouldSucceed = shouldSucceed;
  }

  setShouldSucceed(value: boolean): void {
    this.shouldSucceed = value;
  }

  async charge(customerId: string, amount: number): Promise<boolean> {
    // In production, this would make an HTTP POST request to Stripe's charges API.
    // Here it acts as the concrete infrastructure adapter for the application.
    if (!customerId || amount <= 0) {
      return false;
    }
    return this.shouldSucceed;
  }
}

// Architectural aliases
export const MockStripePaymentGateway = MockPaymentGateway;
export const StripePaymentAdapter = MockPaymentGateway;
