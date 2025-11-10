# Enhanced AI Features Documentation

## Overview

The UllGetTheJob API now includes advanced AI-powered features for CV customization, interview preparation, company culture analysis, and real-time suggestions. All features leverage OpenRouter for multi-model AI capabilities.

## Table of Contents

- [Multi-Stage CV Customization](#multi-stage-cv-customization)
- [Cover Letter Variations](#cover-letter-variations)
- [Multi-Model Skills Consensus](#multi-model-skills-consensus)
- [Interview Preparation](#interview-preparation)
- [Company Culture Analysis](#company-culture-analysis)
- [Real-Time AI Suggestions](#real-time-ai-suggestions)
- [WebSocket Events](#websocket-events)
- [API Endpoints](#api-endpoints)

---

## Multi-Stage CV Customization

A three-stage pipeline that analyzes, optimizes, and validates CV customization for specific job applications.

### Stages

#### 1. Analysis Stage
- Analyzes CV against job requirements
- Identifies strengths and weaknesses
- Calculates relevance score (0-100)
- Detects missing keywords
- Provides specific improvement suggestions

#### 2. Optimization Stage
- Rewrites content using STAR method (Situation, Task, Action, Result)
- Adds quantifiable metrics to achievements
- Reorders content by relevance
- Incorporates job keywords naturally
- Emphasizes matching skills

#### 3. Validation Stage
- Validates completeness and quality
- Checks grammar and professionalism
- Verifies keyword optimization
- Calculates quality score (0-100)
- Provides warnings and error feedback

### API Endpoint

```
POST /api/ai/cv/customize-multistage
```

**Request Body:**
```json
{
  "cvId": "uuid",
  "jobDescription": "Full job description text (min 50 chars)",
  "companyInfo": "Company name and details",
  "model": "anthropic/claude-3.5-sonnet" // optional
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "analysis": {
      "strengths": ["Matching strengths"],
      "weaknesses": ["Gaps to address"],
      "relevanceScore": 75,
      "missingKeywords": ["keyword1", "keyword2"],
      "suggestions": ["Improvement recommendations"]
    },
    "optimization": {
      "customizedCV": { /* customized CV object */ },
      "changesApplied": ["List of changes made"],
      "metricsAdded": 8
    },
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": ["Minor suggestions"],
      "qualityScore": 85
    },
    "finalCV": { /* final customized CV */ },
    "coverLetterVariations": ["variation1", "variation2", ...]
  }
}
```

---

## Cover Letter Variations

Generate multiple cover letter styles for the same job to choose the best fit.

### Available Styles

1. **Professional** - Formal business tone, traditional structure
2. **Enthusiastic** - Shows genuine excitement and passion
3. **Technical** - Heavy focus on technical skills and terminology
4. **Concise** - Maximum impact with minimum words
5. **Creative** - Unique approach with personality

### API Endpoint

```
POST /api/ai/cover-letter/variations
```

**Request Body:**
```json
{
  "customizedCV": {
    "firstName": "John",
    "lastName": "Doe",
    "title": "Senior Software Engineer",
    "skills": ["TypeScript", "React", "Node.js"],
    "summary": "...",
    "matchedSkills": ["TypeScript", "React"]
  },
  "jobDescription": "Full job description",
  "companyInfo": "Company name",
  "model": "anthropic/claude-3.5-sonnet" // optional
}
```

**Response:**
```json
{
  "success": true,
  "variations": [
    {
      "id": "variation-1",
      "style": "professional",
      "content": "Dear Hiring Manager...",
      "wordCount": 220
    },
    {
      "id": "variation-2",
      "style": "enthusiastic",
      "content": "I'm thrilled to apply...",
      "wordCount": 215
    }
    // ... 3 more variations
  ]
}
```

---

## Multi-Model Skills Consensus

Extract job skills using consensus from multiple AI models for higher accuracy.

### Models Used

1. **Claude 3.5 Sonnet** (weight: 1.0)
2. **GPT-4o** (weight: 0.9)
3. **Gemini Pro 1.5** (weight: 0.85)

### Consensus Algorithm

- Skills must appear in responses from majority of models (weighted)
- Calculates confidence score using Jaccard similarity
- Identifies disagreements between models
- Categorizes skills by type (required, preferred, tools, frameworks)

### API Endpoint

```
POST /api/ai/skills/consensus
```

**Request Body:**
```json
{
  "jobDescription": "Full job description (min 50 chars)"
}
```

**Response:**
```json
{
  "success": true,
  "consensus": {
    "required": ["TypeScript", "React", "Node.js"],
    "preferred": ["GraphQL", "Docker"],
    "tools": ["Git", "VS Code"],
    "frameworks": ["Next.js", "Express"],
    "categories": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "Express"],
      "devops": ["Docker"]
    }
  },
  "confidence": 87.5,
  "modelResponses": [
    {
      "model": "anthropic/claude-3.5-sonnet",
      "response": { /* skills extracted */ },
      "weight": 1.0
    }
    // ... other models
  ],
  "disagreements": [
    "\"kubernetes\" (only identified by google/gemini-pro-1.5)"
  ]
}
```

---

## Interview Preparation

Generate comprehensive interview preparation with STAR-formatted responses based on your CV.

### Includes

1. **Common Questions** (5-7) - General interview questions with STAR responses
2. **Technical Questions** (5-7) - Role-specific technical questions with detailed answers
3. **Behavioral Questions** (5-7) - Situational questions with STAR responses
4. **Company-Specific Questions** (3-5) - Questions to ask the interviewer

### STAR Method

- **Situation** - Context and background
- **Task** - Challenge or goal
- **Action** - Steps taken with details
- **Result** - Outcome with metrics

### API Endpoint

```
POST /api/ai/interview/prepare
```

**Request Body:**
```json
{
  "cvId": "uuid",
  "jobDescription": "Full job description",
  "companyInfo": "Company name and details",
  "model": "anthropic/claude-3.5-sonnet" // optional
}
```

**Response:**
```json
{
  "success": true,
  "preparation": {
    "commonQuestions": [
      {
        "question": "Tell me about yourself",
        "starResponse": {
          "situation": "Context",
          "task": "What needed to be done",
          "action": "Steps you took",
          "result": "Outcome with metrics",
          "fullResponse": "Complete 2-3 minute response"
        },
        "tips": ["Keep it under 2 minutes", "Focus on relevant experience"]
      }
    ],
    "technicalQuestions": [
      {
        "topic": "React Performance",
        "question": "How do you optimize React applications?",
        "answer": "Detailed technical answer",
        "followUp": ["Follow-up questions"]
      }
    ],
    "behavioralQuestions": [
      {
        "question": "Describe a challenging project",
        "starResponse": { /* STAR format */ }
      }
    ],
    "companySpecificQuestions": [
      "What are the team's biggest challenges?",
      "How do you measure success in this role?"
    ]
  }
}
```

---

## Company Culture Analysis

Analyze company culture and detect red flags from job descriptions, company info, and reviews.

### Red Flag Categories

1. **Work-Life Balance** - Overtime, burnout indicators
2. **Management** - Micromanagement, unclear expectations
3. **Compensation** - Below market, unclear benefits
4. **Growth** - Limited advancement, no training
5. **Values** - Ethical concerns, toxic culture
6. **Stability** - High turnover, financial issues

### Severity Levels

- **Low** - Minor concern, monitor
- **Medium** - Notable concern, investigate
- **High** - Significant concern, be cautious
- **Critical** - Major red flag, likely dealbreaker

### API Endpoint

```
POST /api/ai/company/analyze
```

**Request Body:**
```json
{
  "jobDescription": "Full job description",
  "companyInfo": "Company details",
  "companyReviews": "Employee reviews (optional)",
  "model": "anthropic/claude-3.5-sonnet" // optional
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "overallScore": 65,
    "positiveSignals": [
      "Mentions professional development",
      "Clear compensation structure"
    ],
    "redFlags": [
      {
        "category": "work-life-balance",
        "severity": "high",
        "indicator": "Fast-paced environment",
        "explanation": "Often indicates overwork expectations",
        "evidence": "Quote from job description"
      }
    ],
    "workLifeBalance": {
      "score": 55,
      "indicators": ["Long hours mentioned", "No WFH policy"]
    },
    "growthOpportunities": {
      "score": 75,
      "indicators": ["Training budget", "Career path mentioned"]
    },
    "managementQuality": {
      "score": 70,
      "indicators": ["Flat structure", "Regular 1-on-1s"]
    },
    "compensationFairness": {
      "score": 60,
      "indicators": ["'Competitive salary' (vague)"]
    },
    "recommendation": "proceed-with-caution",
    "reasoning": "Several work-life balance concerns, but good growth opportunities"
  }
}
```

### Recommendations

- **strongly-recommended** (Score 80+) - Excellent culture indicators
- **recommended** (Score 65-79) - Generally positive with minor concerns
- **proceed-with-caution** (Score 50-64) - Notable concerns, investigate further
- **not-recommended** (Score <50) - Multiple critical red flags

---

## Real-Time AI Suggestions

Get actionable suggestions for job applications based on CV match and job details.

### Suggestion Types

1. **cv-improvement** - Specific CV customization recommendations
2. **cover-letter-tip** - Cover letter writing advice
3. **skill-highlight** - Which skills to emphasize
4. **application-timing** - Best time to apply
5. **follow-up** - Follow-up strategies

### Priority Levels

- **high** - Critical for success, act immediately
- **medium** - Important, should address soon
- **low** - Nice to have, optional

### API Endpoint

```
POST /api/ai/suggestions/realtime
```

**Request Body:**
```json
{
  "cvId": "uuid",
  "job": {
    "title": "Senior Software Engineer",
    "description": "Full job description",
    "company": "TechCorp"
  },
  "matchScore": 75
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": {
    "jobId": "Senior Software Engineer",
    "suggestions": [
      {
        "type": "cv-improvement",
        "priority": "high",
        "message": "Add more React projects to match job requirements",
        "actionable": true,
        "action": "Update projects section with React work"
      },
      {
        "type": "application-timing",
        "priority": "medium",
        "message": "Apply within 24 hours - job posted recently",
        "actionable": true,
        "action": "Submit application today"
      }
    ],
    "matchScore": 75,
    "estimatedApplicationTime": "10-15 minutes"
  }
}
```

---

## WebSocket Events

Real-time updates are pushed via WebSocket connections.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws')

// Register client for targeted messages
ws.send(JSON.stringify({
  type: 'register',
  clientId: 'unique-client-id'
}))
```

### Event Types

#### 1. AI Suggestions
```json
{
  "type": "ai_suggestions",
  "suggestions": [
    {
      "type": "cv-improvement",
      "priority": "high",
      "message": "...",
      "actionable": true,
      "action": "..."
    }
  ],
  "jobId": "job-title",
  "matchScore": 75,
  "estimatedTime": "10-15 minutes",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

#### 2. Customization Progress
```json
{
  "type": "customization_progress",
  "stage": "analysis|optimization|validation|cover-letters",
  "progress": 50,
  "data": { /* stage-specific data */ },
  "timestamp": "2025-11-10T12:00:00Z"
}
```

#### 3. Interview Prep Ready
```json
{
  "type": "interview_prep_ready",
  "jobTitle": "Senior Software Engineer",
  "questionsCount": 18,
  "timestamp": "2025-11-10T12:00:00Z"
}
```

#### 4. Culture Analysis Ready
```json
{
  "type": "culture_analysis_ready",
  "companyName": "TechCorp",
  "overallScore": 75,
  "recommendation": "recommended",
  "redFlagsCount": 2,
  "timestamp": "2025-11-10T12:00:00Z"
}
```

---

## API Endpoints Summary

### Enhanced AI Routes

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/ai/cv/customize-multistage` | POST | Multi-stage CV customization | Required |
| `/api/ai/cover-letter/variations` | POST | Generate cover letter variations | Required |
| `/api/ai/skills/consensus` | POST | Multi-model skills extraction | Required |
| `/api/ai/interview/prepare` | POST | Interview preparation with STAR | Required |
| `/api/ai/company/analyze` | POST | Company culture analysis | Required |
| `/api/ai/suggestions/realtime` | POST | Real-time application suggestions | Required |
| `/api/ai/capabilities` | GET | List available AI capabilities | Required |

### WebSocket Routes

| Endpoint | Type | Description | Auth |
|----------|------|-------------|------|
| `/ws` | WebSocket | Real-time updates connection | Session-based |
| `/api/ws/stats` | GET | WebSocket connection statistics | None |

---

## Usage Examples

### Complete Job Application Flow

```javascript
// 1. Upload CV
const cvResponse = await fetch('/api/cv/upload', {
  method: 'POST',
  body: formData
})
const { id: cvId } = await cvResponse.json()

// 2. Get multi-model skills consensus
const skillsResponse = await fetch('/api/ai/skills/consensus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobDescription })
})
const { consensus, confidence } = await skillsResponse.json()

// 3. Perform multi-stage customization
const customResponse = await fetch('/api/ai/cv/customize-multistage', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cvId,
    jobDescription,
    companyInfo: 'TechCorp - Leading Tech Company'
  })
})
const { result } = await customResponse.json()

// 4. Analyze company culture
const cultureResponse = await fetch('/api/ai/company/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobDescription,
    companyInfo: 'TechCorp',
    companyReviews: '...' // from Glassdoor, etc.
  })
})
const { analysis } = await cultureResponse.json()

// 5. Prepare for interview
const interviewResponse = await fetch('/api/ai/interview/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cvId,
    jobDescription,
    companyInfo: 'TechCorp'
  })
})
const { preparation } = await interviewResponse.json()

// 6. Get real-time suggestions
const suggestionsResponse = await fetch('/api/ai/suggestions/realtime', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cvId,
    job: {
      title: 'Senior Software Engineer',
      description: jobDescription,
      company: 'TechCorp'
    },
    matchScore: result.analysis.relevanceScore
  })
})
const { suggestions } = await suggestionsResponse.json()

// 7. Choose best cover letter and apply
const coverLetter = result.coverLetterVariations[0] // or let user choose
await fetch('/api/application/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobExternalId,
    customizedCV: result.finalCV,
    coverLetter
  })
})
```

---

## Best Practices

### 1. Caching
- Skills extraction results are cached for 24 hours
- Reuse consensus results for multiple CVs targeting the same job

### 2. Model Selection
- **Claude 3.5 Sonnet** (default) - Best balance of quality and speed
- **Claude 3 Opus** - Highest quality for critical applications
- **GPT-4o** - Fast alternative with good results
- **Gemini Pro 1.5** - Large context window for long job descriptions

### 3. Error Handling
- All AI endpoints include fallback responses
- Network errors are retried with exponential backoff
- Graceful degradation when AI services are unavailable

### 4. Rate Limiting
- Consider API costs when calling multiple models
- Use consensus extraction judiciously
- Cache results when possible

### 5. Security
- All endpoints require authentication
- Input sanitization prevents prompt injection
- Text length validation enforced
- User ownership verified for CV access

---

## Configuration

### Environment Variables

```bash
# OpenRouter API Key (required)
OPENROUTER_API_KEY=your_api_key_here

# Default model (optional)
DEFAULT_AI_MODEL=anthropic/claude-3.5-sonnet

# Max concurrent AI requests (optional)
MAX_AI_CONCURRENCY=5
```

### Model Configuration

Models are configured in `src/services/ai.service.ts`:

```typescript
const models = [
  { id: 'anthropic/claude-3.5-sonnet', weight: 1.0 },
  { id: 'openai/gpt-4o', weight: 0.9 },
  { id: 'google/gemini-pro-1.5', weight: 0.85 }
]
```

---

## Performance Considerations

### Response Times

- **Skills Extraction** (single model): 2-5 seconds
- **Skills Consensus** (3 models): 5-10 seconds
- **CV Customization** (single stage): 3-7 seconds
- **Multi-Stage Customization**: 15-25 seconds
- **Cover Letter Variations**: 10-15 seconds
- **Interview Preparation**: 8-12 seconds
- **Culture Analysis**: 5-8 seconds

### Optimization Tips

1. Use WebSocket for real-time progress updates
2. Cache skills extraction results
3. Run culture analysis in parallel with customization
4. Generate interview prep asynchronously
5. Pre-extract skills before batch operations

---

## Troubleshooting

### Common Issues

1. **"No response from AI service"**
   - Check OpenRouter API key
   - Verify network connectivity
   - Check API rate limits

2. **"Multi-stage customization failed"**
   - Ensure CV ID exists and belongs to user
   - Verify job description is at least 50 characters
   - Check model availability

3. **Low confidence in skills consensus**
   - Job description may be too vague
   - Consider using single-model extraction
   - Manually review and adjust results

4. **WebSocket disconnections**
   - Implement ping/pong for keep-alive
   - Handle reconnection logic
   - Validate session tokens

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/ofcRS/ullgetthejob-api/issues
- Email: support@ullgetthejob.com
- Documentation: https://docs.ullgetthejob.com

---

## Changelog

### Version 1.0.0 (2025-11-10)

**Added:**
- Multi-stage CV customization pipeline
- Cover letter variations (5 styles)
- Multi-model skills consensus extraction
- Interview preparation with STAR responses
- Company culture analyzer with red flag detection
- Real-time AI suggestions via WebSocket
- Enhanced WebSocket broadcasting
- Comprehensive API documentation

**Improved:**
- CV customization now uses STAR method
- Skills extraction with consensus algorithm
- Real-time progress updates for long operations
- Error handling and fallback responses

**Security:**
- Input sanitization for all AI endpoints
- Prompt injection prevention
- User ownership verification
- Rate limiting awareness
