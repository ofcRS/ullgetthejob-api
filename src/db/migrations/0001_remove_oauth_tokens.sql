-- Migration: Remove OAuth token storage
-- API service no longer stores OAuth tokens; Core service manages them

-- Drop refresh_token column from sessions table (if it exists)
-- Sessions now only store JWTs from Core, not OAuth tokens
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'sessions'
        AND column_name = 'refresh_token'
    ) THEN
        ALTER TABLE sessions DROP COLUMN refresh_token;
    END IF;
END $$;

-- Drop hh_tokens table (OAuth tokens now managed by Core)
DROP TABLE IF EXISTS hh_tokens CASCADE;
