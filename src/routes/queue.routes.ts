import { Elysia, t } from 'elysia'
import { QueueService } from '../services/queue.service'
import { db } from '../db/client'
import { authMiddleware } from '../middleware/auth'

export function registerQueueRoutes() {
  const queueService = new QueueService(db)

  return new Elysia({ name: 'queue-routes' })
    .use(authMiddleware())

    // Add jobs to queue
    .post('/api/queue/add', async ({ body, userId, set }) => {
      const { cvId, jobIds } = body

      try {
        const result = await queueService.addJobsToQueue(userId, cvId, jobIds)
        return {
          success: true,
          workflowId: result.workflowId,
          queuedCount: result.queuedCount,
          message: `${result.queuedCount} jobs added to queue`
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add jobs to queue'
        }
      }
    }, {
      body: t.Object({
        cvId: t.String(),
        jobIds: t.Array(t.String())
      })
    })

    // Get user's queue
    .get('/api/queue', async ({ query, userId, set }) => {
      const { workflowId, status } = query

      try {
        const queue = await queueService.getQueue(userId, { workflowId, status })
        return {
          success: true,
          items: queue,
          total: queue.length
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch queue'
        }
      }
    }, {
      query: t.Object({
        workflowId: t.Optional(t.String()),
        status: t.Optional(t.String())
      })
    })

    // Remove from queue
    .delete('/api/queue/:id', async ({ params, set }) => {
      try {
        await queueService.removeFromQueue(params.id)
        return {
          success: true,
          message: 'Item removed from queue'
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove item'
        }
      }
    })

    // Batch customize all jobs in queue
    .post('/api/queue/batch-customize', async ({ body, userId, set }) => {
      const { workflowId } = body

      try {
        const result = await queueService.startBatchCustomize(workflowId, userId)
        return {
          success: true,
          workflowId: result.workflowId,
          jobCount: result.jobCount,
          message: 'Batch customization started'
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start batch customization'
        }
      }
    }, {
      body: t.Object({
        workflowId: t.String()
      })
    })

    // Start auto-apply workflow
    .post('/api/queue/start-workflow', async ({ body, userId, set }) => {
      const { workflowId } = body

      try {
        const result = await queueService.startAutoApply(workflowId, userId)
        return {
          success: true,
          workflowId: result.workflowId,
          message: 'Auto-apply workflow started',
          estimatedCompletion: result.estimatedCompletion
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start workflow'
        }
      }
    }, {
      body: t.Object({
        workflowId: t.String()
      })
    })
}
