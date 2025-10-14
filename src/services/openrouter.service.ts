import { env } from '../config/env'

export class OpenRouterService {
  async getAvailableModels() {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}` }
    })
    if (!response.ok) {
      return []
    }
    const data = await response.json()

    return (data.data || [])
      .filter((m: any) =>
        m.id?.includes('claude') ||
        m.id?.includes('gpt') ||
        m.id?.includes('gemini') ||
        m.id?.includes('llama')
      )
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        provider: String(m.id).split('/')[0],
        description: m.description,
        pricing: m.pricing
      }))
  }
}


