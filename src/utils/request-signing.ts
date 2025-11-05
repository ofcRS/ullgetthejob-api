/**
 * HMAC request signing for secure inter-service communication
 *
 * Prevents request tampering and ensures requests come from authorized services.
 * Uses HMAC-SHA256 to sign request payloads.
 */

import crypto from 'node:crypto'
import { env } from '../config/env'

/**
 * Generate HMAC signature for request payload
 */
export function signRequest(payload: string | object, timestamp: number = Date.now()): string {
  const secret = env.ORCHESTRATOR_SECRET
  if (!secret) {
    throw new Error('ORCHESTRATOR_SECRET is required for request signing')
  }

  const data = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const message = `${timestamp}:${data}`

  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
}

/**
 * Verify HMAC signature for incoming request
 */
export function verifyRequest(
  payload: string | object,
  signature: string,
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; reason?: string } {
  const secret = env.ORCHESTRATOR_SECRET
  if (!secret) {
    return { valid: false, reason: 'missing_secret' }
  }

  // Check timestamp to prevent replay attacks
  const now = Date.now()
  if (timestamp > now + 60000) { // Allow 1 minute clock skew forward
    return { valid: false, reason: 'timestamp_future' }
  }
  if (now - timestamp > maxAgeMs) {
    return { valid: false, reason: 'timestamp_expired' }
  }

  // Verify signature
  const expected = signRequest(payload, timestamp)
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )

  return valid ? { valid: true } : { valid: false, reason: 'invalid_signature' }
}

/**
 * Generate signed request headers for Core API calls
 */
export function createSignedHeaders(payload: object | string): Record<string, string> {
  const timestamp = Date.now()
  const signature = signRequest(payload, timestamp)

  return {
    'X-Request-Signature': signature,
    'X-Request-Timestamp': timestamp.toString(),
    'X-Core-Secret': env.ORCHESTRATOR_SECRET
  }
}

/**
 * Middleware to verify incoming signed requests
 */
export function verifySignedRequest(headers: Record<string, string | undefined>, body: any) {
  const signature = headers['x-request-signature']
  const timestamp = headers['x-request-timestamp']

  if (!signature || !timestamp) {
    return { valid: false, reason: 'missing_signature_or_timestamp' }
  }

  const timestampNum = parseInt(timestamp, 10)
  if (isNaN(timestampNum)) {
    return { valid: false, reason: 'invalid_timestamp' }
  }

  return verifyRequest(body, signature, timestampNum)
}
