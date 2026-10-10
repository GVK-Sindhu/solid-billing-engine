/**
 * LEGACY SUBSCRIPTION MANAGER (GOD CLASS)
 * 
 * Code Smells Exhibited:
 * 1. Hidden Dependencies / Direct Instantiation (tight coupling to DatabaseConnection and ThirdPartyPaymentClient)
 * 2. Temporal Coupling (direct call to new Date(), making deterministic unit testing impossible)
 * 3. I/O Interleaving (business rules like discounts and date math are mixed with database queries and HTTP API calls)
 * 4. Violation of Single Responsibility Principle (SRP)
 * 5. Violation of Dependency Inversion Principle (DIP)
 */

class DatabaseConnection {
  constructor(private url: string | undefined) {}
  async query(sql: string, params: any[]): Promise<any> {
    throw new Error("Direct DB connection call not mockable or unit-testable");
  }
}

class ThirdPartyPaymentClient {
  constructor(private apiKey: string | undefined) {}
  async chargeCustomer(customerId: string, amount: number): Promise<{ status: string }> {
    throw new Error("Direct external payment API call");
  }
}

export class LegacySubscriptionManager {
  async processRenewal(userId: string): Promise<{ success: boolean; message: string }> {
    // SMELL 1: Hardcoded Infrastructure
    const db = new DatabaseConnection(process.env.DB_URL);
    const user = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (!user) return { success: false, message: "User not found" };

    const sub = await db.query("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
    if (!sub) return { success: false, message: "Subscription not found" };

    // SMELL 2: Temporal Coupling (Non-deterministic)
    const now = new Date();

    // BUSINESS RULE 1: Cannot renew if not expired
    if (new Date(sub.expires_at) > now) {
      return { success: false, message: "Subscription is not yet expired" };
    }

    let chargeAmount = sub.base_price;

    // BUSINESS RULE 2: December Promotional Discount (10% off)
    if (now.getMonth() === 11) { // 11 is December in 0-indexed JS dates
      chargeAmount = chargeAmount * 0.9;
    }

    // SMELL 3: Direct Third-Party API Call
    const stripeClient = new ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY);

    try {
      const charge = await stripeClient.chargeCustomer(user.stripe_customer_id, chargeAmount);
      if (charge.status === "success") {
        // BUSINESS RULE 3: Add exactly 1 year to current time for next expiry
        const newExpiry = new Date(now);
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);

        await db.query("UPDATE subscriptions SET expires_at = ? WHERE id = ?", [newExpiry, sub.id]);
        return { success: true, message: "Renewal successful" };
      } else {
        return { success: false, message: "Payment failed" };
      }
    } catch (error) {
      return { success: false, message: "Payment gateway error" };
    }
  }
}
