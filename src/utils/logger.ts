/**
 * Secure logging utility with PII redaction
 */

import { env } from '../config/env'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

/**
 * Fields that contain PII and should be redacted
 */
const PII_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'sessionId',
  'ssn',
  'creditCard',
  'address',
  'firstName',
  'lastName',
  'fullName',
  'ipAddress',
  'userAgent'
]

/**
 * Patterns that might contain PII
 */
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g // Credit card
]

/**
 * Redact PII from a value
 */
function redactValue(value: any): any {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    let redacted = value

    // Redact patterns
    for (const pattern of PII_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]')
    }

    // If string looks like a token (long alphanumeric), redact middle
    if (redacted.length > 20 && /^[A-Za-z0-9_-]+$/.test(redacted)) {
      const start = redacted.slice(0, 4)
      const end = redacted.slice(-4)
      redacted = `${start}...${end}`
    }

    return redacted
  }

  if (Array.isArray(value)) {
    return value.map(redactValue)
  }

  if (typeof value === 'object') {
    return redactObject(value)
  }

  return value
}

/**
 * Redact PII fields from an object
 */
function redactObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const redacted: any = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    // Check if key is a PII field
    const isPII = PII_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))

    if (isPII) {
      redacted[key] = '[REDACTED]'
    } else if (Array.isArray(value)) {
      redacted[key] = value.map(redactValue)
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value)
    } else {
      redacted[key] = redactValue(value)
    }
  }

  return redacted
}

/**
 * Format log message with timestamp and level
 */
function formatLogMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const levelUpper = level.toUpperCase().padEnd(5)

  let formatted = `[${timestamp}] ${levelUpper} ${message}`

  if (context && Object.keys(context).length > 0) {
    const redactedContext = env.NODE_ENV === 'production' ? redactObject(context) : context
    formatted += ` ${JSON.stringify(redactedContext)}`
  }

  return formatted
}

/**
 * Logger class with PII redaction
 */
class Logger {
  constructor(private minLevel: LogLevel = 'info') {}

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentIndex = levels.indexOf(this.minLevel)
    const requestedIndex = levels.indexOf(level)
    return requestedIndex >= currentIndex
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.debug(formatLogMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(formatLogMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(formatLogMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: env.NODE_ENV === 'development' ? error.stack : undefined
        } : error
      }
      console.error(formatLogMessage('error', message, errorContext))
    }
  }

  /**
   * Log HTTP request
   */
  httpRequest(method: string, path: string, statusCode: number, durationMs: number, context?: LogContext) {
    const message = `${method} ${path} ${statusCode} ${durationMs}ms`
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

    if (level === 'error') {
      this.error(message, undefined, context)
    } else if (level === 'warn') {
      this.warn(message, context)
    } else {
      this.info(message, context)
    }
  }

  /**
   * Log database query
   */
  dbQuery(query: string, durationMs: number, error?: Error) {
    const message = `DB Query: ${durationMs}ms`

    if (error) {
      this.error(message, error, { query })
    } else if (durationMs > 1000) {
      this.warn(message, { query, slow: true })
    } else {
      this.debug(message, { query })
    }
  }

  /**
   * Log AI API call
   */
  aiCall(model: string, operation: string, durationMs: number, tokensUsed?: number, error?: Error) {
    const message = `AI Call: ${model} ${operation} ${durationMs}ms`
    const context = { model, operation, tokensUsed }

    if (error) {
      this.error(message, error, context)
    } else {
      this.info(message, context)
    }
  }
}

// Create singleton logger instance
const minLevel = env.NODE_ENV === 'development' ? 'debug' : 'info'
export const logger = new Logger(minLevel)

// Export utility functions
export { redactObject, redactValue }
