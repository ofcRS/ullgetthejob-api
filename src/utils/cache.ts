/**
 * In-memory response cache for expensive operations
 *
 * Reduces costs for AI API calls and improves response times.
 * Uses LRU (Least Recently Used) eviction when size limit is reached.
 */

import crypto from 'node:crypto'
import { logger } from './logger'

export interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
}

export class Cache<T = any> {
  private store = new Map<string, CacheEntry<T>>()
  private readonly defaultTtl: number
  private readonly maxSize: number

  constructor(
    private readonly name: string,
    options: CacheOptions = {}
  ) {
    this.defaultTtl = options.ttl ?? 3600000 // 1 hour default
    this.maxSize = options.maxSize ?? 1000 // 1000 entries default
  }

  /**
   * Generate cache key from arbitrary data
   */
  static generateKey(data: any): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data)
    return crypto.createHash('sha256').update(serialized).digest('hex')
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      logger.debug(`Cache ${this.name} miss`, { key: key.slice(0, 8) })
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      logger.debug(`Cache ${this.name} expired`, { key: key.slice(0, 8) })
      return null
    }

    // Update hit count
    entry.hits++
    logger.debug(`Cache ${this.name} hit`, {
      key: key.slice(0, 8),
      hits: entry.hits,
      age: Math.floor((Date.now() - entry.createdAt) / 1000) + 's'
    })

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Enforce size limit using LRU eviction
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU()
    }

    const expiresAt = Date.now() + (ttl ?? this.defaultTtl)
    this.store.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      hits: 0
    })

    logger.debug(`Cache ${this.name} set`, {
      key: key.slice(0, 8),
      ttl: Math.floor((ttl ?? this.defaultTtl) / 1000) + 's',
      size: this.store.size
    })
  }

  /**
   * Get or compute value
   */
  async getOrSet(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key)
    if (cached !== null) {
      return cached
    }

    logger.debug(`Cache ${this.name} computing`, { key: key.slice(0, 8) })
    const value = await fn()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.store.delete(key)
    if (deleted) {
      logger.debug(`Cache ${this.name} deleted`, { key: key.slice(0, 8) })
    }
    return deleted
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const size = this.store.size
    this.store.clear()
    logger.info(`Cache ${this.name} cleared`, { entriesCleared: size })
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestHits = Infinity
    let oldestCreated = Infinity

    // Find entry with lowest hits, or oldest if tied
    for (const [key, entry] of this.store.entries()) {
      if (entry.hits < oldestHits ||
          (entry.hits === oldestHits && entry.createdAt < oldestCreated)) {
        oldestKey = key
        oldestHits = entry.hits
        oldestCreated = entry.createdAt
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey)
      logger.debug(`Cache ${this.name} evicted LRU`, {
        key: oldestKey.slice(0, 8),
        hits: oldestHits
      })
    }
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      logger.info(`Cache ${this.name} cleanup`, { removed, remaining: this.store.size })
    }

    return removed
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.store.values())
    const now = Date.now()

    return {
      name: this.name,
      size: this.store.size,
      maxSize: this.maxSize,
      totalHits: entries.reduce((sum, e) => sum + e.hits, 0),
      expired: entries.filter(e => now > e.expiresAt).length,
      averageAge: entries.length > 0
        ? Math.floor(entries.reduce((sum, e) => sum + (now - e.createdAt), 0) / entries.length / 1000)
        : 0
    }
  }

  /**
   * Get current size
   */
  size(): number {
    return this.store.size
  }
}

/**
 * Cache registry for managing multiple caches
 */
class CacheRegistry {
  private caches = new Map<string, Cache<any>>()

  /**
   * Get or create a cache
   */
  get<T = any>(name: string, options?: CacheOptions): Cache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Cache<T>(name, options))
    }
    return this.caches.get(name)! as Cache<T>
  }

  /**
   * Get all caches
   */
  getAll(): Map<string, Cache<any>> {
    return this.caches
  }

  /**
   * Get statistics for all caches
   */
  getAllStats() {
    return Array.from(this.caches.values()).map(cache => cache.getStats())
  }

  /**
   * Cleanup all caches
   */
  cleanupAll(): void {
    this.caches.forEach(cache => cache.cleanup())
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.caches.forEach(cache => cache.clear())
    logger.info('All caches cleared')
  }
}

export const cacheRegistry = new CacheRegistry()

// Start periodic cleanup (every 5 minutes)
setInterval(() => {
  cacheRegistry.cleanupAll()
}, 5 * 60 * 1000)
