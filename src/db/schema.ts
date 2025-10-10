import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const cvs = pgTable('cvs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  originalFilename: varchar('original_filename', { length: 255 }),
  contentType: varchar('content_type', { length: 100 }),
  parsedData: jsonb('parsed_data'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  company: varchar('company', { length: 255 }),
  salary: varchar('salary', { length: 255 }),
  area: varchar('area', { length: 255 }),
  url: text('url'),
  source: varchar('source', { length: 50 }).default('hh.ru'),
  searchQuery: varchar('search_query', { length: 255 }),
  fetchedAt: timestamp('fetched_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const customCvs = pgTable('custom_cvs', {
  id: uuid('id').primaryKey().defaultRandom(),
  cvId: uuid('cv_id').references(() => cvs.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  jobTitle: varchar('job_title', { length: 255 }),
  customizedData: jsonb('customized_data'),
  coverLetter: text('cover_letter'),
  aiSuggestions: jsonb('ai_suggestions'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  customCvId: uuid('custom_cv_id').references(() => customCvs.id),
  jobExternalId: varchar('job_external_id', { length: 255 }).notNull(),
  coverLetter: text('cover_letter'),
  status: varchar('status', { length: 50 }).default('pending'),
  submittedAt: timestamp('submitted_at'),
  responseData: jsonb('response_data'),
  errorMessage: text('error_message'),
  hhResumeId: varchar('hh_resume_id', { length: 255 }),
  hhNegotiationId: varchar('hh_negotiation_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

export const applicationQueue = pgTable('application_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  cvId: uuid('cv_id').references(() => cvs.id).notNull(),
  jobId: uuid('job_id').references(() => jobs.id),
  jobExternalId: varchar('job_external_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending'),
  payload: jsonb('payload'),
  attempts: integer('attempts').default(0),
  nextRunAt: timestamp('next_run_at').defaultNow(),
  priority: integer('priority').default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

