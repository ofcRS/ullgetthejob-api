-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to parsed_cvs table
ALTER TABLE parsed_cvs
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model varchar(50) DEFAULT 'text-embedding-3-large',
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Add embedding columns to jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_model varchar(50) DEFAULT 'text-embedding-3-large',
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamptz;

-- Create IVFFlat indexes for fast approximate nearest neighbor search
-- Note: These indexes are created after data is populated for better performance
-- For < 1M rows, use lists = rows/1000 (starting with 100)
CREATE INDEX IF NOT EXISTS idx_parsed_cvs_embedding_ivfflat
ON parsed_cvs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_jobs_embedding_ivfflat
ON jobs
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Optional: Add HNSW indexes for higher accuracy (slower to build, faster to query)
-- Uncomment these if you need more accurate similarity search:
-- CREATE INDEX IF NOT EXISTS idx_parsed_cvs_embedding_hnsw
-- ON parsed_cvs
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);
--
-- CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw
-- ON jobs
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Add comment for documentation
COMMENT ON COLUMN parsed_cvs.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using text-embedding-3-large';
COMMENT ON COLUMN jobs.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using text-embedding-3-large';
