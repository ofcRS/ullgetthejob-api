import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { EmbeddingService } from '../../src/services/embedding.service'
import type { ParsedCV } from '../../src/types'

describe('Embedding Service', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService()
  })

  describe('prepareCVText', () => {
    it('should format CV text correctly', () => {
      const cv: ParsedCV = {
        title: 'Senior React Developer',
        summary: 'Experienced developer with 5 years',
        skills: ['React', 'TypeScript', 'Node.js'],
        experience: 'Built scalable applications...',
        education: 'BS Computer Science',
        fullText: ''
      }

      // Access private method through any cast for testing
      const text = (service as any).prepareCVText(cv)

      expect(text).toContain('Professional Title: Senior React Developer')
      expect(text).toContain('Summary: Experienced developer with 5 years')
      expect(text).toContain('Skills: React, TypeScript, Node.js')
      expect(text).toContain('Experience: Built scalable applications')
      expect(text).toContain('Education: BS Computer Science')
    })

    it('should handle missing fields gracefully', () => {
      const cv: ParsedCV = {
        title: 'Developer',
        fullText: ''
      }

      const text = (service as any).prepareCVText(cv)

      expect(text).toContain('Professional Title: Developer')
      expect(text).not.toContain('Summary:')
      expect(text).not.toContain('Skills:')
    })
  })

  describe('prepareJobText', () => {
    it('should format job text correctly', () => {
      const job = {
        title: 'Frontend Engineer',
        company: 'Tech Corp',
        skills: ['React', 'TypeScript'],
        description: 'Looking for experienced developer...',
        salary: '$100k-$150k'
      }

      const text = (service as any).prepareJobText(job)

      expect(text).toContain('Position: Frontend Engineer')
      expect(text).toContain('Company: Tech Corp')
      expect(text).toContain('Required Skills: React, TypeScript')
      expect(text).toContain('Description: Looking for experienced developer')
      expect(text).toContain('Salary: $100k-$150k')
    })
  })

  describe('cosineSimilarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const vectorA = [1, 2, 3, 4]
      const vectorB = [1, 2, 3, 4]

      const similarity = service.cosineSimilarity(vectorA, vectorB)

      expect(similarity).toBe(1) // Identical vectors = 1.0
    })

    it('should calculate similarity for orthogonal vectors', () => {
      const vectorA = [1, 0, 0]
      const vectorB = [0, 1, 0]

      const similarity = service.cosineSimilarity(vectorA, vectorB)

      expect(similarity).toBe(0) // Orthogonal vectors = 0.0
    })

    it('should calculate similarity for opposite vectors', () => {
      const vectorA = [1, 0, 0]
      const vectorB = [-1, 0, 0]

      const similarity = service.cosineSimilarity(vectorA, vectorB)

      expect(similarity).toBe(-1) // Opposite vectors = -1.0
    })

    it('should calculate similarity for similar vectors', () => {
      const vectorA = [1, 2, 3]
      const vectorB = [2, 4, 6] // 2x vectorA

      const similarity = service.cosineSimilarity(vectorA, vectorB)

      expect(similarity).toBeCloseTo(1, 5) // Same direction = ~1.0
    })

    it('should throw error for mismatched dimensions', () => {
      const vectorA = [1, 2, 3]
      const vectorB = [1, 2]

      expect(() => service.cosineSimilarity(vectorA, vectorB)).toThrow(
        'Embeddings must have same dimensions'
      )
    })

    it('should handle zero vectors', () => {
      const vectorA = [0, 0, 0]
      const vectorB = [1, 2, 3]

      const similarity = service.cosineSimilarity(vectorA, vectorB)

      expect(similarity).toBe(0) // Zero vector = 0 similarity
    })
  })

  // Note: Testing actual API calls requires mocking or integration tests
  describe('generateCVEmbedding (mocked)', () => {
    it('should generate embeddings for CV', async () => {
      // Mock fetch to return a fixed embedding
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => i / 1536)

      const originalFetch = global.fetch
      global.fetch = mock(async () => {
        return {
          ok: true,
          json: async () => ({
            data: [{ embedding: mockEmbedding }],
            usage: { prompt_tokens: 100, total_tokens: 100 }
          })
        }
      }) as any

      const cv: ParsedCV = {
        title: 'Developer',
        summary: 'Experienced professional',
        skills: ['JavaScript'],
        fullText: ''
      }

      const embedding = await service.generateCVEmbedding(cv)

      expect(embedding).toHaveLength(1536)
      expect(embedding).toEqual(mockEmbedding)

      // Restore original fetch
      global.fetch = originalFetch
    })

    it('should throw error when API key is not configured', async () => {
      // Create service with no API key
      const originalKey = process.env.OPENAI_API_KEY
      delete process.env.OPENAI_API_KEY

      const serviceNoKey = new EmbeddingService()
      const cv: ParsedCV = {
        title: 'Developer',
        fullText: ''
      }

      await expect(serviceNoKey.generateCVEmbedding(cv)).rejects.toThrow(
        'OPENAI_API_KEY not configured'
      )

      // Restore
      process.env.OPENAI_API_KEY = originalKey
    })
  })
})
