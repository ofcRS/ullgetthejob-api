import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql } from 'drizzle-orm'

// Read DATABASE_URL from .env file
const envFile = readFileSync('./.env', 'utf-8')
const dbUrlMatch = envFile.match(/DATABASE_URL=(.+)/)
if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env file')
  process.exit(1)
}

const databaseUrl = dbUrlMatch[1].trim()
console.log('Connecting to:', databaseUrl.replace(/:[^:@]+@/, ':****@'))

const migrationSQL = readFileSync('./src/db/migrations/0002_create_sessions_table.sql', 'utf-8')

console.log('Running migration: 0002_create_sessions_table.sql')
console.log('---')

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle(pool)

try {
  await db.execute(sql.raw(migrationSQL))
  console.log('✅ Migration completed successfully')
  await pool.end()
  process.exit(0)
} catch (error) {
  console.error('❌ Migration failed:', error)
  await pool.end()
  process.exit(1)
}
