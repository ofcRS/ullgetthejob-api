/**
 * Cryptographic utilities for request signing and validation
 */

import crypto from 'crypto'
import { env } from '../config/env'

/**
 * Sign a request payload using HMAC-SHA256
 * @param payload The data to sign
 * @returns The signature as a hex string
 */
export function signRequest(payload: any): string {
  const secret = env.ORCHESTRATOR_SECRET
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)

  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
}

/**
 * Verify a request signature
 * @param payload The data that was signed
 * @param signature The signature to verify
 * @returns True if signature is valid
 */
export function verifyRequestSignature(payload: any, signature: string): boolean {
  const expectedSignature = signRequest(payload)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Generate a unique request ID
 * @returns A UUID v4 request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

/**
 * Hash a string using SHA-256 (for cache keys)
 * @param input The string to hash
 * @returns The hash as a hex string
 */
export function hashString(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex')
}
