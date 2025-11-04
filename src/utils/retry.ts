/**
 * Retry utility for handling transient failures
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  exponentialBackoff?: boolean
  retryableStatuses?: number[]
  onRetry?: (attempt: number, error: any) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  exponentialBackoff: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  onRetry: () => {}
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt: number, options: Required<RetryOptions>): number {
  if (!options.exponentialBackoff) {
    return options.initialDelayMs
  }

  const exponentialDelay = options.initialDelayMs * Math.pow(2, attempt - 1)
  return Math.min(exponentialDelay, options.maxDelayMs)
}

/**
 * Check if error is retryable based on HTTP status
 */
function isRetryableError(error: any, options: Required<RetryOptions>): boolean {
  // Network errors (fetch failures)
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true
  }

  // HTTP status errors
  if (error.status && options.retryableStatuses.includes(error.status)) {
    return true
  }

  return false
}

/**
 * Retry a fetch request with exponential backoff
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, init)

      // Don't retry 4xx errors (except 408, 429)
      if (response.status >= 400 && response.status < 500) {
        if (!opts.retryableStatuses.includes(response.status)) {
          return response
        }
      }

      // Retry 5xx errors
      if (response.status >= 500 && attempt < opts.maxRetries) {
        lastError = { status: response.status, statusText: response.statusText }
        const delayMs = getRetryDelay(attempt + 1, opts)
        opts.onRetry(attempt + 1, lastError)
        await delay(delayMs)
        continue
      }

      // Success or final attempt
      return response
    } catch (error) {
      lastError = error

      // If not retryable or final attempt, throw
      if (!isRetryableError(error, opts) || attempt >= opts.maxRetries) {
        throw error
      }

      // Retry with backoff
      const delayMs = getRetryDelay(attempt + 1, opts)
      opts.onRetry(attempt + 1, error)
      await delay(delayMs)
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * Retry any async operation
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: Omit<RetryOptions, 'retryableStatuses'> = {}
): Promise<T> {
  const opts = {
    maxRetries: options.maxRetries ?? 3,
    initialDelayMs: options.initialDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 10000,
    exponentialBackoff: options.exponentialBackoff ?? true,
    onRetry: options.onRetry ?? (() => {})
  }

  let lastError: any

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt >= opts.maxRetries) {
        throw error
      }

      const delayMs = getRetryDelay(attempt + 1, opts as Required<RetryOptions>)
      opts.onRetry(attempt + 1, error)
      await delay(delayMs)
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * Circuit breaker pattern to prevent cascading failures
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await operation()

      if (this.state === 'HALF_OPEN') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'OPEN'
    }
  }

  private reset() {
    this.failures = 0
    this.state = 'CLOSED'
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}
