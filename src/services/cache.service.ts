/**
 * In-memory cache service for API responses
 */

import { logger } from '../utils/logger'

interface CacheEntry<T> {
  data: T
  expires: number
}

/**
 * Simple in-memory cache with TTL support
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private defaultTTL: number = 300000) { // 5 minutes default
    this.startCleanup()
  }

  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      logger.debug('Cache expired', { key })
      return null
    }

    logger.debug('Cache hit', { key })
    return entry.data as T
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expires = Date.now() + (ttl ?? this.defaultTTL)

    this.cache.set(key, {
      data,
      expires
    })

    logger.debug('Cache set', { key, ttl: ttl ?? this.defaultTTL })
  }

  /**
   * Delete a value from cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key)
    logger.debug('Cache deleted', { key })
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    logger.info('Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 300000)
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', { removed, remaining: this.cache.size })
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Export singleton instance
export const cache = new CacheService()
