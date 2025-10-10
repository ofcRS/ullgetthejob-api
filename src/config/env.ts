const get = (key: string, fallback?: string) => {
  const v = process.env[key] ?? fallback
  if (v === undefined) throw new Error(`Missing env: ${key}`)
  return v
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/ullgetthejobs'),
  JWT_SECRET: get('JWT_SECRET', 'dev_jwt_secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  ORCHESTRATOR_SECRET: get('ORCHESTRATOR_SECRET', 'dev_orchestrator_secret'),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
  MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE ?? 10485760), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads'
}

