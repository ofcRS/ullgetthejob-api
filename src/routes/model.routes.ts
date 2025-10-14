import { Elysia } from 'elysia'
import { OpenRouterService } from '../services/openrouter.service'

const openrouter = new OpenRouterService()

export function registerModelRoutes() {
  return new Elysia({ name: 'model-routes' })
    .get('/api/models', async () => {
      const models = await openrouter.getAvailableModels()
      return { success: true, models }
    })
}


