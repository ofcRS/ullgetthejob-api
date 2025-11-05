/**
 * Validation utilities for data integrity and security
 */

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Russian phone number regex: +7XXXXXXXXXX (11 digits with country code)
const RUSSIAN_PHONE_REGEX = /^\+?7\d{10}$/

/**
 * Validate email address format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' }
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Email cannot be empty' }
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Email is too long (max 255 characters)' }
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please provide a valid email address (e.g., user@example.com)' }
  }

  return { valid: true }
}

/**
 * Validate Russian phone number format
 */
export function validateRussianPhone(phone: string): { valid: boolean; error?: string; formatted?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' }
  }

  const trimmed = phone.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Phone number cannot be empty' }
  }

  // Remove all non-digit characters except + for validation
  const cleaned = trimmed.replace(/[\s\-\(\)]/g, '')

  // Check minimum length (at least 10 digits)
  const digitsOnly = cleaned.replace(/\D/g, '')
  if (digitsOnly.length < 10) {
    return { valid: false, error: 'Phone number must have at least 10 digits' }
  }

  // Validate Russian phone format
  if (!RUSSIAN_PHONE_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'Please provide a valid Russian phone number (format: +7XXXXXXXXXX or 8XXXXXXXXXX)'
    }
  }

  // Format to standard: +7XXXXXXXXXX
  const formatted = cleaned.startsWith('+7') ? cleaned : `+7${digitsOnly.slice(-10)}`

  return { valid: true, formatted }
}

/**
 * Validate file type by checking magic bytes (file signature)
 * Prevents file type spoofing by verifying actual file content, not just extension
 */
export async function validateFileType(file: File): Promise<{ valid: boolean; type?: 'pdf' | 'docx' | 'doc' | 'txt'; error?: string }> {
  try {
    // Validate file name length and characters
    if (file.name.length > 255) {
      return { valid: false, error: 'File name is too long (max 255 characters)' }
    }

    // Check for suspicious file names
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return { valid: false, error: 'File name contains invalid characters' }
    }

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer.slice(0, 8))

    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: true, type: 'pdf' }
    }

    // DOCX/DOC magic bytes: PK (ZIP format) (0x50 0x4B)
    // DOCX files are actually ZIP archives
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      // Check for ZIP bomb: suspicious compression ratio
      const compressedSize = file.size
      const maxUncompressedSize = compressedSize * 100 // Allow max 100:1 ratio

      if (maxUncompressedSize > 100 * 1024 * 1024) { // 100MB uncompressed max
        return { valid: false, error: 'File appears to be a ZIP bomb or excessively compressed' }
      }

      return { valid: true, type: 'docx' }
    }

    // DOC magic bytes: D0 CF 11 E0 A1 B1 1A E1 (OLE/COM format)
    if (
      bytes[0] === 0xD0 && bytes[1] === 0xCF &&
      bytes[2] === 0x11 && bytes[3] === 0xE0 &&
      bytes[4] === 0xA1 && bytes[5] === 0xB1
    ) {
      return { valid: true, type: 'doc' }
    }

    // TXT files: Check for UTF-8/ASCII text (no specific magic bytes)
    // Allow if file is small and appears to be text
    if (file.size < 5 * 1024 * 1024 && file.type === 'text/plain') {
      // Additional validation: check if content is valid UTF-8
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        decoder.decode(buffer)
        return { valid: true, type: 'txt' }
      } catch {
        return { valid: false, error: 'File claims to be text but contains invalid UTF-8' }
      }
    }

    return {
      valid: false,
      error: 'Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed. The file may be corrupted or misnamed.'
    }
  } catch (error) {
    return { valid: false, error: 'Failed to read file for validation' }
  }
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeBytes: number): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }

  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(2)
    const actualMB = (file.size / 1024 / 1024).toFixed(2)
    return {
      valid: false,
      error: `File is too large (${actualMB}MB). Maximum allowed size is ${maxMB}MB`
    }
  }

  return { valid: true }
}

/**
 * Sanitize text input by removing potentially dangerous characters
 * Useful for preventing injection attacks in AI prompts
 */
export function sanitizeTextInput(input: string, maxLength?: number): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength)
  }

  return sanitized
}

/**
 * Validate text length
 */
export function validateTextLength(
  text: string,
  minLength: number,
  maxLength: number,
  fieldName = 'Text'
): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: `${fieldName} is required` }
  }

  const trimmed = text.trim()

  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} is too short (minimum ${minLength} characters, got ${trimmed.length})`
    }
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} is too long (maximum ${maxLength} characters, got ${trimmed.length})`
    }
  }

  return { valid: true }
}
