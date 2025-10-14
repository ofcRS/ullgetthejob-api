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

  async extractJobSkills(jobDescription: string): Promise<any> {
    const prompt = `
Extract technical requirements from this job description.

Job Description:
${jobDescription}

Categorize skills into:
1. REQUIRED (must-have skills)
2. PREFERRED (nice-to-have)
3. TOOLS (specific software/platforms)
4. FRAMEWORKS (React, Next.js, etc.)

Return JSON:
{
  "required": ["TypeScript", "React"],
  "preferred": ["GraphQL"],
  "tools": ["Docker", "Kubernetes"],
  "frameworks": ["Next.js", "NestJS"],
  "categories": {
    "frontend": ["React", "TypeScript"],
    "backend": ["Node.js", "PostgreSQL"],
    "devops": ["Docker", "Kubernetes"]
  }
}

Rules:
- Normalize names (e.g., "React.js" → "React")
- Exclude soft skills
- Include version numbers if specified
- Maximum 20 skills total
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
        max_tokens: 700
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content as string | undefined
    const jsonMatch = content?.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { required: [], preferred: [], tools: [], frameworks: [], categories: {} }
  }

  async customizeCV(
    originalCV: ParsedCV, 
    jobDescription: string,
    model?: string
  ): Promise<CustomizedCV> {
    const selectedModel = model || this.defaultModel
    
    const jobSkills = await this.extractJobSkills(jobDescription)

    const prompt = `
You are an expert CV optimizer. Transform this CV to maximize match with the job requirements.

CRITICAL RULES:
1. DO NOT invent experiences or skills not in the original CV
2. HEAVILY rewrite work experience descriptions to emphasize relevant achievements
3. Reorder ALL content by relevance to THIS specific job
4. Extract and quantify achievements (use metrics: "improved by X%", "managed Y users")
5. Match technical terminology from job description

ORIGINAL CV:
${JSON.stringify(originalCV, null, 2)}

JOB DESCRIPTION:
${jobDescription}

REQUIRED JOB SKILLS (extracted):
${Array.isArray(jobSkills) ? jobSkills.join(', ') : (jobSkills.required || []).join(', ')}

WORK EXPERIENCE TRANSFORMATION RULES:
- For EACH role, identify 3-5 accomplishments that match job requirements
- Rewrite using STAR method (Situation, Task, Action, Result)
- Include quantifiable metrics where possible
- Use action verbs: "Architected", "Engineered", "Optimized", "Designed"
- Emphasize relevant technologies and methodologies

SKILLS SECTION RULES:
- Prioritize skills that appear in BOTH CV and job description
- Group skills by category (Frontend, Backend, DevOps, etc.)
- Remove skills not relevant to this position
- Add proficiency indicators if present in original

Example transformation:
BEFORE: "Worked on authentication system"
AFTER: "Engineered OAuth2-based authentication system serving 1M+ users, reducing login time by 40% and improving security compliance"

Return ONLY valid JSON with this structure:
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "title": "string (tailored to job)",
  "summary": "string (2-3 sentences highlighting RELEVANT experience with METRICS)",
  "experience": "string (DETAILED, re-ordered by relevance, accomplishment-focused with metrics)",
  "education": "string",
  "skills": ["array", "prioritized", "by", "relevance"],
  "projects": "string (relevant projects re-ordered)",
  "matchedSkills": ["skills", "found", "in", "job"],
  "addedKeywords": ["job", "keywords", "naturally", "incorporated"]
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
          temperature: 0.25,
          max_tokens: 3000
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

      // Normalize optional arrays
      if (!Array.isArray(customizedData.matchedSkills)) customizedData.matchedSkills = []
      if (!Array.isArray(customizedData.addedKeywords)) customizedData.addedKeywords = []

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
      ? 'Russian' 
      : 'English'

    const telegramLine = (await import('../config/env')).env.TELEGRAM_HANDLE
      ? `Contact via telegram ${(await import('../config/env')).env.TELEGRAM_HANDLE}`
      : ''

    const prompt = `
Generate a compelling cover letter (150-250 words).

Language: ${languageInstruction}

Candidate Background:
- Name: ${cv.firstName || ''} ${cv.lastName || ''}
- Title: ${cv.title}
- Top Skills: ${cv.skills?.slice(0, 5).join(', ')}
- Key Experience: ${cv.experience?.substring(0, 500)}
- Matched Skills: ${(cv as any).matchedSkills?.join(', ')}

Job: ${jobDescription}
Company: ${companyInfo}

Structure:
1. Opening: Express enthusiasm and state 2-3 matching skills
2. Body: Highlight 1-2 specific achievements with METRICS that directly relate to job requirements
3. Closing: Express interest in contributing specific value

Tone: Professional but personable
Requirements:
- Use specific numbers and achievements
- Reference technologies from job description
- Keep under 250 words
- Natural, confident language
- No generic phrases like "team player" without context

${languageInstruction === 'Russian' ? 
  'Пишите естественно, как носитель русского языка. Избегайте клише.' :
  'Write naturally. Avoid clichés.'}
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
          temperature: 0.6,
          max_tokens: 800
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