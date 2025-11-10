import { Elysia, t } from 'elysia'
import { aiService } from '../services/ai.service'
import { StorageService } from '../services/storage.service'
import { authMiddleware } from '../middleware/auth'
import { logger } from '../utils/logger'
import type { ParsedCV, CustomizedCV } from '../types'

const storage = new StorageService()

export function registerEnhancedAIRoutes() {
  return new Elysia({ name: 'ai-enhanced-routes' })
    .use(authMiddleware())

    /**
     * POST /api/ai/cv/customize-multistage
     * Multi-stage CV customization with analysis, optimization, and validation
     */
    .post('/api/ai/cv/customize-multistage', async ({ body, set, userId }) => {
      try {
        const { cvId, jobDescription, companyInfo, model } = body as {
          cvId: string
          jobDescription: string
          companyInfo: string
          model?: string
        }

        logger.info('Multi-stage CV customization started', { userId, cvId, model: model || 'default' })

        // Fetch CV from database
        const cv = await storage.getCvById(cvId)
        if (!cv || cv.userId !== userId) {
          set.status = 404
          return { success: false, error: 'CV not found or access denied' }
        }

        // Perform multi-stage customization
        const result = await aiService.customizeCVMultiStage(
          cv as ParsedCV,
          jobDescription,
          companyInfo,
          model
        )

        logger.info('Multi-stage customization completed', {
          userId,
          relevanceScore: result.analysis.relevanceScore,
          qualityScore: result.validation.qualityScore,
          variationsGenerated: result.coverLetterVariations.length
        })

        return {
          success: true,
          result: {
            ...result,
            modelUsed: model || 'anthropic/claude-3.5-sonnet'
          }
        }
      } catch (error) {
        logger.error('Multi-stage customization failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Multi-stage customization failed'
        }
      }
    }, {
      body: t.Object({
        cvId: t.String(),
        jobDescription: t.String({ minLength: 50 }),
        companyInfo: t.String(),
        model: t.Optional(t.String())
      })
    })

    /**
     * POST /api/ai/cover-letter/variations
     * Generate multiple cover letter variations with different styles
     */
    .post('/api/ai/cover-letter/variations', async ({ body, set, userId }) => {
      try {
        const { customizedCV, jobDescription, companyInfo, model } = body as {
          customizedCV: CustomizedCV
          jobDescription: string
          companyInfo: string
          model?: string
        }

        logger.info('Cover letter variations generation started', { userId, model: model || 'default' })

        const variations = await aiService.generateCoverLetterVariations(
          customizedCV,
          jobDescription,
          companyInfo,
          model
        )

        logger.info('Cover letter variations generated', {
          userId,
          count: variations.length,
          styles: variations.map(v => v.style)
        })

        return {
          success: true,
          variations,
          modelUsed: model || 'anthropic/claude-3.5-sonnet'
        }
      } catch (error) {
        logger.error('Cover letter variations generation failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate variations'
        }
      }
    }, {
      body: t.Object({
        customizedCV: t.Object({
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String()),
          email: t.Optional(t.String()),
          phone: t.Optional(t.String()),
          title: t.Optional(t.String()),
          summary: t.Optional(t.String()),
          experience: t.Optional(t.String()),
          education: t.Optional(t.String()),
          skills: t.Optional(t.Array(t.String())),
          projects: t.Optional(t.String()),
          matchedSkills: t.Optional(t.Array(t.String()))
        }),
        jobDescription: t.String({ minLength: 50 }),
        companyInfo: t.String(),
        model: t.Optional(t.String())
      })
    })

    /**
     * POST /api/ai/skills/consensus
     * Extract job skills using consensus from multiple AI models
     */
    .post('/api/ai/skills/consensus', async ({ body, set, userId }) => {
      try {
        const { jobDescription } = body as { jobDescription: string }

        logger.info('Multi-model skills consensus extraction started', { userId })

        const consensusResult = await aiService.extractJobSkillsWithConsensus(jobDescription)

        logger.info('Skills consensus extraction completed', {
          userId,
          confidence: consensusResult.confidence,
          skillsFound: Object.values(consensusResult.consensus).flat().length,
          modelsUsed: consensusResult.modelResponses.length
        })

        return {
          success: true,
          ...consensusResult
        }
      } catch (error) {
        logger.error('Skills consensus extraction failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Skills extraction failed'
        }
      }
    }, {
      body: t.Object({
        jobDescription: t.String({ minLength: 50 })
      })
    })

    /**
     * POST /api/ai/interview/prepare
     * Generate comprehensive interview preparation with STAR responses
     */
    .post('/api/ai/interview/prepare', async ({ body, set, userId }) => {
      try {
        const { cvId, jobDescription, companyInfo, model } = body as {
          cvId: string
          jobDescription: string
          companyInfo: string
          model?: string
        }

        logger.info('Interview preparation started', { userId, cvId })

        // Fetch CV from database
        const cv = await storage.getCvById(cvId)
        if (!cv || cv.userId !== userId) {
          set.status = 404
          return { success: false, error: 'CV not found or access denied' }
        }

        // First customize CV for this job to get better STAR responses
        const customizedCV = await aiService.customizeCV(
          cv as ParsedCV,
          jobDescription,
          model
        )

        // Generate interview prep
        const preparation = await aiService.prepareForInterview(
          customizedCV,
          jobDescription,
          companyInfo,
          model
        )

        logger.info('Interview preparation completed', {
          userId,
          questionsGenerated: preparation.commonQuestions.length +
            preparation.technicalQuestions.length +
            preparation.behavioralQuestions.length
        })

        return {
          success: true,
          preparation,
          modelUsed: model || 'anthropic/claude-3.5-sonnet'
        }
      } catch (error) {
        logger.error('Interview preparation failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Interview preparation failed'
        }
      }
    }, {
      body: t.Object({
        cvId: t.String(),
        jobDescription: t.String({ minLength: 50 }),
        companyInfo: t.String(),
        model: t.Optional(t.String())
      })
    })

    /**
     * POST /api/ai/company/analyze
     * Analyze company culture with red flag detection
     */
    .post('/api/ai/company/analyze', async ({ body, set, userId }) => {
      try {
        const { jobDescription, companyInfo, companyReviews, model } = body as {
          jobDescription: string
          companyInfo: string
          companyReviews?: string
          model?: string
        }

        logger.info('Company culture analysis started', { userId })

        const analysis = await aiService.analyzeCompanyCulture(
          jobDescription,
          companyInfo,
          companyReviews,
          model
        )

        logger.info('Company culture analysis completed', {
          userId,
          overallScore: analysis.overallScore,
          redFlagsFound: analysis.redFlags.length,
          recommendation: analysis.recommendation
        })

        return {
          success: true,
          analysis,
          modelUsed: model || 'anthropic/claude-3.5-sonnet'
        }
      } catch (error) {
        logger.error('Company culture analysis failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Company analysis failed'
        }
      }
    }, {
      body: t.Object({
        jobDescription: t.String({ minLength: 50 }),
        companyInfo: t.String(),
        companyReviews: t.Optional(t.String()),
        model: t.Optional(t.String())
      })
    })

    /**
     * POST /api/ai/suggestions/realtime
     * Generate real-time AI suggestions for job application
     */
    .post('/api/ai/suggestions/realtime', async ({ body, set, userId }) => {
      try {
        const { cvId, job, matchScore } = body as {
          cvId: string
          job: {
            title: string
            description: string
            company?: string
          }
          matchScore: number
        }

        logger.info('Real-time suggestions generation started', { userId, cvId, matchScore })

        // Fetch CV from database
        const cv = await storage.getCvById(cvId)
        if (!cv || cv.userId !== userId) {
          set.status = 404
          return { success: false, error: 'CV not found or access denied' }
        }

        const suggestions = await aiService.generateRealtimeSuggestions(
          cv as ParsedCV,
          job,
          matchScore
        )

        logger.info('Real-time suggestions generated', {
          userId,
          suggestionsCount: suggestions.suggestions.length,
          highPriority: suggestions.suggestions.filter(s => s.priority === 'high').length
        })

        return {
          success: true,
          suggestions
        }
      } catch (error) {
        logger.error('Real-time suggestions generation failed', error as Error, { userId })
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Suggestions generation failed'
        }
      }
    }, {
      body: t.Object({
        cvId: t.String(),
        job: t.Object({
          title: t.String(),
          description: t.String(),
          company: t.Optional(t.String())
        }),
        matchScore: t.Number({ minimum: 0, maximum: 100 })
      })
    })

    /**
     * GET /api/ai/capabilities
     * Get information about available AI capabilities
     */
    .get('/api/ai/capabilities', async ({ userId }) => {
      logger.debug('AI capabilities requested', { userId })

      return {
        success: true,
        capabilities: {
          multiStageCustomization: {
            name: 'Multi-Stage CV Customization',
            description: 'Three-stage pipeline: analysis, optimization, and validation',
            endpoint: '/api/ai/cv/customize-multistage',
            features: [
              'CV analysis against job requirements',
              'Optimization with STAR method',
              'Quality validation',
              'Multiple cover letter variations'
            ]
          },
          coverLetterVariations: {
            name: 'Cover Letter Variations',
            description: 'Generate 5 different cover letter styles',
            endpoint: '/api/ai/cover-letter/variations',
            styles: ['professional', 'enthusiastic', 'technical', 'concise', 'creative']
          },
          skillsConsensus: {
            name: 'Multi-Model Skills Extraction',
            description: 'Extract job skills using consensus from 3 AI models',
            endpoint: '/api/ai/skills/consensus',
            models: ['Claude 3.5 Sonnet', 'GPT-4o', 'Gemini Pro 1.5']
          },
          interviewPreparation: {
            name: 'Interview Preparation Assistant',
            description: 'Generate STAR responses and interview questions',
            endpoint: '/api/ai/interview/prepare',
            includes: [
              'Common interview questions with STAR responses',
              'Technical questions with detailed answers',
              'Behavioral questions',
              'Company-specific questions to ask'
            ]
          },
          cultureAnalysis: {
            name: 'Company Culture Analyzer',
            description: 'Analyze company culture with red flag detection',
            endpoint: '/api/ai/company/analyze',
            categories: [
              'Work-life balance',
              'Management quality',
              'Compensation fairness',
              'Growth opportunities',
              'Company values',
              'Stability'
            ]
          },
          realtimeSuggestions: {
            name: 'Real-time AI Suggestions',
            description: 'Get actionable suggestions for job applications',
            endpoint: '/api/ai/suggestions/realtime',
            suggestionTypes: [
              'CV improvements',
              'Cover letter tips',
              'Skills to highlight',
              'Application timing',
              'Follow-up strategies'
            ]
          }
        }
      }
    })
}
