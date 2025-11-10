# 🚀 Feature Implementation Plan - Embedding-Based Job Matching

**Feature:** Semantic Job Matching with Vector Embeddings
**Priority:** HIGH
**Estimated Time:** 6-10 hours
**Expected Impact:** 40-50% improvement in match quality
**Complexity:** Medium

---

## 📋 Executive Summary

### Current State (Basic Keyword Matching)

**Location:** `src/services/queue.service.ts:228-240`

```typescript
async calculateMatchScore(cv: ParsedCV, job: JobItem): Promise<number> {
  const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
  const jobSkills = new Set((job.skills || []).map(s => s.toLowerCase()))

  if (jobSkills.size === 0) return 0

  let matches = 0
  for (const skill of jobSkills) {
    if (cvSkills.has(skill)) matches++
  }

  return Math.round((matches / jobSkills.size) * 100)
}
```

**Problems:**
- ❌ Misses semantic similarity ("React" ≠ "front-end framework")
- ❌ No context understanding (experience level, projects)
- ❌ Binary matching (either matches or doesn't)
- ❌ Ignores skill proficiency and relevance
- ❌ Cannot rank jobs effectively

**Example Failure Case:**
- CV: "Experienced React developer with 5 years building SPAs"
- Job: "Looking for front-end engineer skilled in modern JavaScript frameworks"
- **Current Score:** 0% (no exact keyword matches)
- **Should Be:** 85%+ (highly relevant)

---

## 🎯 Proposed Solution: Hybrid Semantic Matching

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Matching Service                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │ CV Embedding     │      │ Job Embedding    │           │
│  │ (1536 dim)       │      │ (1536 dim)       │           │
│  └────────┬─────────┘      └────────┬─────────┘           │
│           │                         │                      │
│           └─────────┬───────────────┘                      │
│                     ▼                                       │
│           ┌──────────────────┐                             │
│           │ Cosine Similarity│                             │
│           │    (60% weight)  │                             │
│           └────────┬─────────┘                             │
│                    │                                        │
│  ┌─────────────────┼─────────────────┐                     │
│  │                 │                 │                     │
│  ▼                 ▼                 ▼                     │
│ ┌────────┐  ┌──────────┐  ┌──────────────┐               │
│ │ Skill  │  │Experience│  │   Location   │               │
│ │ Match  │  │  Match   │  │    Match     │               │
│ │ (30%)  │  │  (10%)   │  │   (bonus)    │               │
│ └────┬───┘  └─────┬────┘  └──────┬───────┘               │
│      │            │               │                        │
│      └────────────┴───────────────┘                        │
│                   │                                         │
│                   ▼                                         │
│         ┌──────────────────┐                               │
│         │  Final Score     │                               │
│         │    (0-100)       │                               │
│         └──────────────────┘                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Benefits

1. **Semantic Understanding**
   - Matches "React developer" with "modern JavaScript framework"
   - Understands "5 years experience" relates to "senior level"
   - Recognizes technology stacks (MERN, MEAN, etc.)

2. **Context-Aware**
   - Considers entire CV/job description, not just skill lists
   - Understands project descriptions and achievements
   - Factors in education and certifications

3. **Scalable**
   - pgvector handles millions of embeddings efficiently
   - Index-based search is fast (< 100ms)
   - Works across languages (English, Russian)

4. **Cost-Effective**
   - Embeddings cached permanently (generated once)
   - OpenAI embedding API: ~$0.0001 per 1K tokens
   - No need for training data

---

## 🛠️ Implementation Plan

### Phase 1: Database Setup (30 minutes)

#### 1.1 Install pgvector Extension

```sql
-- migration: 001_add_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 1.2 Add Embedding Columns

```sql
-- migration: 002_add_embeddings.sql
ALTER TABLE parsed_cvs
ADD COLUMN embedding vector(1536),
ADD COLUMN embedding_model varchar(50) DEFAULT 'text-embedding-3-large',
ADD COLUMN embedding_generated_at timestamptz;

ALTER TABLE jobs
ADD COLUMN embedding vector(1536),
ADD COLUMN embedding_model varchar(50) DEFAULT 'text-embedding-3-large',
ADD COLUMN embedding_generated_at timestamptz;
```

#### 1.3 Create Indexes for Fast Similarity Search

```sql
-- migration: 003_create_embedding_indexes.sql

-- IVFFlat index for approximate nearest neighbor search
-- Lists: rule of thumb is rows/1000 for < 1M rows
CREATE INDEX idx_parsed_cvs_embedding_ivfflat
ON parsed_cvs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX idx_jobs_embedding_ivfflat
ON jobs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- HNSW index (more accurate but slower to build)
-- Uncomment if you need higher accuracy:
-- CREATE INDEX idx_parsed_cvs_embedding_hnsw
-- ON parsed_cvs
-- USING hnsw (embedding vector_cosine_ops);
```

#### 1.4 Update Drizzle Schema

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp, vector } from 'drizzle-orm/pg-core'

export const parsedCvs = pgTable('parsed_cvs', {
  id: text('id').primaryKey(),
  // ... existing fields
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingModel: text('embedding_model'),
  embeddingGeneratedAt: timestamp('embedding_generated_at')
})

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  // ... existing fields
  embedding: vector('embedding', { dimensions: 1536 }),
  embeddingModel: text('embedding_model'),
  embeddingGeneratedAt: timestamp('embedding_generated_at')
})
```

**Checkpoint:** Run migrations and verify schema

```bash
bun run db:migrate
psql $DATABASE_URL -c "\d parsed_cvs" # Should show embedding column
```

---

### Phase 2: Embedding Service (2-3 hours)

#### 2.1 Create Embedding Service

```typescript
// src/services/embedding.service.ts

import { env } from '../config/env'
import { cache } from './cache.service'
import { hashString } from '../utils/crypto'
import { logger } from '../utils/logger'
import type { ParsedCV, JobItem } from '../types'

export class EmbeddingService {
  private openaiKey = env.OPENAI_API_KEY
  private model = 'text-embedding-3-large' // 1536 dimensions
  private baseURL = 'https://api.openai.com/v1/embeddings'

  /**
   * Generate embedding for a CV
   * Uses title, summary, skills, and first 500 chars of experience
   */
  async generateCVEmbedding(cv: ParsedCV): Promise<number[]> {
    const text = this.prepareCVText(cv)
    const cacheKey = `embedding:cv:${hashString(text)}`

    // Check cache first
    const cached = cache.get<number[]>(cacheKey)
    if (cached) {
      logger.debug('Embedding cache hit', { type: 'cv', length: cached.length })
      return cached
    }

    // Generate new embedding
    const embedding = await this.getEmbedding(text)

    // Cache permanently (embeddings don't change unless CV changes)
    cache.set(cacheKey, embedding, 86400000 * 30) // 30 days

    logger.info('CV embedding generated', {
      dimensions: embedding.length,
      textLength: text.length
    })

    return embedding
  }

  /**
   * Generate embedding for a job posting
   * Uses title, description, and skills
   */
  async generateJobEmbedding(job: JobItem): Promise<number[]> {
    const text = this.prepareJobText(job)
    const cacheKey = `embedding:job:${hashString(text)}`

    const cached = cache.get<number[]>(cacheKey)
    if (cached) {
      logger.debug('Embedding cache hit', { type: 'job', length: cached.length })
      return cached
    }

    const embedding = await this.getEmbedding(text)
    cache.set(cacheKey, embedding, 86400000 * 7) // 7 days (jobs may update)

    logger.info('Job embedding generated', {
      dimensions: embedding.length,
      textLength: text.length
    })

    return embedding
  }

  /**
   * Prepare CV text for embedding
   */
  private prepareCVText(cv: ParsedCV): string {
    const parts: string[] = []

    // Title (high importance)
    if (cv.title) parts.push(`Professional Title: ${cv.title}`)

    // Summary (high importance)
    if (cv.summary) parts.push(`Summary: ${cv.summary}`)

    // Skills (high importance)
    if (cv.skills && cv.skills.length > 0) {
      parts.push(`Skills: ${cv.skills.join(', ')}`)
    }

    // Experience (truncated to first 500 chars for context)
    if (cv.experience) {
      const exp = cv.experience.substring(0, 500)
      parts.push(`Experience: ${exp}`)
    }

    // Education (brief)
    if (cv.education) {
      const edu = cv.education.substring(0, 200)
      parts.push(`Education: ${edu}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Prepare job text for embedding
   */
  private prepareJobText(job: JobItem): string {
    const parts: string[] = []

    // Job title (high importance)
    if (job.title) parts.push(`Position: ${job.title}`)

    // Company (context)
    if (job.company) parts.push(`Company: ${job.company}`)

    // Required skills (high importance)
    if (job.skills && job.skills.length > 0) {
      parts.push(`Required Skills: ${job.skills.join(', ')}`)
    }

    // Description (truncated to 500 chars)
    if (job.description) {
      const desc = job.description.substring(0, 500)
      parts.push(`Description: ${desc}`)
    }

    // Salary (optional context)
    if (job.salary) {
      parts.push(`Salary: ${job.salary}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Call OpenAI Embeddings API
   */
  private async getEmbedding(text: string): Promise<number[]> {
    if (!this.openaiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
          encoding_format: 'float' // Ensure we get float arrays
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Invalid response from OpenAI API')
      }

      // Log token usage for cost tracking
      logger.info('OpenAI embedding tokens used', {
        promptTokens: data.usage.prompt_tokens,
        totalTokens: data.usage.total_tokens,
        estimatedCost: (data.usage.total_tokens / 1000) * 0.00013 // $0.13/1M tokens
      })

      return data.data[0].embedding
    } catch (error) {
      logger.error('Failed to generate embedding', error as Error)
      throw error
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * Returns value between 0 and 1 (1 = identical, 0 = orthogonal)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions')
    }

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    magnitudeA = Math.sqrt(magnitudeA)
    magnitudeB = Math.sqrt(magnitudeB)

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0
    }

    return dotProduct / (magnitudeA * magnitudeB)
  }

  /**
   * Batch generate embeddings (for backfilling existing data)
   */
  async batchGenerateCVEmbeddings(cvs: ParsedCV[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>()

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < cvs.length; i += batchSize) {
      const batch = cvs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (cv) => {
          try {
            const embedding = await this.generateCVEmbedding(cv)
            results.set(cv.id!, embedding)
          } catch (error) {
            logger.error('Failed to generate embedding for CV', error as Error, { cvId: cv.id })
          }
        })
      )

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < cvs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}

export const embeddingService = new EmbeddingService()
```

**Checkpoint:** Test embedding generation

```typescript
// test-embedding.ts
const testCV = {
  title: 'Senior React Developer',
  summary: 'Experienced frontend engineer with 5 years building modern web apps',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: 'Built scalable SPA applications...'
}

const embedding = await embeddingService.generateCVEmbedding(testCV)
console.log('Embedding dimensions:', embedding.length) // Should be 1536
```

---

### Phase 3: Enhanced Matching Service (2-3 hours)

#### 3.1 Create Matching Service

```typescript
// src/services/matching.service.ts

import { db } from '../db/client'
import { parsedCvs, jobs } from '../db/schema'
import { eq, sql } from 'drizzle-orm'
import { embeddingService } from './embedding.service'
import { logger } from '../utils/logger'
import type { ParsedCV, JobItem } from '../types'

export interface MatchResult {
  totalScore: number
  breakdown: {
    semantic: number
    skills: number
    experience: number
  }
  reasoning: string[]
  confidence: 'high' | 'medium' | 'low'
}

export class MatchingService {
  /**
   * Calculate enhanced match score using hybrid approach
   */
  async calculateEnhancedMatchScore(
    cv: ParsedCV,
    job: JobItem
  ): Promise<MatchResult> {
    logger.debug('Calculating enhanced match score', {
      cvId: cv.id,
      jobId: job.id
    })

    // 1. Semantic similarity (60% weight)
    const semanticScore = await this.computeSemanticSimilarity(cv, job)

    // 2. Exact skill matches (30% weight)
    const skillScore = this.computeSkillMatch(cv, job)

    // 3. Experience level match (10% weight)
    const experienceScore = this.computeExperienceMatch(cv, job)

    // Calculate weighted total
    const totalScore = Math.round(
      semanticScore * 0.6 + skillScore * 0.3 + experienceScore * 0.1
    )

    // Generate reasoning
    const reasoning = this.generateMatchReasoning(
      cv,
      job,
      semanticScore,
      skillScore,
      experienceScore
    )

    // Determine confidence
    const confidence = this.calculateConfidence(semanticScore, skillScore)

    logger.info('Match score calculated', {
      cvId: cv.id,
      jobId: job.id,
      totalScore,
      breakdown: { semanticScore, skillScore, experienceScore }
    })

    return {
      totalScore,
      breakdown: {
        semantic: semanticScore,
        skills: skillScore,
        experience: experienceScore
      },
      reasoning,
      confidence
    }
  }

  /**
   * Compute semantic similarity using embeddings
   */
  private async computeSemanticSimilarity(
    cv: ParsedCV,
    job: JobItem
  ): Promise<number> {
    // Get or generate embeddings
    const [cvEmbedding, jobEmbedding] = await Promise.all([
      this.getOrCreateCVEmbedding(cv),
      this.getOrCreateJobEmbedding(job)
    ])

    // Calculate cosine similarity
    const similarity = embeddingService.cosineSimilarity(cvEmbedding, jobEmbedding)

    // Convert to 0-100 scale
    return Math.round(similarity * 100)
  }

  /**
   * Get CV embedding from DB or generate if missing
   */
  private async getOrCreateCVEmbedding(cv: ParsedCV): Promise<number[]> {
    if (!cv.id) {
      // CV not yet saved, generate embedding
      return await embeddingService.generateCVEmbedding(cv)
    }

    // Try to get from database
    const row = await db
      .select({ embedding: parsedCvs.embedding })
      .from(parsedCvs)
      .where(eq(parsedCvs.id, cv.id))
      .limit(1)

    if (row[0]?.embedding) {
      return row[0].embedding as unknown as number[]
    }

    // Generate and save
    const embedding = await embeddingService.generateCVEmbedding(cv)

    await db
      .update(parsedCvs)
      .set({
        embedding: embedding as any,
        embeddingModel: 'text-embedding-3-large',
        embeddingGeneratedAt: new Date()
      })
      .where(eq(parsedCvs.id, cv.id))

    return embedding
  }

  /**
   * Get job embedding from DB or generate if missing
   */
  private async getOrCreateJobEmbedding(job: JobItem): Promise<number[]> {
    if (!job.id) {
      return await embeddingService.generateJobEmbedding(job)
    }

    const row = await db
      .select({ embedding: jobs.embedding })
      .from(jobs)
      .where(eq(jobs.id, job.id))
      .limit(1)

    if (row[0]?.embedding) {
      return row[0].embedding as unknown as number[]
    }

    const embedding = await embeddingService.generateJobEmbedding(job)

    await db
      .update(jobs)
      .set({
        embedding: embedding as any,
        embeddingModel: 'text-embedding-3-large',
        embeddingGeneratedAt: new Date()
      })
      .where(eq(jobs.id, job.id))

    return embedding
  }

  /**
   * Compute exact skill match score (legacy algorithm)
   */
  private computeSkillMatch(cv: ParsedCV, job: JobItem): number {
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = (job.skills || []).map(s => s.toLowerCase())

    if (jobSkills.length === 0) return 0

    const matches = jobSkills.filter(skill => cvSkills.has(skill)).length
    return Math.round((matches / jobSkills.length) * 100)
  }

  /**
   * Compute experience level match
   */
  private computeExperienceMatch(cv: ParsedCV, job: JobItem): number {
    // Extract years of experience from CV
    const cvYears = this.extractYearsOfExperience(cv.experience || '')

    // Extract required years from job description
    const jobYears = this.extractRequiredYears(job.description || '')

    if (jobYears === null) return 100 // No requirement specified

    // Perfect match at required years, decreasing score below/above
    if (cvYears >= jobYears) {
      // Have required experience or more
      const overage = cvYears - jobYears
      // Slight penalty for being overqualified (0-10% reduction)
      return Math.max(90, 100 - Math.floor(overage * 2))
    } else {
      // Below required experience
      const gap = jobYears - cvYears
      // Penalize more heavily (20% per year gap)
      return Math.max(0, 100 - gap * 20)
    }
  }

  /**
   * Extract years of experience from text
   */
  private extractYearsOfExperience(text: string): number {
    // Look for patterns like "5 years", "3+ years", "2-4 years"
    const patterns = [
      /(\d+)\+?\s*years?/i,
      /(\d+)\s*лет/i, // Russian
      /experience.*?(\d+)/i
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }

    // Default: estimate from content length (rough heuristic)
    if (text.length > 2000) return 5
    if (text.length > 1000) return 3
    if (text.length > 500) return 2
    return 1
  }

  /**
   * Extract required years from job description
   */
  private extractRequiredYears(text: string): number | null {
    const patterns = [
      /(\d+)\+?\s*years?\s*(of\s*)?experience/i,
      /minimum.*?(\d+)\s*years?/i,
      /(\d+)\s*лет.*?опыта/i // Russian
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return parseInt(match[1], 10)
      }
    }

    return null // No specific requirement
  }

  /**
   * Generate human-readable reasoning for match score
   */
  private generateMatchReasoning(
    cv: ParsedCV,
    job: JobItem,
    semanticScore: number,
    skillScore: number,
    experienceScore: number
  ): string[] {
    const reasons: string[] = []

    // Semantic match
    if (semanticScore >= 80) {
      reasons.push('Strong overall match between CV and job requirements')
    } else if (semanticScore >= 60) {
      reasons.push('Good alignment with job requirements')
    } else if (semanticScore >= 40) {
      reasons.push('Moderate match with some relevant experience')
    } else {
      reasons.push('Limited alignment with job requirements')
    }

    // Skill match
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = (job.skills || []).map(s => s.toLowerCase())
    const matchedSkills = jobSkills.filter(s => cvSkills.has(s))

    if (matchedSkills.length > 0) {
      reasons.push(`Matches ${matchedSkills.length}/${jobSkills.length} required skills: ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? '...' : ''}`)
    } else {
      reasons.push('No exact skill keyword matches found')
    }

    // Experience level
    if (experienceScore >= 90) {
      reasons.push('Experience level matches job requirements')
    } else if (experienceScore >= 70) {
      reasons.push('Slightly overqualified for position')
    } else if (experienceScore >= 50) {
      reasons.push('Close to required experience level')
    } else {
      reasons.push('Below required experience level')
    }

    return reasons
  }

  /**
   * Calculate confidence in match score
   */
  private calculateConfidence(
    semanticScore: number,
    skillScore: number
  ): 'high' | 'medium' | 'low' {
    // High confidence if both metrics agree
    if (semanticScore >= 70 && skillScore >= 70) return 'high'
    if (semanticScore >= 50 && skillScore >= 50) return 'medium'

    // If they disagree significantly, confidence is lower
    const diff = Math.abs(semanticScore - skillScore)
    if (diff > 30) return 'low'

    return 'medium'
  }

  /**
   * Find top N matching jobs for a CV using vector similarity
   */
  async findSimilarJobs(
    cv: ParsedCV,
    limit: number = 10,
    minScore: number = 50
  ): Promise<Array<{ job: JobItem; score: number }>> {
    const cvEmbedding = await this.getOrCreateCVEmbedding(cv)

    // Use pgvector for fast similarity search
    const results = await db.execute(sql`
      SELECT
        j.*,
        1 - (j.embedding <=> ${cvEmbedding}::vector) AS similarity_score
      FROM ${jobs} j
      WHERE j.embedding IS NOT NULL
        AND (1 - (j.embedding <=> ${cvEmbedding}::vector)) * 100 >= ${minScore}
      ORDER BY j.embedding <=> ${cvEmbedding}::vector
      LIMIT ${limit}
    `)

    return results.rows.map((row: any) => ({
      job: row as JobItem,
      score: Math.round(row.similarity_score * 100)
    }))
  }
}

export const matchingService = new MatchingService()
```

**Checkpoint:** Test matching service

```typescript
const matchResult = await matchingService.calculateEnhancedMatchScore(testCV, testJob)
console.log('Match score:', matchResult.totalScore)
console.log('Breakdown:', matchResult.breakdown)
console.log('Reasoning:', matchResult.reasoning)
```

---

### Phase 4: Integration & Migration (1-2 hours)

#### 4.1 Update Queue Service

```typescript
// src/services/queue.service.ts

import { matchingService } from './matching.service'

export class QueueService {
  // ... existing code ...

  /**
   * Enhanced match score calculation
   */
  async calculateMatchScore(cv: ParsedCV, job: JobItem): Promise<number> {
    try {
      const result = await matchingService.calculateEnhancedMatchScore(cv, job)
      return result.totalScore
    } catch (error) {
      logger.error('Enhanced matching failed, falling back to basic', error as Error)
      // Fallback to basic keyword matching
      return this.calculateBasicMatchScore(cv, job)
    }
  }

  /**
   * Legacy keyword matching (fallback)
   */
  private calculateBasicMatchScore(cv: ParsedCV, job: JobItem): number {
    const cvSkills = new Set((cv.skills || []).map(s => s.toLowerCase()))
    const jobSkills = new Set((job.skills || []).map(s => s.toLowerCase()))

    if (jobSkills.size === 0) return 0

    let matches = 0
    for (const skill of jobSkills) {
      if (cvSkills.has(skill)) matches++
    }

    return Math.round((matches / jobSkills.size) * 100)
  }
}
```

#### 4.2 Create Migration Script for Existing Data

```typescript
// scripts/backfill-embeddings.ts

import { db } from '../src/db/client'
import { parsedCvs, jobs } from '../src/db/schema'
import { embeddingService } from '../src/services/embedding.service'
import { isNull } from 'drizzle-orm'

async function backfillCVEmbeddings() {
  console.log('Fetching CVs without embeddings...')

  const cvsWithoutEmbeddings = await db
    .select()
    .from(parsedCvs)
    .where(isNull(parsedCvs.embedding))
    .limit(100) // Process in batches

  console.log(`Found ${cvsWithoutEmbeddings.length} CVs to process`)

  const embeddings = await embeddingService.batchGenerateCVEmbeddings(
    cvsWithoutEmbeddings as any[]
  )

  for (const [cvId, embedding] of embeddings) {
    await db
      .update(parsedCvs)
      .set({
        embedding: embedding as any,
        embeddingModel: 'text-embedding-3-large',
        embeddingGeneratedAt: new Date()
      })
      .where(eq(parsedCvs.id, cvId))
  }

  console.log(`✅ Processed ${embeddings.size} CV embeddings`)
}

async function backfillJobEmbeddings() {
  console.log('Fetching jobs without embeddings...')

  const jobsWithoutEmbeddings = await db
    .select()
    .from(jobs)
    .where(isNull(jobs.embedding))
    .limit(100)

  console.log(`Found ${jobsWithoutEmbeddings.length} jobs to process`)

  for (const job of jobsWithoutEmbeddings) {
    const embedding = await embeddingService.generateJobEmbedding(job as any)

    await db
      .update(jobs)
      .set({
        embedding: embedding as any,
        embeddingModel: 'text-embedding-3-large',
        embeddingGeneratedAt: new Date()
      })
      .where(eq(jobs.id, job.id))

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log(`✅ Processed ${jobsWithoutEmbeddings.length} job embeddings`)
}

async function main() {
  try {
    await backfillCVEmbeddings()
    await backfillJobEmbeddings()
    console.log('✅ Backfill complete!')
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  }
}

main()
```

**Run backfill:**
```bash
bun run scripts/backfill-embeddings.ts
```

---

### Phase 5: Testing & Validation (1-2 hours)

#### 5.1 Unit Tests

```typescript
// tests/unit/matching.service.test.ts

describe('Matching Service', () => {
  it('should calculate semantic similarity', async () => {
    const cv = {
      title: 'React Developer',
      skills: ['React', 'TypeScript'],
      experience: 'Built modern web apps'
    }

    const job = {
      title: 'Frontend Engineer',
      skills: ['JavaScript frameworks', 'TypeScript'],
      description: 'Looking for someone with React experience'
    }

    const result = await matchingService.calculateEnhancedMatchScore(cv, job)

    expect(result.totalScore).toBeGreaterThan(70)
    expect(result.breakdown.semantic).toBeGreaterThan(60)
    expect(result.confidence).toBe('high')
  })

  it('should handle missing skills gracefully', async () => {
    const cv = { skills: ['Python', 'Django'] }
    const job = { skills: ['React', 'Node.js'] }

    const result = await matchingService.calculateEnhancedMatchScore(cv, job)

    expect(result.totalScore).toBeLessThan(50)
    expect(result.breakdown.skills).toBe(0)
  })
})
```

#### 5.2 Integration Test

```typescript
// tests/integration/matching-flow.test.ts

describe('End-to-End Matching Flow', () => {
  it('should rank jobs by relevance', async () => {
    // Upload CV
    const cvResponse = await uploadCV(testCVFile)
    const cvId = cvResponse.id

    // Get job recommendations
    const matches = await matchingService.findSimilarJobs(
      { id: cvId, ...testCV },
      limit: 5
    )

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].score).toBeGreaterThan(matches[1].score)

    // Verify embeddings were generated
    const cvFromDB = await db.select().from(parsedCvs).where(eq(parsedCvs.id, cvId))
    expect(cvFromDB[0].embedding).toBeDefined()
  })
})
```

---

## 📈 Expected Results

### Before (Keyword Matching)

| CV | Job | Current Score | Issues |
|----|-----|---------------|--------|
| "React developer, 5 years" | "Frontend engineer, modern frameworks" | 0% | No keyword overlap |
| "Node.js backend" | "Server-side JavaScript" | 0% | Different terminology |
| "Junior React dev" | "Senior React position" | 80% | Ignores seniority |

### After (Semantic Matching)

| CV | Job | New Score | Confidence | Reasoning |
|----|-----|-----------|------------|-----------|
| "React developer, 5 years" | "Frontend engineer, modern frameworks" | 87% | High | Strong semantic match, relevant experience |
| "Node.js backend" | "Server-side JavaScript" | 92% | High | Technologies strongly related |
| "Junior React dev" | "Senior React position" | 62% | Medium | Skill match but experience gap |

### Performance Metrics

- **Match Quality:** +40-50% improvement in relevance
- **User Satisfaction:** Estimated +35% (fewer mismatches)
- **Query Speed:** <100ms (with pgvector indexes)
- **Cost:** ~$0.02 per 1000 jobs/CVs (one-time embedding generation)

---

## 🔄 Rollout Plan

### Stage 1: Silent Deployment (Week 1)
- Deploy embedding generation for new CVs/jobs
- Run in parallel with keyword matching
- Log both scores for comparison

### Stage 2: A/B Testing (Week 2-3)
- 50% users get semantic matching
- 50% users get keyword matching
- Measure: application success rate, user engagement

### Stage 3: Full Rollout (Week 4)
- Switch all users to semantic matching
- Keep keyword matching as fallback

### Stage 4: Backfill (Week 5)
- Generate embeddings for all historical data
- Monitor OpenAI API costs

---

## 💰 Cost Analysis

### OpenAI Embedding API Pricing
- **Model:** text-embedding-3-large
- **Cost:** $0.13 per 1M tokens
- **Average tokens per CV/job:** ~400 tokens

**Estimated Costs:**
- 1,000 CVs: ~$0.05
- 10,000 jobs: ~$0.52
- **Monthly (10K new CVs + 50K jobs):** ~$2.60

**Comparison to Alternatives:**
- Multi-model consensus: 3x OpenRouter costs (~$50-100/month)
- Custom ML model: Training infrastructure ($1000+ setup)

**Conclusion:** Embedding-based matching is **20-40x cheaper** than multi-model approach.

---

## 🚀 Future Enhancements

### V2: Hybrid Search
- Combine semantic search with filters (location, salary, remote)
- Use pgvector + traditional indexes

### V3: Personalization
- Learn from user application history
- Boost jobs similar to successfully applied positions

### V4: Multi-language Support
- Use multilingual embeddings for Russian/English
- Model: `text-embedding-3-large` (already supports 100+ languages)

---

## 📚 References

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Vector Similarity Search](https://www.pinecone.io/learn/vector-similarity/)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** Ready for Implementation
