/**
 * Backfill script to generate embeddings for existing CVs and jobs
 * Run with: bun run scripts/backfill-embeddings.ts
 */

import { db } from '../src/db/client'
import { parsedCvs, jobs } from '../src/db/schema'
import { embeddingService } from '../src/services/embedding.service'
import { isNull, eq } from 'drizzle-orm'

async function backfillCVEmbeddings(batchSize: number = 50) {
  console.log('🔍 Fetching CVs without embeddings...')

  const cvsWithoutEmbeddings = await db
    .select()
    .from(parsedCvs)
    .where(isNull(parsedCvs.embedding))
    .limit(batchSize)

  console.log(`📊 Found ${cvsWithoutEmbeddings.length} CVs to process`)

  if (cvsWithoutEmbeddings.length === 0) {
    console.log('✅ All CVs already have embeddings!')
    return 0
  }

  const embeddings = await embeddingService.batchGenerateCVEmbeddings(
    cvsWithoutEmbeddings as any[]
  )

  let updated = 0
  for (const [cvId, embedding] of embeddings) {
    try {
      await db
        .update(parsedCvs)
        .set({
          embedding: JSON.stringify(embedding) as any,
          embeddingModel: 'text-embedding-3-large',
          embeddingGeneratedAt: new Date()
        })
        .where(eq(parsedCvs.id, cvId))

      updated++
    } catch (error) {
      console.error(`❌ Failed to update CV ${cvId}:`, error)
    }
  }

  console.log(`✅ Processed ${updated}/${cvsWithoutEmbeddings.length} CV embeddings`)
  return updated
}

async function backfillJobEmbeddings(batchSize: number = 50) {
  console.log('🔍 Fetching jobs without embeddings...')

  const jobsWithoutEmbeddings = await db
    .select()
    .from(jobs)
    .where(isNull(jobs.embedding))
    .limit(batchSize)

  console.log(`📊 Found ${jobsWithoutEmbeddings.length} jobs to process`)

  if (jobsWithoutEmbeddings.length === 0) {
    console.log('✅ All jobs already have embeddings!')
    return 0
  }

  let updated = 0
  for (const job of jobsWithoutEmbeddings) {
    try {
      const embedding = await embeddingService.generateJobEmbedding(job as any)

      await db
        .update(jobs)
        .set({
          embedding: JSON.stringify(embedding) as any,
          embeddingModel: 'text-embedding-3-large',
          embeddingGeneratedAt: new Date()
        })
        .where(eq(jobs.id, job.id))

      updated++

      // Rate limiting: wait 200ms between jobs
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`❌ Failed to update job ${job.id}:`, error)
    }
  }

  console.log(`✅ Processed ${updated}/${jobsWithoutEmbeddings.length} job embeddings`)
  return updated
}

async function main() {
  console.log('🚀 Starting embedding backfill process...\n')

  const startTime = Date.now()

  try {
    // Process in batches to avoid memory issues
    const batchSize = 50
    let totalCVs = 0
    let totalJobs = 0

    // Backfill CVs
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📄 Processing CV Embeddings')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    let processedCVs = 0
    do {
      processedCVs = await backfillCVEmbeddings(batchSize)
      totalCVs += processedCVs

      if (processedCVs > 0) {
        console.log(`📊 Total CVs processed so far: ${totalCVs}\n`)
      }
    } while (processedCVs === batchSize)

    // Backfill Jobs
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💼 Processing Job Embeddings')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    let processedJobs = 0
    do {
      processedJobs = await backfillJobEmbeddings(batchSize)
      totalJobs += processedJobs

      if (processedJobs > 0) {
        console.log(`📊 Total jobs processed so far: ${totalJobs}\n`)
      }
    } while (processedJobs === batchSize)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Backfill Complete!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 Total CVs processed: ${totalCVs}`)
    console.log(`💼 Total jobs processed: ${totalJobs}`)
    console.log(`⏱️  Duration: ${duration}s`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Estimate costs
    const totalTokens = (totalCVs + totalJobs) * 400 // ~400 tokens per embedding
    const estimatedCost = (totalTokens / 1000000) * 0.13 // $0.13/1M tokens
    console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)}`)

  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
