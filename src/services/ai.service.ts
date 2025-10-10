import { env } from '../config/env'

interface ParsedCV {
  email?: string
  phone?: string
  fullText: string
  experience?: string
  education?: string
  skills?: string[]
  projects?: string
}

interface CustomizedCV {
  email?: string
  phone?: string
  experience?: string
  education?: string
  skills?: string[]
  projects?: string
  firstName?: string
  lastName?: string
  title?: string
  birthDate?: string
  area?: string
}

export class AIService {
  private openRouterKey = env.OPENROUTER_API_KEY
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions'

  async customizeCV(originalCV: ParsedCV, jobDescription: string): Promise<CustomizedCV> {
    const prompt = `
      Given this CV and job description, restructure the CV to highlight relevant:
      1. Projects that match the job requirements
      2. Responsibilities that align with the role
      3. Achievements using similar keywords

      Original CV:
      ${JSON.stringify(originalCV, null, 2)}

      Job Description:
      ${jobDescription}

      Return a JSON object with restructured sections emphasizing relevance.
      Do not invent new information, only reorganize and highlight existing content.
      Include these fields: email, phone, experience, education, skills, projects, firstName, lastName, title, birthDate, area

      Response format:
      {
        "email": "...",
        "phone": "...",
        "experience": "...",
        "education": "...",
        "skills": ["...", "..."],
        "projects": "...",
        "firstName": "...",
        "lastName": "...",
        "title": "...",
        "birthDate": "...",
        "area": "..."
      }
    `

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ullgetthejob.com',
          'X-Title': 'UllGetTheJob CV Customizer'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No response from AI service')
      }

      // Parse JSON response, handling potential markdown formatting
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI')
      }

      const customizedData = JSON.parse(jsonMatch[0])

      // Ensure skills is always an array
      if (customizedData.skills && !Array.isArray(customizedData.skills)) {
        customizedData.skills = customizedData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      }

      return customizedData as CustomizedCV
    } catch (error) {
      console.error('AI customization failed:', error)
      // Fallback to original CV if AI fails
      return {
        email: originalCV.email,
        phone: originalCV.phone,
        experience: originalCV.experience,
        education: originalCV.education,
        skills: originalCV.skills || [],
        projects: originalCV.projects,
        firstName: extractName(originalCV.fullText)?.firstName,
        lastName: extractName(originalCV.fullText)?.lastName,
        title: 'Software Developer'
      }
    }
  }

  async generateCoverLetter(cv: CustomizedCV, jobDescription: string, companyInfo: string): Promise<string> {
    const prompt = `
      Write a personalized cover letter for this position.

      Candidate Background:
      ${JSON.stringify(cv, null, 2)}

      Job Description:
      ${jobDescription}

      Company:
      ${companyInfo}

      Make it personal, mention specific skills/projects from CV that match the role.
      Keep it under 300 words. Be enthusiastic but professional.
      Start with "Dear Hiring Manager," and end with a professional closing.

      Focus on:
      - 2-3 key skills that match the job
      - 1-2 relevant projects or experiences
      - Why you're interested in this specific company/role
      - Call to action for an interview
    `

    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ullgetthejob.com',
          'X-Title': 'UllGetTheJob Cover Letter Generator'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No response from AI service')
      }

      return content.trim()
    } catch (error) {
      console.error('Cover letter generation failed:', error)
      // Fallback to a basic template
      return `
Dear Hiring Manager,

I am excited to apply for this position and believe my background makes me a strong fit.

Key skills that align with your requirements include: ${cv.skills?.slice(0, 3).join(', ') || 'relevant technical skills'}.

${cv.experience ? `In my previous roles, I have ${cv.experience.substring(0, 200)}...` : ''}

I am particularly interested in this opportunity because ${companyInfo ? `of ${companyInfo}` : 'of the challenging work and growth potential'}.

I would welcome the opportunity to discuss how my skills and experience can contribute to your team.

Best regards,
${cv.firstName || 'Candidate'} ${cv.lastName || ''}
      `.trim()
    }
  }
}

function extractName(text: string): { firstName?: string; lastName?: string } {
  // Simple name extraction - look for common patterns
  const nameMatch = text.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/)
  if (nameMatch) {
    return { firstName: nameMatch[1], lastName: nameMatch[2] }
  }
  return {}
}

export const aiService = new AIService()
