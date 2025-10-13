import jwt from 'jsonwebtoken'
import { env } from '../config/env'

// Simplified auth service for MVP - no database, no real auth
export class AuthService {
  verifyToken(token: string) {
    try {
      return jwt.verify(token, env.JWT_SECRET) as { 
        userId: string
        email: string
        role?: string 
      }
    } catch {
      return null
    }
  }
}

export const authService = new AuthService()