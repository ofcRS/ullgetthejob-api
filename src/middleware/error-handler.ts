import { Elysia } from 'elysia'

export function errorHandler() {
  return new Elysia({ name: 'error-handler' })
    .onError(({ code, error, set, request }) => {
      const path = request.url
      console.error(`[Error] ${code} on ${path}:`, error)

      if (code === 'VALIDATION') {
        set.status = 400
        return { success: false, error: 'Validation error' }
      }

      set.status = 500
      return { success: false, error: error instanceof Error ? error.message : 'Internal server error' }
    })
}


