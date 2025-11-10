import { describe, it, expect } from 'bun:test'
import {
  validateEmail,
  validateRussianPhone,
  sanitizeTextInput,
  validateTextLength
} from '../../src/utils/validation'

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'firstname+lastname@company.io',
        'email123@test-domain.com'
      ]

      for (const email of validEmails) {
        const result = validateEmail(email)
        expect(result.valid).toBe(true)
      }
    })

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@.com',
        ''
      ]

      for (const email of invalidEmails) {
        const result = validateEmail(email)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }
    })

    it('should trim whitespace', () => {
      const result = validateEmail('  test@example.com  ')
      expect(result.valid).toBe(true)
    })

    it('should reject emails longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      const result = validateEmail(longEmail)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too long')
    })
  })

  describe('validateRussianPhone', () => {
    it('should accept valid Russian phone numbers', () => {
      const validPhones = [
        '+79161234567',
        '+7 916 123 45 67',
        '89161234567',
        '+7(916)123-45-67',
        '7 916 123 45 67'
      ]

      for (const phone of validPhones) {
        const result = validateRussianPhone(phone)
        expect(result.valid).toBe(true)
        expect(result.formatted).toMatch(/^\+7\d{10}$/)
      }
    })

    it('should format phone numbers consistently', () => {
      const inputs = [
        '+79161234567',
        '89161234567',
        '+7 916 123 45 67'
      ]

      for (const input of inputs) {
        const result = validateRussianPhone(input)
        expect(result.formatted).toBe('+79161234567')
      }
    })

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123',
        '+1234567890',
        'not-a-phone',
        '+7916', // too short
        ''
      ]

      for (const phone of invalidPhones) {
        const result = validateRussianPhone(phone)
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      }
    })

    it('should reject non-Russian phone numbers', () => {
      const result = validateRussianPhone('+1234567890') // US format
      expect(result.valid).toBe(false)
    })
  })

  describe('sanitizeTextInput', () => {
    it('should remove null bytes', () => {
      const input = 'test\0with\0nulls'
      const result = sanitizeTextInput(input)
      expect(result).toBe('test with nulls')
    })

    it('should normalize whitespace', () => {
      const input = 'multiple    spaces   and\n\nnewlines'
      const result = sanitizeTextInput(input)
      expect(result).toBe('multiple spaces and newlines')
    })

    it('should trim leading and trailing whitespace', () => {
      const input = '   surrounded by spaces   '
      const result = sanitizeTextInput(input)
      expect(result).toBe('surrounded by spaces')
    })

    it('should enforce max length', () => {
      const input = 'a'.repeat(100)
      const result = sanitizeTextInput(input, 50)
      expect(result.length).toBe(50)
    })

    it('should handle empty strings', () => {
      expect(sanitizeTextInput('')).toBe('')
      expect(sanitizeTextInput('   ')).toBe('')
    })

    it('should handle null/undefined gracefully', () => {
      expect(sanitizeTextInput(null as any)).toBe('')
      expect(sanitizeTextInput(undefined as any)).toBe('')
    })

    it('should prevent common injection patterns', () => {
      const injections = [
        'DROP TABLE users;',
        '<script>alert("xss")</script>',
        "'; DELETE FROM * WHERE '1'='1"
      ]

      for (const injection of injections) {
        const result = sanitizeTextInput(injection)
        // Should not contain null bytes or excessive whitespace
        expect(result).not.toContain('\0')
        expect(result).not.toMatch(/\s{2,}/)
      }
    })
  })

  describe('validateTextLength', () => {
    it('should accept text within valid range', () => {
      const text = 'This is a valid text'
      const result = validateTextLength(text, 5, 50)
      expect(result.valid).toBe(true)
    })

    it('should reject text that is too short', () => {
      const text = 'Hi'
      const result = validateTextLength(text, 10, 100, 'Message')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too short')
      expect(result.error).toContain('Message')
    })

    it('should reject text that is too long', () => {
      const text = 'a'.repeat(200)
      const result = validateTextLength(text, 1, 100, 'Description')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('too long')
      expect(result.error).toContain('Description')
    })

    it('should trim whitespace before validation', () => {
      const text = '   exactly ten   '
      const result = validateTextLength(text, 10, 15)
      expect(result.valid).toBe(true)
    })

    it('should provide helpful error messages', () => {
      const text = 'abc'
      const result = validateTextLength(text, 10, 50, 'Job Description')
      expect(result.error).toContain('Job Description')
      expect(result.error).toContain('10')
      expect(result.error).toContain('3')
    })

    it('should use default field name', () => {
      const text = 'ab'
      const result = validateTextLength(text, 10, 50)
      expect(result.error).toContain('Text')
    })
  })
})
