import { Elysia, t } from 'elysia'
import { authService } from '../services/auth.service'

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/register', async ({ body }) => {
    const result = await authService.register(body.email, body.password)
    return { success: true, ...result }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })
  .post('/login', async ({ body }) => {
    const result = await authService.login(body.email, body.password)
    return { success: true, ...result }
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  })
