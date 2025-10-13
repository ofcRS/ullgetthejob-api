import { env } from '../config/env'

interface ParsedCV {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  title?: string
  summary?: string
  experience?: string
  education?: string
  skills?: string[]
  projects?: string
  fullText: string
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
  summary?: string
}

export class AIService {
  private openRouterKey = env.OPENROUTER_API_KEY
  private baseURL = 'https://openrouter.ai/api/v1/chat/completions'
  private defaultModel = 'anthropic/claude-3.5-sonnet'

  async customizeCV(
    originalCV: ParsedCV, 
    jobDescription: string,
    model?: string
  ): Promise<CustomizedCV> {
    const selectedModel = model || this.defaultModel
    
    const prompt = `
You are a professional CV optimizer. Given a CV and job description, restructure the CV to maximize match with the job requirements.

Original CV:
${JSON.stringify(originalCV, null, 2)}

Job Description:
${jobDescription}

IMPORTANT RULES:
1. DO NOT invent new skills or experiences
2. ONLY reorganize and highlight existing content
3. Emphasize skills that match job requirements
4. Reorder experience to prioritize relevant work
5. Extract and highlight matching keywords

Return ONLY valid JSON (no markdown) with this structure:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "email": "string",
  "phone": "string or null",
  "title": "string (professional title)",
  "summary": "string (2-3 sentences highlighting relevant experience)",
  "experience": "string (detailed, emphasizing relevant projects)",
  "education": "string",
  "skills": ["array", "of", "relevant", "skills"],
  "projects": "string (relevant projects)",
  "area": "string (location) or null"
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
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 2500
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

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI')
      }

      const customizedData = JSON.parse(jsonMatch[0])

      if (customizedData.skills && !Array.isArray(customizedData.skills)) {
        customizedData.skills = customizedData.skills.split(',').map((s: string) => s.trim()).filter(Boolean)
      }

      return customizedData as CustomizedCV
    } catch (error) {
      console.error('AI customization failed:', error)
      return this.fallbackCustomization(originalCV)
    }
  }

  async generateCoverLetter(
    cv: CustomizedCV, 
    jobDescription: string, 
    companyInfo: string,
    model?: string
  ): Promise<string> {
    const selectedModel = model || this.defaultModel
    
    const prompt = `
Write a professional cover letter for this job application.

Candidate Info:
Name: ${cv.firstName} ${cv.lastName}
Title: ${cv.title}
Skills: ${cv.skills?.join(', ')}
Summary: ${cv.summary}

Job Description:
${jobDescription}

Company:
${companyInfo}

Requirements:
- Professional and enthusiastic tone
- 250-300 words maximum
- Start with "Dear Hiring Manager,"
- Mention 2-3 specific skills that match the job
- Reference 1-2 relevant experiences
- Show genuine interest in the company/role
- End with call to action for interview
- Use standard business letter format

Write the complete letter now.
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
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1200
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
      return this.fallbackCoverLetter(cv, companyInfo)
    }
  }

  private fallbackCustomization(originalCV: ParsedCV): CustomizedCV {
    return {
      firstName: originalCV.firstName,
      lastName: originalCV.lastName,
      email: originalCV.email,
      phone: originalCV.phone,
      title: originalCV.title || 'Software Developer',
      summary: originalCV.summary || 'Experienced professional seeking new opportunities',
      experience: originalCV.experience || '',
      education: originalCV.education || '',
      skills: originalCV.skills || [],
      projects: originalCV.projects || ''
    }
  }

  private fallbackCoverLetter(cv: CustomizedCV, company: string): string {
    return `Dear Hiring Manager,

I am writing to express my strong interest in the position at ${company}. With my background as a ${cv.title || 'professional'} and expertise in ${cv.skills?.slice(0, 3).join(', ') || 'various technologies'}, I am confident I would be a valuable addition to your team.

${cv.summary || 'Throughout my career, I have developed a strong foundation in software development and problem-solving.'}

I am particularly excited about the opportunity to contribute to ${company} and would welcome the chance to discuss how my skills and experience align with your needs.

Thank you for your consideration. I look forward to speaking with you soon.

Best regards,
${cv.firstName || ''} ${cv.lastName || ''}`
  }
}

export const aiService = new AIService()

// Available models for selection
export const AVAILABLE_MODELS = [
  { 
    id: 'anthropic/claude-3.5-sonnet', 
    name: 'Claude 3.5 Sonnet', 
    provider: 'Anthropic',
    description: 'Best balance of quality and speed'
  },
  { 
    id: 'anthropic/claude-3-opus', 
    name: 'Claude 3 Opus', 
    provider: 'Anthropic',
    description: 'Highest quality, slower'
  },
  { 
    id: 'openai/gpt-4-turbo', 
    name: 'GPT-4 Turbo', 
    provider: 'OpenAI',
    description: 'Fast and capable'
  },
  { 
    id: 'openai/gpt-4o', 
    name: 'GPT-4o', 
    provider: 'OpenAI',
    description: 'Latest GPT-4 variant'
  },
  { 
    id: 'google/gemini-pro-1.5', 
    name: 'Gemini Pro 1.5', 
    provider: 'Google',
    description: 'Large context window'
  },
  { 
    id: 'meta-llama/llama-3.1-70b-instruct', 
    name: 'Llama 3.1 70B', 
    provider: 'Meta',
    description: 'Open source, cost-effective'
  }
]