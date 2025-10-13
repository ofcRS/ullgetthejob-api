import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export class AuthService {
  async register(email: string, password: string) {
    // Development bypass: accept any credentials and mint a token
    const user = {
      id: 'dev-' + Buffer.from(email).toString('base64').slice(0, 10),
      email
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'admin' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    )
    return { user, token }
  }

  async login(email: string, password: string) {
    // Development bypass: accept any credentials and mint a token
    const user = {
      id: 'dev-' + Buffer.from(email).toString('base64').slice(0, 10),
      email
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'admin' },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    )
    return { user, token }
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
      return jwt.verify(token, env.JWT_SECRET) as { userId: string; email: string; role?: string }
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()
