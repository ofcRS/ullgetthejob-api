import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { CacheService } from '../../src/services/cache.service'

describe('Cache Service', () => {
  let cache: CacheService

  beforeEach(() => {
    cache = new CacheService()
  })

  afterEach(() => {
    cache.destroy()
    cache.clear()
  })

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('test-key', { data: 'test-value' })

      const result = cache.get('test-key')

      expect(result).toEqual({ data: 'test-value' })
    })

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent')

      expect(result).toBeNull()
    })

    it('should store different data types', () => {
      cache.set('string', 'text')
      cache.set('number', 42)
      cache.set('object', { foo: 'bar' })
      cache.set('array', [1, 2, 3])

      expect(cache.get('string')).toBe('text')
      expect(cache.get('number')).toBe(42)
      expect(cache.get('object')).toEqual({ foo: 'bar' })
      expect(cache.get('array')).toEqual([1, 2, 3])
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache.set('expire-test', 'data', 100) // 100ms TTL

      // Immediately available
      expect(cache.get('expire-test')).toBe('data')

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be expired
      expect(cache.get('expire-test')).toBeNull()
    })

    it('should use default TTL when not specified', async () => {
      const shortCache = new CacheService(50) // 50ms default TTL
      shortCache.set('default-ttl', 'value')

      await new Promise(resolve => setTimeout(resolve, 80))

      expect(shortCache.get('default-ttl')).toBeNull()
      shortCache.destroy()
    })

    it('should allow custom TTL per item', () => {
      cache.set('short', 'value1', 50)
      cache.set('long', 'value2', 5000)

      expect(cache.get('short')).toBe('value1')
      expect(cache.get('long')).toBe('value2')
    })
  })

  describe('delete', () => {
    it('should delete specific keys', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.delete('key1')

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })
  })

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
      expect(cache.get('key3')).toBeNull()
    })
  })

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      const stats = cache.getStats()

      expect(stats.size).toBe(2)
      expect(stats.keys).toContain('key1')
      expect(stats.keys).toContain('key2')
    })

    it('should reflect deletions in stats', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.delete('key1')

      const stats = cache.getStats()

      expect(stats.size).toBe(1)
      expect(stats.keys).not.toContain('key1')
    })
  })

  describe('cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      const fastCache = new CacheService(100) // 100ms default

      fastCache.set('expire1', 'value', 50)
      fastCache.set('expire2', 'value', 50)
      fastCache.set('keep', 'value', 10000)

      // Wait for expiration + cleanup
      await new Promise(resolve => setTimeout(resolve, 350))

      const stats = fastCache.getStats()
      expect(stats.size).toBe(1) // Only 'keep' should remain
      expect(stats.keys).toContain('keep')

      fastCache.destroy()
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined values', () => {
      cache.set('null-key', null)
      cache.set('undefined-key', undefined)

      expect(cache.get('null-key')).toBeNull()
      expect(cache.get('undefined-key')).toBeUndefined()
    })

    it('should handle overwriting keys', () => {
      cache.set('key', 'original')
      cache.set('key', 'updated')

      expect(cache.get('key')).toBe('updated')
    })

    it('should handle concurrent access', () => {
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, `value-${i}`)
      }

      for (let i = 0; i < 100; i++) {
        expect(cache.get(`key-${i}`)).toBe(`value-${i}`)
      }
    })
  })
})
