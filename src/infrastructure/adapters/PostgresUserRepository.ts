import { Pool } from 'pg';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/models/User';
import { getDatabasePool } from '../database/connection';

/**
 * PostgresUserRepository Adapter
 * Concrete PostgreSQL implementation of IUserRepository.
 */
export class PostgresUserRepository implements IUserRepository {
  private readonly pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getDatabasePool();
  }

  async getUserById(userId: string): Promise<User | null> {
    const query = `
      SELECT id, stripe_customer_id
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      stripe_customer_id: row.stripe_customer_id,
    };
  }
}

// Architectural aliases
export const UserRepository = PostgresUserRepository;
export const PostgresUserAdapter = PostgresUserRepository;
