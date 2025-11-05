/**
 * Comprehensive type definitions for the application
 */

// ============================================================================
// Database Types
// ============================================================================

export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  sessionId: string
  userId: string | null
  token: string
  refreshToken: string | null
  expiresAt: Date
  revokedAt: Date | null
  lastActivityAt: Date
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ParsedCV {
  id?: string
  userId?: string | null
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  title?: string
  summary?: string
  experience?: string
  education?: string
  skills?: string[]
  projects?: string
  fullText?: string
  originalFilename?: string
  filePath?: string
  modelUsed?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface CustomizedCV {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  title?: string
  summary?: string
  experience?: string
  education?: string
  skills?: string[]
  projects?: string
  birthDate?: string
  area?: string
  matchedSkills?: string[]
  addedKeywords?: string[]
}

export interface Job {
  id: string
  externalId: string
  title: string
  company?: string
  salary?: string
  area?: string
  url?: string
  description?: string
  source?: string
  searchQuery?: string
  fetchedAt?: Date
  hhVacancyId?: string
  hasTest: boolean
  testRequired: boolean
  employerId?: string
  skills?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Application {
  id: string
  userId: string
  jobId?: string
  customCvId?: string
  jobExternalId: string
  coverLetter?: string
  status?: string
  submittedAt?: Date
  responseData?: Record<string, any>
  errorMessage?: string
  hhResumeId?: string
  hhNegotiationId?: string
  hhStatus?: string
  rateLimitedUntil?: Date
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ErrorResponse {
  success: false
  error: string
  code?: string
  details?: any
  field?: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
  formatted?: string
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionPayload {
  id: string
  token: string
  refreshToken?: string
  exp: number
}

export interface SessionCookieOptions {
  maxAge?: number
  secure?: boolean
  path?: string
  sameSite?: 'lax' | 'strict' | 'none'
  httpOnly?: boolean
}

export interface SessionValidationResult {
  valid: false
  expired?: boolean
  reason?: string
}

export interface SessionValidationSuccess {
  valid: true
  session: SessionPayload
}

export type SessionValidation = SessionValidationResult | SessionValidationSuccess

export interface CreateSessionOptions {
  token: string
  refreshToken?: string
  sessionId?: string
  ttlMs?: number
}

export interface SessionMetadata {
  ipAddress?: string
  userAgent?: string
}

// ============================================================================
// File Upload Types
// ============================================================================

export interface FileValidationResult {
  valid: boolean
  type?: 'pdf' | 'docx' | 'doc'
  error?: string
}

export interface FileSizeValidationResult {
  valid: boolean
  error?: string
}

// ============================================================================
// AI Service Types
// ============================================================================

export interface JobSkills {
  required: string[]
  preferred: string[]
  tools: string[]
  frameworks: string[]
  categories: {
    frontend?: string[]
    backend?: string[]
    devops?: string[]
    [key: string]: string[] | undefined
  }
}

export interface AIModelInfo {
  id: string
  name: string
  provider: string
  description: string
}

export interface CoverLetterOptions {
  cv: CustomizedCV
  jobDescription: string
  companyInfo: string
  model?: string
}

// ============================================================================
// Storage Service Types
// ============================================================================

export interface CreateParsedCvInput {
  userId: string | null
  parsedData: ParsedCV
  originalFilename?: string
  filePath?: string
  modelUsed?: string
}

// ============================================================================
// Route Handler Types
// ============================================================================

export interface CVUploadRequest {
  file: File
  clientId?: string
}

export interface CVCustomizeRequest {
  cv: ParsedCV
  jobDescription: string
  model?: string
}

export interface ApplicationSubmitRequest {
  jobExternalId: string
  customizedCV: CustomizedCV
  coverLetter: string
}

export interface JobSearchRequest {
  text: string
  area?: string
  experience?: string
  employment?: string
  schedule?: string
}

export interface JobSearchResponse {
  success: boolean
  jobs: Job[]
  total: number
  error?: string
}

// ============================================================================
// Auth Types
// ============================================================================

export interface OAuthCallbackQuery {
  code?: string
  error?: string
}

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at?: string
  expiresAt?: string
}

export interface OAuthCallbackResponse {
  success: boolean
  tokens?: OAuthTokens
  error?: string
  connected?: boolean
  session_id?: string
}

export interface HHResumeData {
  first_name?: string
  firstName?: string
  last_name?: string
  lastName?: string
  contact?: {
    email?: string
    phone?: string
  }
  email?: string
  phone?: string
  title?: string
  position?: string
  summary?: string
  skills_description?: string
  experience?: Array<{
    position: string
    company: string
    description?: string
  }>
  education?: Array<{
    school: string
    result?: string
  }>
  skills?: Array<{ name: string } | string>
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage {
  type: string
  searchParams?: any
  clientId?: string
  message?: any
}

export interface WebSocketResponse {
  type: string
  message?: string
  clientId?: string
  searchParams?: any
}

export interface JobBroadcastPayload {
  jobs: Job[]
  stats?: Record<string, any>
}

// ============================================================================
// Validation Types
// ============================================================================

export interface TextValidationResult {
  valid: boolean
  error?: string
}

export interface EmailValidationResult extends ValidationResult {}

export interface PhoneValidationResult extends ValidationResult {}

// ============================================================================
// Logger Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: any
}

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  exponentialBackoff?: boolean
  retryableStatuses?: number[]
  onRetry?: (attempt: number, error: any) => void
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failures: number
  lastFailureTime: number
}

// ============================================================================
// Elysia Context Types (for route handlers)
// ============================================================================

export interface RequestContext {
  body: any
  query: Record<string, string | string[]>
  params: Record<string, string>
  headers: Headers
  request: Request
  set: {
    status?: number
    headers: Record<string, string>
  }
}

// ============================================================================
// Environment Types
// ============================================================================

export interface EnvConfig {
  PORT: number
  NODE_ENV: string
  DATABASE_URL: string
  JWT_SECRET: string
  JWT_EXPIRES_IN: string
  OPENROUTER_API_KEY: string
  HH_ACCESS_TOKEN: string
  ORCHESTRATOR_SECRET: string
  CORE_URL: string
  SESSION_SECRET: string
  ALLOWED_ORIGINS: string[]
  MAX_FILE_SIZE: number
  UPLOAD_DIR: string
  TELEGRAM_HANDLE: string
}
