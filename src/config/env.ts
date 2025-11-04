const get = (key: string, fallback?: string) => {
  const v = process.env[key] ?? fallback
  if (v === undefined) throw new Error(`Missing env: ${key}`)
  return v
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  DATABASE_URL: get('DATABASE_URL', 'postgresql://postgres:1@localhost:5432/ullget'),
  JWT_SECRET: get('JWT_SECRET', 'dev_jwt_secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  HH_ACCESS_TOKEN: get('HH_ACCESS_TOKEN', ''),
  ORCHESTRATOR_SECRET: get('ORCHESTRATOR_SECRET', 'dev_orchestrator_secret'),
  CORE_URL: get('CORE_URL', 'http://localhost:4000'),
  SESSION_SECRET: get('SESSION_SECRET'),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
  MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE ?? 10485760), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? './uploads',
  TELEGRAM_HANDLE: process.env.TELEGRAM_HANDLE ?? ''
}

