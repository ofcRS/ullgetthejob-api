-- Migration: Create sessions table for API session management
-- Sessions store JWT tokens from Core service

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" varchar(255) NOT NULL UNIQUE,
  "user_id" uuid,
  "token" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "last_activity_at" timestamp DEFAULT now(),
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "sessions_session_id_index" ON "sessions" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "sessions_user_id_index" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_index" ON "sessions" USING btree ("expires_at");
