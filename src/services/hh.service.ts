import { env } from '../config/env'

interface HHResume {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt?: string
}

interface HHResumeDetail {
  id: string
  title: string
  status: string
  content: string
  createdAt: string
  updatedAt: string
}

interface HHApplicationResult {
  success: boolean
  negotiationId: string
  submittedAt: string
  status: string
}

interface HHApplicationStatus {
  negotiationId: string
  status: string
  lastUpdated: string
  messages: Array<{
    type: string
    date: string
    message: string
  }>
}

interface HHResumeData {
  title: string
  first_name: string
  last_name: string
  birth_date?: string
  area: { id: string }
  contact: Array<{ type: string; value: string }>
  experience: Array<{
    company: string
    position: string
    start: string
    end?: string
    description: string
  }>
  skills: string[]
  education?: string
}

export class HHService {
  private baseURL = 'https://api.hh.ru'
  private accessToken = env.HH_ACCESS_TOKEN

  async getResumes(userId: string): Promise<HHResume[]> {
    const response = await fetch(`${this.baseURL}/resumes/mine`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch resumes: ${response.statusText}`)
    }

    const data = await response.json()
    return (data.items || []).map((resume: any) => ({
      id: resume.id,
      title: resume.title,
      status: resume.status,
      createdAt: resume.created_at,
      updatedAt: resume.updated_at
    }))
  }

  async getResume(resumeId: string): Promise<HHResumeDetail> {
    const response = await fetch(`${this.baseURL}/resumes/${resumeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch resume: ${response.statusText}`)
    }

    const resume = await response.json()
    return {
      id: resume.id,
      title: resume.title,
      status: resume.status,
      content: JSON.stringify(resume, null, 2),
      createdAt: resume.created_at,
      updatedAt: resume.updated_at
    }
  }

  async updateResume(resumeId: string, content: string): Promise<HHResumeDetail> {
    const resumeData = JSON.parse(content)

    const response = await fetch(`${this.baseURL}/resumes/${resumeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resumeData)
    })

    if (!response.ok) {
      throw new Error(`Failed to update resume: ${response.statusText}`)
    }

    const resume = await response.json()
    return {
      id: resume.id,
      title: resume.title,
      status: resume.status,
      content: JSON.stringify(resume, null, 2),
      createdAt: resume.created_at,
      updatedAt: resume.updated_at
    }
  }

  async createResume(cvData: any): Promise<{ id: string }> {
    const resumeData: HHResumeData = {
      title: cvData.title || 'Software Developer',
      first_name: cvData.firstName,
      last_name: cvData.lastName,
      birth_date: cvData.birthDate,
      area: { id: cvData.area || '1' }, // Moscow by default
      contact: [
        { type: 'email', value: cvData.email },
        ...(cvData.phone ? [{ type: 'phone', value: cvData.phone }] : [])
      ],
      experience: cvData.experience?.map((exp: any) => ({
        company: exp.company,
        position: exp.position,
        start: exp.startDate,
        end: exp.endDate,
        description: exp.description
      })) || [],
      skills: cvData.skills || [],
      education: cvData.education
    }

    const response = await fetch(`${this.baseURL}/resumes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resumeData)
    })

    if (!response.ok) {
      throw new Error(`Failed to create resume: ${response.statusText}`)
    }

    const resume = await response.json()
    return { id: resume.id }
  }

  async publishResume(resumeId: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/resumes/${resumeId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to publish resume: ${response.statusText}`)
    }
  }

  async submitApplication(jobId: string, resumeId: string, coverLetter?: string): Promise<HHApplicationResult> {
    const applicationData = {
      vacancy_id: jobId,
      resume_id: resumeId,
      message: coverLetter || ''
    }

    const response = await fetch(`${this.baseURL}/negotiations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(applicationData)
    })

    if (!response.ok) {
      throw new Error(`Failed to submit application: ${response.statusText}`)
    }

    const negotiation = await response.json()
    return {
      success: true,
      negotiationId: negotiation.id,
      submittedAt: new Date().toISOString(),
      status: 'new'
    }
  }

  async getApplicationStatus(negotiationId: string): Promise<HHApplicationStatus> {
    const response = await fetch(`${this.baseURL}/negotiations/${negotiationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get application status: ${response.statusText}`)
    }

    const negotiation = await response.json()
    return {
      negotiationId: negotiation.id,
      status: negotiation.state,
      lastUpdated: negotiation.updated_at || new Date().toISOString(),
      messages: negotiation.messages || []
    }
  }

  async refreshToken(): Promise<{ accessToken: string; expiresIn: number }> {
    // For OAuth refresh, we'd need refresh token stored separately
    // This is a placeholder for the actual OAuth flow
    return {
      accessToken: 'refreshed_token_' + Date.now(),
      expiresIn: 3600
    }
  }
}

export const hhService = new HHService()

