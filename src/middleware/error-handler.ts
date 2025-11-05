import { Elysia } from 'elysia'
import { logger } from '../utils/logger'
import { env } from '../config/env'

interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: any
  field?: string
}

export function errorHandler() {
  return new Elysia({ name: 'error-handler' })
    .onError(({ code, error, set, request }) => {
      const path = new URL(request.url).pathname
      const method = request.method

      // Log error with context
      logger.error(`${method} ${path} - ${code}`, error, {
        code,
        method,
        path,
        url: request.url
      })

      // Handle validation errors with detailed information
      if (code === 'VALIDATION') {
        set.status = 400

        const validationError = error as any
        const response: ErrorResponse = {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR'
        }

        // Extract detailed validation information if available
        if (validationError.all) {
          response.details = validationError.all
        } else if (validationError.message) {
          response.error = validationError.message
        }

        if (validationError.path) {
          response.field = validationError.path
        }

        return response
      }

      // Handle NOT_FOUND errors
      if (code === 'NOT_FOUND') {
        set.status = 404
        return {
          success: false,
          error: 'Resource not found',
          code: 'NOT_FOUND'
        }
      }

      // Handle PARSE errors (invalid JSON, etc.)
      if (code === 'PARSE') {
        set.status = 400
        return {
          success: false,
          error: 'Invalid request format',
          code: 'PARSE_ERROR',
          details: env.NODE_ENV === 'development' ? error.message : undefined
        }
      }

      // Handle UNKNOWN and other errors
      set.status = 500

      // In production, don't expose internal error details
      const errorMessage = env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (error instanceof Error ? error.message : 'Unknown error')

      return {
        success: false,
        error: errorMessage,
        code: 'INTERNAL_ERROR',
        details: env.NODE_ENV === 'development' ? {
          type: code,
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      }
    })
}


