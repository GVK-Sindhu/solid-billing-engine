/**
 * ITimeProvider Port
 * Provides deterministic time for the application, decoupling domain logic from the system clock.
 */
export interface ITimeProvider {
  /**
   * Returns the current date/time as dictated by the provider
   * @returns Date object representing "now"
   */
  getCurrentTime(): Date;
}
