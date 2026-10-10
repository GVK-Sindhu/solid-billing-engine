import { Pool } from 'pg';
import { ISubscriptionRepository } from '../../domain/ports/ISubscriptionRepository';
import { Subscription } from '../../domain/models/Subscription';
import { getDatabasePool } from '../database/connection';

/**
 * PostgresSubscriptionRepository Adapter
 * Concrete PostgreSQL implementation of ISubscriptionRepository.
 */
export class PostgresSubscriptionRepository implements ISubscriptionRepository {
  private readonly pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getDatabasePool();
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const query = `
      SELECT id, user_id, base_price, expires_at
      FROM subscriptions
      WHERE user_id = $1
      LIMIT 1
    `;
    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      base_price: parseFloat(row.base_price),
      expires_at: new Date(row.expires_at),
    };
  }

  async updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void> {
    const query = `
      UPDATE subscriptions
      SET expires_at = $1
      WHERE id = $2
    `;
    await this.pool.query(query, [newExpiry, subscriptionId]);
  }
}

// Architectural aliases
export const SubscriptionRepository = PostgresSubscriptionRepository;
export const PostgresSubscriptionAdapter = PostgresSubscriptionRepository;
