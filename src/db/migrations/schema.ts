import { pgTable, bigint, timestamp, uniqueIndex, index, uuid, varchar, text, boolean, foreignKey, jsonb, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const schemaMigrations = pgTable("schema_migrations", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	version: bigint({ mode: "number" }).primaryKey().notNull(),
	insertedAt: timestamp("inserted_at", { mode: 'string' }),
});

export const jobs = pgTable("jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	externalId: varchar("external_id", { length: 255 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	company: varchar({ length: 255 }),
	salary: varchar({ length: 255 }),
	area: varchar({ length: 255 }),
	url: text(),
	description: text(),
	source: varchar({ length: 255 }).default('hh.ru'),
	searchQuery: varchar("search_query", { length: 255 }),
	fetchedAt: timestamp("fetched_at", { mode: 'string' }),
	insertedAt: timestamp("inserted_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	hhVacancyId: varchar("hh_vacancy_id", { length: 255 }),
	hasTest: boolean("has_test").default(false).notNull(),
	testRequired: boolean("test_required").default(false).notNull(),
	employerId: varchar("employer_id", { length: 255 }),
	skills: varchar({ length: 255 }).array().default(["RAY"]),
}, (table) => [
	uniqueIndex().using("btree", table.externalId.asc().nullsLast().op("text_ops")),
	index().using("btree", table.fetchedAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex().using("btree", table.hhVacancyId.asc().nullsLast().op("text_ops")),
	index().using("btree", table.source.asc().nullsLast().op("text_ops")),
]);

export const applications = pgTable("applications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	jobId: uuid("job_id"),
	jobExternalId: varchar("job_external_id", { length: 255 }).notNull(),
	coverLetter: text("cover_letter"),
	status: varchar({ length: 255 }).default('pending'),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	responseData: jsonb("response_data"),
	errorMessage: text("error_message"),
	hhResumeId: varchar("hh_resume_id", { length: 255 }),
	insertedAt: timestamp("inserted_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	hhNegotiationId: varchar("hh_negotiation_id", { length: 255 }),
	hhStatus: varchar("hh_status", { length: 255 }),
	rateLimitedUntil: timestamp("rate_limited_until", { mode: 'string' }),
}, (table) => [
	index().using("btree", table.jobId.asc().nullsLast().op("uuid_ops")),
	index().using("btree", table.status.asc().nullsLast().op("text_ops")),
	index().using("btree", table.submittedAt.asc().nullsLast().op("timestamp_ops")),
	index().using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "applications_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "applications_job_id_fkey"
		}).onDelete("cascade"),
]);

export const cvs = pgTable("cvs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	filePath: text("file_path").notNull(),
	originalFilename: varchar("original_filename", { length: 255 }),
	contentType: varchar("content_type", { length: 255 }),
	parsedData: jsonb("parsed_data"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index().using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cvs_user_id_fkey"
		}).onDelete("cascade"),
]);

export const customCvs = pgTable("custom_cvs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	cvId: uuid("cv_id").notNull(),
	jobId: uuid("job_id"),
	jobTitle: varchar("job_title", { length: 255 }),
	customizedData: jsonb("customized_data"),
	coverLetter: text("cover_letter"),
	aiSuggestions: jsonb("ai_suggestions"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index().using("btree", table.cvId.asc().nullsLast().op("uuid_ops")),
	index().using("btree", table.jobId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cvId],
			foreignColumns: [cvs.id],
			name: "custom_cvs_cv_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "custom_cvs_job_id_fkey"
		}).onDelete("set null"),
]);

export const applicationQueue = pgTable("application_queue", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workflowId: uuid("workflow_id").notNull(),
	userId: uuid("user_id").notNull(),
	cvId: uuid("cv_id").notNull(),
	jobId: uuid("job_id"),
	jobExternalId: varchar("job_external_id", { length: 255 }).notNull(),
	status: varchar({ length: 255 }).default('pending'),
	payload: jsonb(),
	attempts: integer().default(0),
	nextRunAt: timestamp("next_run_at", { mode: 'string' }).defaultNow(),
	priority: integer().default(0),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index().using("btree", table.cvId.asc().nullsLast().op("uuid_ops")),
	index().using("btree", table.jobId.asc().nullsLast().op("uuid_ops")),
	index().using("btree", table.nextRunAt.asc().nullsLast().op("timestamp_ops")),
	index().using("btree", table.priority.asc().nullsLast().op("int4_ops")),
	index().using("btree", table.status.asc().nullsLast().op("text_ops")),
	index().using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "application_queue_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.cvId],
			foreignColumns: [cvs.id],
			name: "application_queue_cv_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "application_queue_job_id_fkey"
		}).onDelete("set null"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	insertedAt: timestamp("inserted_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex().using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const parsedCvs = pgTable("parsed_cvs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	firstName: varchar("first_name", { length: 100 }),
	lastName: varchar("last_name", { length: 100 }),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 50 }),
	title: varchar({ length: 255 }),
	summary: text(),
	experience: text(),
	education: text(),
	skills: varchar({ length: 255 }).array().default(["RAY"]),
	projects: text(),
	fullText: text("full_text"),
	originalFilename: varchar("original_filename", { length: 255 }),
	filePath: text("file_path"),
	modelUsed: varchar("model_used", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index().using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "parsed_cvs_user_id_fkey"
		}).onDelete("set null"),
]);

export const hhTokens = pgTable("hh_tokens", {
	id: uuid().primaryKey().notNull(),
	userId: uuid("user_id"),
	accessToken: text("access_token").notNull(),
	refreshToken: text("refresh_token").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	insertedAt: timestamp("inserted_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index().using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);
