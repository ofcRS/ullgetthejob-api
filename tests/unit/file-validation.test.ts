import { describe, it, expect, beforeAll } from 'bun:test'
import { validateFileType, validateFileSize } from '../../src/utils/validation'

describe('File Validation', () => {
  describe('validateFileType', () => {
    it('should validate PDF files correctly', async () => {
      // Create a minimal PDF file
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]) // %PDF-1.4
      const pdfFile = new File([pdfHeader], 'test.pdf', { type: 'application/pdf' })

      const result = await validateFileType(pdfFile)

      expect(result.valid).toBe(true)
      expect(result.type).toBe('pdf')
    })

    it('should validate DOCX files correctly', async () => {
      // Create a minimal ZIP file (DOCX is a ZIP)
      const zipHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04]) // PK zip header
      const docxFile = new File([zipHeader], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      const result = await validateFileType(docxFile)

      expect(result.valid).toBe(true)
      expect(result.type).toBe('docx')
    })

    it('should reject malicious files (exe disguised as pdf)', async () => {
      // Windows executable header: MZ
      const exeHeader = new Uint8Array([0x4D, 0x5A, 0x90, 0x00])
      const fakeFile = new File([exeHeader], 'malware.pdf', { type: 'application/pdf' })

      const result = await validateFileType(fakeFile)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject empty files', async () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' })

      const result = await validateFileType(emptyFile)

      expect(result.valid).toBe(false)
    })

    it('should validate DOC files (legacy Word format)', async () => {
      // OLE/COM header for DOC files
      const docHeader = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
      const docFile = new File([docHeader], 'test.doc', { type: 'application/msword' })

      const result = await validateFileType(docFile)

      expect(result.valid).toBe(true)
      expect(result.type).toBe('doc')
    })
  })

  describe('validateFileSize', () => {
    it('should accept files within size limit', () => {
      const smallFile = new File([new ArrayBuffer(1024 * 1024)], 'small.pdf') // 1MB
      const maxSize = 10 * 1024 * 1024 // 10MB

      const result = validateFileSize(smallFile, maxSize)

      expect(result.valid).toBe(true)
    })

    it('should reject files exceeding size limit', () => {
      const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.pdf') // 11MB
      const maxSize = 10 * 1024 * 1024 // 10MB

      const result = validateFileSize(largeFile, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('should reject empty files', () => {
      const emptyFile = new File([], 'empty.pdf')
      const maxSize = 10 * 1024 * 1024

      const result = validateFileSize(emptyFile, maxSize)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('empty')
    })

    it('should provide helpful error messages with sizes in MB', () => {
      const largeFile = new File([new ArrayBuffer(15 * 1024 * 1024)], 'huge.pdf') // 15MB
      const maxSize = 10 * 1024 * 1024 // 10MB

      const result = validateFileSize(largeFile, maxSize)

      expect(result.error).toContain('15.00')
      expect(result.error).toContain('10.00')
    })
  })
})
