import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { env } from '../config/env'

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 })

export const db = drizzle(pool, { schema })
export type DB = typeof db

export async function closeDb() {
  await pool.end()
}

