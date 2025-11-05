/**
 * File validation utilities with magic byte checking
 */

import { logger } from './logger'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file type and size
 * @param file File to validate
 * @returns Validation result
 */
export async function validateFile(file: File): Promise<ValidationResult> {
  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    logger.warn('Invalid file type attempted', { type: file.type, name: file.name })
    return {
      valid: false,
      error: 'Only PDF and DOCX files are allowed'
    }
  }

  // Check file size
  if (file.size > MAX_SIZE) {
    logger.warn('File too large', { size: file.size, name: file.name })
    return {
      valid: false,
      error: `File size must be less than ${MAX_SIZE / 1024 / 1024}MB`
    }
  }

  // Check magic bytes to verify actual file type
  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer).slice(0, 4)

    const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 // %PDF
    const isDOCX = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04 // PK (zip header)

    if (!isPDF && !isDOCX) {
      logger.warn('File content mismatch with declared type', {
        type: file.type,
        name: file.name,
        magicBytes: Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      })
      return {
        valid: false,
        error: 'File content does not match declared type'
      }
    }

    // Extra validation for DOCX: verify it's a valid ZIP file
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && !isDOCX) {
      return {
        valid: false,
        error: 'Invalid DOCX file structure'
      }
    }

    // Extra validation for PDF: verify it starts with %PDF
    if (file.type === 'application/pdf' && !isPDF) {
      return {
        valid: false,
        error: 'Invalid PDF file structure'
      }
    }

    logger.info('File validation passed', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    return { valid: true }
  } catch (error) {
    logger.error('File validation error', error as Error, { name: file.name })
    return {
      valid: false,
      error: 'Failed to validate file'
    }
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

/**
 * Check if file extension is allowed
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['pdf', 'docx'].includes(ext)
}
