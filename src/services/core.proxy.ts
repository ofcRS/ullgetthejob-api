/**
 * Core service proxy with circuit breaker and request signing
 */

import { env } from '../config/env'
import { CircuitBreaker, fetchWithRetry, type RetryOptions } from '../utils/retry'
import { signRequest, generateRequestId } from '../utils/crypto'
import { logger } from '../utils/logger'

/**
 * Circuit breaker for core service
 * - Opens after 5 consecutive failures
 * - Stays open for 30 seconds before trying again
 */
const coreCircuitBreaker = new CircuitBreaker(
  5,      // threshold: open after 5 failures
  60000,  // timeout: not used in current implementation
  30000   // resetTimeout: try again after 30 seconds
)

export interface CoreProxyOptions {
  path: string
  method?: string
  body?: any
  token?: string
  sessionId?: string
  retryOptions?: RetryOptions
  skipSigning?: boolean
}

/**
 * Proxy requests to Core service with circuit breaker, retry, and signing
 */
export async function proxyToCore(options: CoreProxyOptions): Promise<Response> {
  const {
    path,
    method = 'GET',
    body,
    token,
    sessionId,
    retryOptions = {},
    skipSigning = false
  } = options

  // Check circuit breaker state before making request
  const breakerState = coreCircuitBreaker.getState()
  if (breakerState.state === 'OPEN') {
    logger.error('Circuit breaker is OPEN - Core service unavailable', undefined, {
      state: breakerState.state,
      failures: breakerState.failures,
      path
    })
    throw new Error('Core service is temporarily unavailable')
  }

  const url = `${env.CORE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Core-Secret': env.ORCHESTRATOR_SECRET,
    'X-Request-ID': generateRequestId()
  }

  // Add authentication headers if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  }

  // Sign request body for write operations
  if (body && !skipSigning) {
    const signature = signRequest(body)
    headers['X-Signature'] = signature
  }

  const requestInit: RequestInit = {
    method,
    headers
  }

  if (body) {
    requestInit.body = JSON.stringify(body)
  }

  logger.debug('Proxying request to Core', {
    path,
    method,
    hasToken: !!token,
    hasBody: !!body,
    signed: !!body && !skipSigning
  })

  try {
    // Execute request through circuit breaker
    const response = await coreCircuitBreaker.execute(async () => {
      return await fetchWithRetry(url, requestInit, {
        maxRetries: 2,
        retryableStatuses: [502, 503, 504],
        ...retryOptions,
        onRetry: (attempt, error) => {
          logger.warn('Retrying Core request', {
            attempt,
            path,
            error: error?.message || error
          })
          retryOptions.onRetry?.(attempt, error)
        }
      })
    })

    logger.debug('Core request completed', {
      path,
      status: response.status,
      ok: response.ok
    })

    return response
  } catch (error) {
    logger.error('Core request failed', error as Error, { path, method })
    throw error
  }
}

/**
 * Get circuit breaker state
 */
export function getCircuitBreakerState() {
  return coreCircuitBreaker.getState()
}
