import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { db } from '../db/client'
import { users } from '../db/schema'
import { env } from '../config/env'

export class AuthService {
  async register(email: string, password: string) {
    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) {
      throw new Error('User already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const [user] = await db.insert(users).values({
      email,
      passwordHash
    }).returning()

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    )

    return { user: { id: user.id, email: user.email }, token }
  }

  async login(email: string, password: string) {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    )

    return { user: { id: user.id, email: user.email }, token }
  }

  async getUserById(id: string) {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt
    }).from(users).where(eq(users.id, id)).limit(1)

    return user || null
  }

  verifyToken(token: string) {
    try {
      return jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string }
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
