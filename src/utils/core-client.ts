/**
 * Secure Core service client with circuit breaker and request signing
 *
 * All communication with Core service should go through this client
 * to ensure proper security measures and resilience.
 */

import { env } from '../config/env'
import { circuitBreakerRegistry } from './circuit-breaker'
import { createSignedHeaders } from './request-signing'
import { fetchWithRetry, type RetryOptions } from './retry'
import { logger } from './logger'

const CORE_CIRCUIT_BREAKER = 'core-service'

export interface CoreRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  sessionId?: string
  body?: any
  retryOptions?: Partial<RetryOptions>
  skipCircuitBreaker?: boolean
  skipSigning?: boolean
}

/**
 * Make a secure request to Core service with circuit breaker and signing
 */
export async function coreRequest<T = any>(
  path: string,
  options: CoreRequestOptions = {}
): Promise<Response> {
  const {
    method = 'GET',
    sessionId,
    body,
    retryOptions,
    skipCircuitBreaker = false,
    skipSigning = false
  } = options

  const url = `${env.CORE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Core-Secret': env.ORCHESTRATOR_SECRET
  }

  // Add session ID if provided
  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  }

  // Add request signing for POST/PUT/PATCH with body
  if (!skipSigning && body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    const signedHeaders = createSignedHeaders(body)
    Object.assign(headers, signedHeaders)
  }

  const fetchOptions: RequestInit = {
    method,
    headers
  }

  if (body) {
    fetchOptions.body = JSON.stringify(body)
  }

  // Execute with circuit breaker protection
  const circuitBreaker = circuitBreakerRegistry.get(CORE_CIRCUIT_BREAKER, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    resetTimeout: 120000 // 2 minutes
  })

  const executeRequest = async () => {
    logger.debug('Core request', {
      method,
      path,
      hasBody: !!body,
      hasSession: !!sessionId
    })

    return await fetchWithRetry(url, fetchOptions, {
      maxRetries: retryOptions?.maxRetries ?? 3,
      retryableStatuses: retryOptions?.retryableStatuses ?? [502, 503, 504],
      onRetry: (attempt, error) => {
        logger.warn('Retrying Core request', {
          attempt,
          path,
          error: error.message
        })
        retryOptions?.onRetry?.(attempt, error)
      }
    })
  }

  if (skipCircuitBreaker) {
    return await executeRequest()
  }

  return await circuitBreaker.execute(executeRequest)
}

/**
 * Convenience methods for common HTTP verbs
 */
export const coreClient = {
  get: async (path: string, options: Omit<CoreRequestOptions, 'method'> = {}) => {
    return coreRequest(path, { ...options, method: 'GET' })
  },

  post: async (path: string, body: any, options: Omit<CoreRequestOptions, 'method' | 'body'> = {}) => {
    return coreRequest(path, { ...options, method: 'POST', body })
  },

  put: async (path: string, body: any, options: Omit<CoreRequestOptions, 'method' | 'body'> = {}) => {
    return coreRequest(path, { ...options, method: 'PUT', body })
  },

  patch: async (path: string, body: any, options: Omit<CoreRequestOptions, 'method' | 'body'> = {}) => {
    return coreRequest(path, { ...options, method: 'PATCH', body })
  },

  delete: async (path: string, options: Omit<CoreRequestOptions, 'method'> = {}) => {
    return coreRequest(path, { ...options, method: 'DELETE' })
  }
}

/**
 * Get Core service health status
 */
export async function getCoreHealth() {
  try {
    const response = await coreRequest('/health', {
      skipCircuitBreaker: true,
      retryOptions: { maxRetries: 1 }
    })
    return {
      healthy: response.ok,
      status: response.status
    }
  } catch (error) {
    logger.error('Core health check failed', error as Error)
    return {
      healthy: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get circuit breaker statistics
 */
export function getCoreCircuitBreakerStats() {
  const breaker = circuitBreakerRegistry.get(CORE_CIRCUIT_BREAKER)
  return breaker.getStats()
}
