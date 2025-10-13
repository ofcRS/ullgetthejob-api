import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { cvParserService } from './services/cv-parser.service'
import { aiService, AVAILABLE_MODELS } from './services/ai.service'
import { env } from './config/env'

// WebSocket client registry
const wsClients = new Set<any>()

export const app = new Elysia()
  .use(cors({
    origin: (request: Request) => {
      const requestOrigin = request.headers.get('origin')
      if (!requestOrigin) return false
      if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        return true
      }
      if (env.ALLOWED_ORIGINS.includes('*')) return true
      return env.ALLOWED_ORIGINS.includes(requestOrigin)
    },
    credentials: true
  }))

  // Health check
  .get('/api/health', () => ({ 
    status: 'ok', 
    service: 'UllGetTheJob API Enhanced',
    features: ['cv-parsing', 'ai-customization', 'job-fetching', 'websocket']
  }))

  // Get available models
  .get('/api/models', () => ({
    success: true,
    models: AVAILABLE_MODELS
  }))

  // 1. Upload and parse CV with AI
  .post('/api/cv/upload', async ({ body }) => {
    try {
      const file = (body as any).file as File
      
      if (!file) {
        throw new Error('No file provided')
      }

      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        throw new Error('Invalid file type. Please upload PDF or DOCX')
      }

      console.log('Parsing CV with AI...')
      const parsed = await cvParserService.parseCV(file)
      
      return { 
        success: true, 
        cv: parsed 
      }
    } catch (error) {
      console.error('CV upload error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }
  }, {
    body: t.Object({
      file: t.File()
    })
  })

  // 2. Search jobs from Phoenix Core
  .post('/api/jobs/search', async ({ body, set }) => {
    try {
      const { text, area, experience, employment, schedule } = body as {
        text: string
        area?: string
        experience?: string
        employment?: string
        schedule?: string
      }

      console.log('Fetching jobs from Phoenix Core:', { text, area })

      const response = await fetch(`${env.CORE_URL}/api/jobs/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Core-Secret': env.ORCHESTRATOR_SECRET
        },
        body: JSON.stringify({
          text,
          area,
          experience,
          employment,
          schedule
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Phoenix Core error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      return {
        success: true,
        jobs: data.jobs || [],
        total: data.jobs?.length || 0
      }
    } catch (error) {
      console.error('Job search error:', error)
      set.status = 500
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Job search failed',
        jobs: []
      }
    }
  }, {
    body: t.Object({
      text: t.String(),
      area: t.Optional(t.String()),
      experience: t.Optional(t.String()),
      employment: t.Optional(t.String()),
      schedule: t.Optional(t.String())
    })
  })

  // 3. Customize CV and generate cover letter with model selection
  .post('/api/cv/customize', async ({ body, set }) => {
    try {
      const { cv, jobDescription, model } = body as { 
        cv: any
        jobDescription: string
        model?: string
      }

      if (!cv || !jobDescription) {
        set.status = 400
        return { 
          success: false, 
          error: 'Missing CV or job description' 
        }
      }

      console.log(`Customizing CV with model: ${model || 'default'}`)
      
      const customizedCV = await aiService.customizeCV(cv, jobDescription, model)
      
      console.log('Generating cover letter...')
      
      const coverLetter = await aiService.generateCoverLetter(
        customizedCV,
        jobDescription,
        'Company',
        model
      )

      return {
        success: true,
        customizedCV,
        coverLetter,
        modelUsed: model || 'anthropic/claude-3.5-sonnet'
      }
    } catch (error) {
      console.error('Customization error:', error)
      set.status = 500
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Customization failed'
      }
    }
  }, {
    body: t.Object({
      cv: t.Any(),
      jobDescription: t.String(),
      model: t.Optional(t.String())
    })
  })

  // 4. Submit application to HH.ru via Phoenix Core
  .post('/api/application/submit', async ({ body, set }) => {
    try {
      const { jobExternalId, customizedCV, coverLetter } = body as {
        jobExternalId: string
        customizedCV: any
        coverLetter: string
      }

      console.log('Submitting application to Phoenix Core...')

      const response = await fetch(`${env.CORE_URL}/api/applications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Core-Secret': env.ORCHESTRATOR_SECRET
        },
        body: JSON.stringify({
          user_id: 'mvp-demo-user',
          job_external_id: jobExternalId,
          customized_cv: customizedCV,
          cover_letter: coverLetter
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Phoenix Core error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      return {
        success: true,
        result,
        message: 'Application submitted successfully!'
      }
    } catch (error) {
      console.error('Submission error:', error)
      set.status = 500
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed'
      }
    }
  }, {
    body: t.Object({
      jobExternalId: t.String(),
      customizedCV: t.Any(),
      coverLetter: t.String()
    })
  })

  // WebSocket for real-time job updates
  .ws('/ws', {
    open(ws) {
      wsClients.add(ws.raw)
      console.log('WebSocket client connected. Total clients:', wsClients.size)
      
      try {
        ws.send(JSON.stringify({ 
          type: 'connected', 
          message: 'Ready to receive job updates' 
        }))
      } catch (err) {
        console.error('Failed to send welcome message:', err)
      }
    },
    
    message(ws, message) {
      try {
        const data = JSON.parse(String(message)) as { 
          type?: string
          searchParams?: any
        }
        
        if (data.type === 'subscribe' && data.searchParams) {
          // Client wants to subscribe to job updates
          console.log('Client subscribed to job search:', data.searchParams)
          ws.send(JSON.stringify({ 
            type: 'subscribed', 
            searchParams: data.searchParams 
          }))
        } else {
          // Echo for testing
          ws.send(JSON.stringify({ type: 'echo', message }))
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    },
    
    close(ws) {
      wsClients.delete(ws.raw)
      console.log('WebSocket client disconnected. Total clients:', wsClients.size)
    }
  })

  // Endpoint for Phoenix Core to broadcast jobs
  .post('/api/v1/jobs/broadcast', ({ headers, body, set }) => {
    const secret = headers['x-core-secret'] ?? headers['x-orchestrator-secret']
    
    if (!secret || secret !== env.ORCHESTRATOR_SECRET) {
      set.status = 401
      return { error: 'Unauthorized' }
    }

    const data = body as { jobs?: any[]; stats?: any }
    const jobs = data.jobs ?? []
    
    console.log(`Broadcasting ${jobs.length} jobs to ${wsClients.size} clients`)

    let delivered = 0
    for (const client of wsClients) {
      try {
        const payload = JSON.stringify({ 
          type: 'new_jobs', 
          jobs, 
          stats: data.stats 
        })
        client.send(payload)
        delivered++
      } catch (err) {
        console.error('Failed to send to client:', err)
      }
    }
    
    return { ok: true, delivered }
  }, {
    body: t.Object({
      jobs: t.Array(t.Any(), { default: [] }),
      stats: t.Optional(t.Record(t.String(), t.Any()))
    })
  })

  // Error handler
  .onError(({ code, error, set }) => {
    console.error('Server error:', code, error)
    
    if (code === 'VALIDATION') {
      set.status = 400
      return { success: false, error: 'Validation error' }
    }

    set.status = 500
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }
  })