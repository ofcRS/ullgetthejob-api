import { Elysia } from 'elysia'

const CORE_URL = process.env.CORE_URL || 'http://localhost:4000'

export function registerAuthRoutes() {
  return new Elysia({ name: 'auth-routes' })
    .get('/api/auth/hh/login', async () => {
      const res = await fetch(`${CORE_URL}/auth/hh/redirect`)
      const data = await res.json()
      return data
    })
    .get('/api/auth/hh/callback', async ({ query }) => {
      const code = (query as any)?.code
      if (!code) return { success: false, error: 'Missing code' }
      const res = await fetch(`${CORE_URL}/auth/hh/callback?code=${encodeURIComponent(code)}`)
      return await res.json()
    })
    .get('/api/auth/hh/status', async () => {
      // MVP: no real user auth; return false
      return { connected: false }
    })
    .get('/api/hh/resumes', async () => {
      const res = await fetch(`${CORE_URL}/api/hh/resumes`)
      return await res.json()
    })
    .get('/api/hh/resumes/:id', async ({ params }) => {
      const id = (params as any).id
      const res = await fetch(`${CORE_URL}/api/hh/resumes/${id}`)
      return await res.json()
    })
}


