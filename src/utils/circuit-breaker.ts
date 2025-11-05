/**
 * Circuit Breaker pattern implementation for external service calls
 *
 * Prevents cascading failures by stopping requests to failing services,
 * allowing them time to recover. The circuit has three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 */

import { logger } from './logger'

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number // Number of failures before opening circuit
  successThreshold: number // Number of successes in HALF_OPEN before closing
  timeout: number // Time in ms to wait before attempting HALF_OPEN
  resetTimeout?: number // Time in ms before resetting failure count
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private nextAttempt: number = Date.now()
  private lastFailureTime: number = 0

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.warn(`Circuit breaker ${this.name} is OPEN`, {
          state: this.state,
          failureCount: this.failureCount,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        })
        throw new CircuitBreakerError(
          `Circuit breaker for ${this.name} is OPEN. Service unavailable.`,
          CircuitState.OPEN
        )
      }

      // Transition to HALF_OPEN to test service
      this.state = CircuitState.HALF_OPEN
      this.successCount = 0
      logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`)
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      logger.debug(`Circuit breaker ${this.name} success in HALF_OPEN`, {
        successCount: this.successCount,
        threshold: this.options.successThreshold
      })

      if (this.successCount >= this.options.successThreshold) {
        this.close()
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success if enough time has passed
      if (this.options.resetTimeout && this.lastFailureTime) {
        if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
          this.failureCount = 0
          logger.debug(`Circuit breaker ${this.name} failure count reset`)
        }
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    logger.warn(`Circuit breaker ${this.name} recorded failure`, {
      state: this.state,
      failureCount: this.failureCount,
      threshold: this.options.failureThreshold
    })

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure during HALF_OPEN immediately reopens circuit
      this.open()
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.open()
    }
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN
    this.nextAttempt = Date.now() + this.options.timeout

    logger.error(
      `Circuit breaker ${this.name} OPENED`,
      new Error('Circuit opened due to failures'),
      {
        failureCount: this.failureCount,
        nextAttemptAt: new Date(this.nextAttempt).toISOString()
      }
    )
  }

  /**
   * Close the circuit (service recovered)
   */
  private close(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0

    logger.info(`Circuit breaker ${this.name} CLOSED (service recovered)`)
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Get circuit statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
      isAvailable: this.state !== CircuitState.OPEN || Date.now() >= this.nextAttempt
    }
  }

  /**
   * Force reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.nextAttempt = Date.now()
    logger.info(`Circuit breaker ${this.name} manually reset`)
  }
}

/**
 * Circuit breaker registry for managing multiple breakers
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>()

  /**
   * Get or create a circuit breaker
   */
  get(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 1 minute
        resetTimeout: 120000 // 2 minutes
      }
      this.breakers.set(
        name,
        new CircuitBreaker(name, options || defaultOptions)
      )
    }
    return this.breakers.get(name)!
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return this.breakers
  }

  /**
   * Get statistics for all breakers
   */
  getAllStats() {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStats())
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset())
    logger.info('All circuit breakers reset')
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry()
