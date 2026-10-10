import { ITimeProvider } from '../../domain/ports/ITimeProvider';

/**
 * SystemTimeProvider Adapter
 * Concrete implementation of ITimeProvider that wraps native system clock.
 */
export class SystemTimeProvider implements ITimeProvider {
  getCurrentTime(): Date {
    return new Date();
  }
}

// Architectural alias
export const SystemTimeAdapter = SystemTimeProvider;
