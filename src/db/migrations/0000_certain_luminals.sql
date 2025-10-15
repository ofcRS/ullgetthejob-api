-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "schema_migrations" (
	"version" bigint PRIMARY KEY NOT NULL,
	"inserted_at" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"company" varchar(255),
	"salary" varchar(255),
	"area" varchar(255),
	"url" text,
	"description" text,
	"source" varchar(255) DEFAULT 'hh.ru',
	"search_query" varchar(255),
	"fetched_at" timestamp(0),
	"inserted_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL,
	"hh_vacancy_id" varchar(255),
	"has_test" boolean DEFAULT false NOT NULL,
	"test_required" boolean DEFAULT false NOT NULL,
	"employer_id" varchar(255),
	"skills" varchar(255)[] DEFAULT '{"RAY"}'
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"job_external_id" varchar(255) NOT NULL,
	"cover_letter" text,
	"status" varchar(255) DEFAULT 'pending',
	"submitted_at" timestamp(0),
	"response_data" jsonb,
	"error_message" text,
	"hh_resume_id" varchar(255),
	"inserted_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL,
	"hh_negotiation_id" varchar(255),
	"hh_status" varchar(255),
	"rate_limited_until" timestamp(0)
);
--> statement-breakpoint
CREATE TABLE "cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"original_filename" varchar(255),
	"content_type" varchar(255),
	"parsed_data" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_id" uuid NOT NULL,
	"job_id" uuid,
	"job_title" varchar(255),
	"customized_data" jsonb,
	"cover_letter" text,
	"ai_suggestions" jsonb,
	"created_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cv_id" uuid NOT NULL,
	"job_id" uuid,
	"job_external_id" varchar(255) NOT NULL,
	"status" varchar(255) DEFAULT 'pending',
	"payload" jsonb,
	"attempts" integer DEFAULT 0,
	"next_run_at" timestamp(0) DEFAULT now(),
	"priority" integer DEFAULT 0,
	"last_error" text,
	"created_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"inserted_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsed_cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(50),
	"title" varchar(255),
	"summary" text,
	"experience" text,
	"education" text,
	"skills" varchar(255)[] DEFAULT '{"RAY"}',
	"projects" text,
	"full_text" text,
	"original_filename" varchar(255),
	"file_path" text,
	"model_used" varchar(100),
	"created_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp(0) NOT NULL,
	"inserted_at" timestamp(0) NOT NULL,
	"updated_at" timestamp(0) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cvs" ADD CONSTRAINT "cvs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_cvs" ADD CONSTRAINT "custom_cvs_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "public"."cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_cvs" ADD CONSTRAINT "custom_cvs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_queue" ADD CONSTRAINT "application_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_queue" ADD CONSTRAINT "application_queue_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "public"."cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_queue" ADD CONSTRAINT "application_queue_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_cvs" ADD CONSTRAINT "parsed_cvs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_external_id_index" ON "jobs" USING btree ("external_id" text_ops);--> statement-breakpoint
CREATE INDEX "jobs_fetched_at_index" ON "jobs" USING btree ("fetched_at" timestamp_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_hh_vacancy_id_index" ON "jobs" USING btree ("hh_vacancy_id" text_ops);--> statement-breakpoint
CREATE INDEX "jobs_source_index" ON "jobs" USING btree ("source" text_ops);--> statement-breakpoint
CREATE INDEX "applications_job_id_index" ON "applications" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "applications_status_index" ON "applications" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "applications_submitted_at_index" ON "applications" USING btree ("submitted_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "applications_user_id_index" ON "applications" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cvs_user_id_index" ON "cvs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "custom_cvs_cv_id_index" ON "custom_cvs" USING btree ("cv_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "custom_cvs_job_id_index" ON "custom_cvs" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "application_queue_cv_id_index" ON "application_queue" USING btree ("cv_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "application_queue_job_id_index" ON "application_queue" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "application_queue_next_run_at_index" ON "application_queue" USING btree ("next_run_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "application_queue_priority_index" ON "application_queue" USING btree ("priority" int4_ops);--> statement-breakpoint
CREATE INDEX "application_queue_status_index" ON "application_queue" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "application_queue_user_id_index" ON "application_queue" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_index" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "parsed_cvs_user_id_index" ON "parsed_cvs" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "hh_tokens_user_id_index" ON "hh_tokens" USING btree ("user_id" uuid_ops);
*/