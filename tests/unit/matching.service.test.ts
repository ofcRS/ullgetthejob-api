import { describe, it, expect, beforeEach } from 'bun:test'
import { MatchingService } from '../../src/services/matching.service'
import type { ParsedCV } from '../../src/types'

describe('Matching Service', () => {
  let service: MatchingService

  beforeEach(() => {
    service = new MatchingService()
  })

  describe('computeSkillMatch', () => {
    it('should calculate perfect skill match', () => {
      const cv: ParsedCV = {
        skills: ['React', 'TypeScript', 'Node.js'],
        fullText: ''
      }

      const job = {
        skills: ['React', 'TypeScript', 'Node.js']
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(100) // 3/3 skills match
    })

    it('should calculate partial skill match', () => {
      const cv: ParsedCV = {
        skills: ['React', 'TypeScript'],
        fullText: ''
      }

      const job = {
        skills: ['React', 'TypeScript', 'Node.js', 'GraphQL']
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(50) // 2/4 skills match
    })

    it('should be case insensitive', () => {
      const cv: ParsedCV = {
        skills: ['REACT', 'typescript'],
        fullText: ''
      }

      const job = {
        skills: ['react', 'TypeScript']
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(100) // Case doesn't matter
    })

    it('should return 0 for no skill matches', () => {
      const cv: ParsedCV = {
        skills: ['Python', 'Django'],
        fullText: ''
      }

      const job = {
        skills: ['React', 'Node.js']
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(0) // 0/2 skills match
    })

    it('should handle empty job skills', () => {
      const cv: ParsedCV = {
        skills: ['React'],
        fullText: ''
      }

      const job = {
        skills: []
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(0) // No requirements
    })

    it('should handle missing CV skills', () => {
      const cv: ParsedCV = {
        fullText: ''
      }

      const job = {
        skills: ['React', 'Node.js']
      }

      const score = (service as any).computeSkillMatch(cv, job)

      expect(score).toBe(0) // No skills to match
    })
  })

  describe('extractYearsOfExperience', () => {
    it('should extract years from "X years" pattern', () => {
      const years = (service as any).extractYearsOfExperience('5 years of experience')
      expect(years).toBe(5)
    })

    it('should extract years from "X+ years" pattern', () => {
      const years = (service as any).extractYearsOfExperience('3+ years experience')
      expect(years).toBe(3)
    })

    it('should extract years from Russian text', () => {
      const years = (service as any).extractYearsOfExperience('Опыт работы 7 лет')
      expect(years).toBe(7)
    })

    it('should estimate years from text length', () => {
      const longText = 'a'.repeat(2500) // >2000 chars
      const years = (service as any).extractYearsOfExperience(longText)
      expect(years).toBe(5)
    })

    it('should return 1 for minimal experience', () => {
      const years = (service as any).extractYearsOfExperience('Junior developer')
      expect(years).toBe(1)
    })
  })

  describe('extractRequiredYears', () => {
    it('should extract required years from job description', () => {
      const years = (service as any).extractRequiredYears('Minimum 3 years experience required')
      expect(years).toBe(3)
    })

    it('should extract from "X years of experience" pattern', () => {
      const years = (service as any).extractRequiredYears('Looking for someone with 5 years of experience')
      expect(years).toBe(5)
    })

    it('should extract from "X+ years" pattern', () => {
      const years = (service as any).extractRequiredYears('Need developer with 2+ years experience')
      expect(years).toBe(2)
    })

    it('should return null when no requirement specified', () => {
      const years = (service as any).extractRequiredYears('Looking for passionate developer')
      expect(years).toBeNull()
    })

    it('should extract from Russian text', () => {
      const years = (service as any).extractRequiredYears('Требуется опыт работы 4 года')
      expect(years).toBe(4)
    })
  })

  describe('computeExperienceMatch', () => {
    it('should give perfect score for matching experience', () => {
      const cv: ParsedCV = {
        experience: 'I have 5 years of experience',
        fullText: ''
      }

      const job = {
        description: 'Minimum 5 years experience required'
      }

      const score = (service as any).computeExperienceMatch(cv, job)

      expect(score).toBe(100)
    })

    it('should penalize being underqualified', () => {
      const cv: ParsedCV = {
        experience: '2 years experience',
        fullText: ''
      }

      const job = {
        description: 'Need 5 years experience'
      }

      const score = (service as any).computeExperienceMatch(cv, job)

      // 5 - 2 = 3 year gap, 20% per year = 60% penalty
      expect(score).toBe(40)
    })

    it('should slightly penalize being overqualified', () => {
      const cv: ParsedCV = {
        experience: '10 years experience',
        fullText: ''
      }

      const job = {
        description: 'Need 3 years experience'
      }

      const score = (service as any).computeExperienceMatch(cv, job)

      // Overqualified but still high score
      expect(score).toBeGreaterThanOrEqual(85)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should return 100 when no requirement specified', () => {
      const cv: ParsedCV = {
        experience: '3 years experience',
        fullText: ''
      }

      const job = {
        description: 'Looking for talented developer'
      }

      const score = (service as any).computeExperienceMatch(cv, job)

      expect(score).toBe(100)
    })
  })

  describe('calculateConfidence', () => {
    it('should return high confidence for high scores', () => {
      const confidence = (service as any).calculateConfidence(85, 90)
      expect(confidence).toBe('high')
    })

    it('should return medium confidence for medium scores', () => {
      const confidence = (service as any).calculateConfidence(60, 55)
      expect(confidence).toBe('medium')
    })

    it('should return low confidence for disagreeing scores', () => {
      const confidence = (service as any).calculateConfidence(80, 20)
      expect(confidence).toBe('low')
    })

    it('should return low confidence for low scores', () => {
      const confidence = (service as any).calculateConfidence(30, 35)
      expect(confidence).not.toBe('high')
    })
  })

  describe('generateMatchReasoning', () => {
    it('should generate reasoning for strong match', () => {
      const cv: ParsedCV = {
        skills: ['React', 'TypeScript', 'Node.js'],
        experience: '5 years of experience',
        fullText: ''
      }

      const job = {
        skills: ['React', 'TypeScript', 'Node.js'],
        description: 'Need 5 years experience'
      }

      const reasoning = (service as any).generateMatchReasoning(cv, job, 85, 100, 100)

      expect(reasoning).toBeArray()
      expect(reasoning.length).toBeGreaterThan(0)
      expect(reasoning[0]).toContain('Strong overall match')
    })

    it('should mention skill matches in reasoning', () => {
      const cv: ParsedCV = {
        skills: ['React', 'TypeScript'],
        fullText: ''
      }

      const job = {
        skills: ['React', 'TypeScript', 'GraphQL']
      }

      const reasoning = (service as any).generateMatchReasoning(cv, job, 70, 67, 100)

      const skillReason = reasoning.find((r: string) => r.includes('Matches'))
      expect(skillReason).toBeDefined()
      expect(skillReason).toContain('2/3')
    })

    it('should mention experience level in reasoning', () => {
      const cv: ParsedCV = {
        skills: [],
        experience: '3 years',
        fullText: ''
      }

      const job = {
        skills: [],
        description: '5 years required'
      }

      const reasoning = (service as any).generateMatchReasoning(cv, job, 50, 0, 60)

      const expReason = reasoning.find((r: string) => r.toLowerCase().includes('experience'))
      expect(expReason).toBeDefined()
    })
  })
})
