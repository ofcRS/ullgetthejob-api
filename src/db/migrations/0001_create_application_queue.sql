-- Migration: Create application_queue table
CREATE TABLE IF NOT EXISTS "application_queue" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "workflow_id" uuid NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id"),
    "cv_id" uuid NOT NULL REFERENCES "cvs"("id"),
    "job_id" uuid REFERENCES "jobs"("id"),
    "job_external_id" varchar(255) NOT NULL,
    "status" varchar(50) DEFAULT 'pending',
    "payload" jsonb,
    "attempts" integer DEFAULT 0,
    "next_run_at" timestamp DEFAULT now(),
    "priority" integer DEFAULT 0,
    "last_error" text,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "application_queue_status_next_run_at_idx" ON "application_queue"("status", "next_run_at");
CREATE INDEX IF NOT EXISTS "application_queue_workflow_id_idx" ON "application_queue"("workflow_id");
CREATE INDEX IF NOT EXISTS "application_queue_user_id_idx" ON "application_queue"("user_id");
CREATE INDEX IF NOT EXISTS "application_queue_job_external_id_idx" ON "application_queue"("job_external_id");
