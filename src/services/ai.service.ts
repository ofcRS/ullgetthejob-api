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

  async extractJobSkills(jobDescription: string): Promise<string[]> {
    const prompt = `
Extract ONLY technical skills and tools mentioned in this job description.

Job Description:
${jobDescription}

Return a JSON array of strings. Each skill should be:
- A specific technology, tool, or technical skill
- Normalized (e.g., "React.js" → "React", "PostgreSQL" → "PostgreSQL")
- No soft skills (exclude: "teamwork", "communication", etc.)
- Maximum 15 skills

Example: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker"]

Return ONLY the JSON array, nothing else.
`

    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ullgetthejob.com',
        'X-Title': 'UllGetTheJob Skill Extractor'
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content as string | undefined
    const jsonMatch = content?.match(/\[[\s\S]*\]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  }

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
3. Rewrite experience bullets to emphasize achievements matching job requirements
4. Extract and prioritize skills mentioned in job description
5. Reorder experience to show most relevant first

For experience section:
- Keep factual details (dates, companies, titles)
- Rewrite achievement bullets to highlight relevant aspects
- Use action verbs and quantify results
- Maximum 4-5 bullets per role, prioritize relevant ones

Return ONLY valid JSON (no markdown) with this structure:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "email": "string",
  "phone": "string or null",
  "title": "string (professional title)",
  "summary": "string (2-3 sentences highlighting experience relevant to THIS job)",
  "experience": "string (detailed, re-ordered and re-written to emphasize relevant projects and achievements)",
  "education": "string",
  "skills": ["array", "of", "skills", "from", "original", "CV", "prioritized", "by", "relevance"],
  "projects": "string (relevant projects, re-ordered by relevance)"
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
    
    const languageInstruction = /\b(требования|обязанности|опыт|знание|россии|москва|руб|hh\.ru)\b/i.test(jobDescription) 
      ? 'Write in Russian language' 
      : 'Write in English language'

    const telegramLine = (await import('../config/env')).env.TELEGRAM_HANDLE
      ? `Contact via telegram ${(await import('../config/env')).env.TELEGRAM_HANDLE}`
      : ''

    const prompt = `
${languageInstruction}

Generate a concise, professional cover letter (150-200 words maximum).

Format (EXACTLY):
${languageInstruction.includes('Russian') ? `
Здравствуйте, мой опыт и технические навыки идеально подходят под эту позицию. [2-3 specific skills matching job]. [1-2 relevant achievements]. ${telegramLine}
` : `
Hello, my experience and technical skills are a perfect fit for this position. [2-3 specific skills matching job]. [1-2 relevant achievements]. I'd be happy to discuss details ${telegramLine || 'via telegram'}
`}

Candidate:
- Skills: ${cv.skills?.join(', ')}
- Title: ${cv.title}
- Experience: ${cv.experience}

Job Description:
${jobDescription}

Company: ${companyInfo}

Requirements:
- Match tone to job language
- Highlight 2-3 skills that appear in BOTH CV and job description
- Be specific about relevant experience
- Keep under 200 words
- Professional but friendly tone
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