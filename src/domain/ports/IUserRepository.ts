import { User } from '../models/User';

/**
 * IUserRepository Port
 * Abstracts persistence operations for users.
 */
export interface IUserRepository {
  /**
   * Fetch user by unique user ID
   * @param userId - Unique user identifier
   */
  getUserById(userId: string): Promise<User | null>;
}
