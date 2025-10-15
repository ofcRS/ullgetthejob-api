# ⚡ UllGetTheJob API

> **Blazingly fast BFF (Backend For Frontend) powered by Bun + Elysia**  
> Type-safe REST API with AI-powered CV customization and real-time job updates

[![Bun](https://img.shields.io/badge/Bun-1.0+-black?logo=bun)](https://bun.sh)
[![Elysia](https://img.shields.io/badge/Elysia-1.0+-blue)](https://elysiajs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)

---

## 📖 Overview

The **UllGetTheJob API** is a high-performance Backend for Frontend service that bridges the gap between the SvelteKit frontend and the Phoenix Core backend. It provides:

- 📄 **CV Parsing** - Extract structured data from PDF/DOCX resumes
- 🤖 **AI Customization** - OpenRouter integration for CV optimization
- ✉️ **Cover Letter Generation** - Context-aware, personalized letters
- 🔗 **Core Proxy** - Seamless integration with Phoenix backend
- 🔌 **WebSocket Server** - Real-time job broadcasts
- 🎯 **Job Skill Extraction** - AI-powered requirement analysis

---

## 🏗️ Architecture
```
┌──────────────────────────────────────────────────────┐
│                  Elysia API (BFF)                     │
├──────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ CV Parser  │  │ AI Service │  │  Auth Proxy│    │
│  │  (Mammoth  │  │(OpenRouter)│  │  (to Core) │    │
│  │ pdf-parse) │  └────────────┘  └────────────┘    │
│  └────────────┘         │                │          │
│         │               │                │          │
│         └───────────────┴────────────────┘          │
│                         │                           │
│                ┌────────▼────────┐                  │
│                │ Storage Service  │                  │
│                │ (Drizzle + PG)  │                  │
│                └─────────────────┘                  │
└──────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   Phoenix Core                    SvelteKit
   (HH.ru ops)                     (Frontend)
```

---

## 🚀 Quick Start

### Prerequisites

- **Bun** 1.0+ ([install](https://bun.sh))
- **Node.js** 18+ (for compatibility)
- **PostgreSQL** 14+ (shared with Core)

### Installation
```bash
# Install dependencies
bun install
# or
pnpm install

# Start development server (with hot reload)
bun run dev

# Production mode
bun run start
```

Server runs at **http://localhost:3000** 🎉

### Verify Installation
```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","service":"UllGetTheJob API","features":[...]}
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file:
```bash
# Server
PORT=3000
NODE_ENV=development

# Database (same as Core)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ullget_dev"

# AI Services
OPENROUTER_API_KEY="sk-or-v1-..."  # Get from https://openrouter.ai

# Phoenix Core Integration
CORE_URL="http://localhost:4000"
ORCHESTRATOR_SECRET="shared_secret_between_core_and_api"

# Security
JWT_SECRET="your_jwt_secret_here"
JWT_EXPIRES_IN="7d"

# CORS
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174"

# File Upload
MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_DIR="./uploads"

# Optional: HH.ru OAuth (proxied from Core)
HH_ACCESS_TOKEN="optional_direct_token"

# Optional: Telegram notifications
TELEGRAM_HANDLE="@your_handle"
```

### Generate Secrets
```bash
# Generate JWT secret
openssl rand -hex 32

# Or use Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📡 API Endpoints

### Health & Info
```http
GET /api/health

Response:
{
  "status": "ok",
  "service": "UllGetTheJob API",
  "features": ["cv-parsing", "ai-customization", "job-fetching", "websocket"]
}
```

### CV Operations

#### Upload & Parse CV
```http
POST /api/cv/upload
Content-Type: multipart/form-data

Form Data:
  file: <pdf/docx file>
  clientId: <optional websocket client id>

Response:
{
  "success": true,
  "cv": {
    "firstName": "Alexander",
    "lastName": "Sakhatskii",
    "email": "a.sakhatski@gmail.com",
    "phone": "+86 0 99 44 86 737",
    "title": "Full Stack Engineer",
    "summary": "...",
    "experience": "...",
    "education": "...",
    "skills": ["TypeScript", "React", "Node.js", ...],
    "fullText": "..."
  },
  "id": "uuid"
}
```

#### Import from HH.ru
```http
POST /api/cv/import/hh/:resume_id

Response:
{
  "success": true,
  "cv": { /* parsed CV object */ },
  "id": "uuid"
}
```

#### List Uploaded CVs
```http
GET /api/cv

Response:
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "originalFilename": "resume.pdf",
      "createdAt": "2025-10-15T10:30:00Z"
    },
    ...
  ]
}
```

#### Get CV by ID
```http
GET /api/cv/:id

Response:
{
  "success": true,
  "cv": { /* full CV object */ }
}
```

### AI Customization

#### Customize CV for Job
```http
POST /api/cv/customize
Content-Type: application/json

{
  "cv": { /* original CV object */ },
  "jobDescription": "We are looking for a Full Stack Developer...",
  "model": "anthropic/claude-3.5-sonnet"  // optional
}

Response:
{
  "success": true,
  "customizedCV": {
    "firstName": "Alexander",
    "lastName": "Sakhatskii",
    "title": "Full Stack Engineer (React/Node.js Specialist)",
    "summary": "Full Stack Engineer with 5+ years optimizing React apps...",
    "experience": "• Engineered OAuth2 system serving 1M+ users...",
    "skills": ["React", "Node.js", "TypeScript", ...],
    "matchedSkills": ["React", "TypeScript"],
    "addedKeywords": ["microservices", "OAuth2"]
  },
  "coverLetter": "Dear Hiring Manager,\n\nI am writing to express...",
  "modelUsed": "anthropic/claude-3.5-sonnet",
  "jobSkills": {
    "required": ["React", "TypeScript", "Node.js"],
    "preferred": ["GraphQL", "Docker"],
    "tools": ["Git", "VS Code"],
    "frameworks": ["Next.js", "Express"],
    "categories": {
      "frontend": ["React", "TypeScript"],
      "backend": ["Node.js", "PostgreSQL"]
    }
  }
}
```

### Job Search (Proxy to Core)
```http
POST /api/jobs/search
Content-Type: application/json

{
  "text": "JavaScript Developer",
  "area": "1",  // Moscow
  "experience": "between1And3",
  "employment": "full",
  "schedule": "remote"
}

Response:
{
  "success": true,
  "jobs": [
    {
      "id": "12345",
      "hh_vacancy_id": "12345",
      "title": "Senior JavaScript Developer",
      "company": "Tech Corp",
      "salary": "200000-300000 RUB",
      "area": "Moscow",
      "description": "...",
      "url": "https://hh.ru/vacancy/12345",
      "skills": ["JavaScript", "React", "Node.js"],
      "has_test": false
    },
    ...
  ],
  "total": 42
}
```

### Application Submission (Proxy to Core)
```http
POST /api/application/submit
Content-Type: application/json

{
  "jobExternalId": "12345",
  "customizedCV": { /* customized CV object */ },
  "coverLetter": "Dear Hiring Manager..."
}

Response:
{
  "success": true,
  "result": {
    "resume_id": "uuid",
    "negotiation_id": "uuid",
    "submitted_at": "2025-10-15T10:30:00Z"
  },
  "message": "Application submitted successfully!"
}
```

### AI Model Selection
```http
GET /api/models

Response:
{
  "success": true,
  "models": [
    {
      "id": "anthropic/claude-3.5-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "Anthropic",
      "description": "Best balance of quality and speed"
    },
    {
      "id": "openai/gpt-4-turbo",
      "name": "GPT-4 Turbo",
      "provider": "OpenAI",
      "description": "Fast and capable"
    },
    ...
  ]
}
```

### Authentication Proxy (to Core)
```http
# Initiate HH.ru OAuth
GET /api/auth/hh/login
Response: { "url": "https://hh.ru/oauth/...", "state": "..." }

# OAuth Callback
GET /api/auth/hh/callback?code=AUTH_CODE
Response: { "success": true, "tokens": { ... } }

# Check Connection Status
GET /api/auth/hh/status
Response: { "connected": false }  # MVP: always false

# List HH.ru Resumes
GET /api/hh/resumes
Response: { "success": true, "items": [...] }

# Get Resume Details
GET /api/hh/resumes/:id
Response: { "success": true, "resume": { ... } }
```

---

## 🔌 WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/ws')

ws.onopen = () => {
  // Register with unique client ID
  ws.send(JSON.stringify({ 
    type: 'register', 
    clientId: crypto.randomUUID() 
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch(data.type) {
    case 'connected':
      console.log('WebSocket connected')
      break
      
    case 'registered':
      console.log('Client registered:', data.clientId)
      break
      
    case 'new_jobs':
      console.log('New jobs:', data.jobs)
      // Update UI with job listings
      break
      
    case 'cv_progress':
      console.log('CV parsing stage:', data.stage)
      // Update progress indicator
      break
  }
}
```

### Subscribe to Job Updates
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  searchParams: {
    text: 'JavaScript',
    area: '1'
  }
}))
```

### Broadcast Endpoint (for Core)
```http
POST /api/v1/jobs/broadcast
Content-Type: application/json
X-Core-Secret: <orchestrator_secret>

{
  "jobs": [
    { "id": "1", "title": "Senior Dev", ... },
    { "id": "2", "title": "Lead Engineer", ... }
  ],
  "stats": {
    "total": 42,
    "broadcasted": 2,
    "source": "hh.ru"
  }
}

Response:
{
  "ok": true,
  "delivered": 3  // number of connected clients
}
```

---

## 🤖 AI Service Details

### OpenRouter Integration

The AI service uses [OpenRouter](https://openrouter.ai) for model flexibility:

**Supported Models:**
- Claude 3.5 Sonnet (default, best quality)
- Claude 3 Opus (highest quality, slower)
- GPT-4 Turbo (fast)
- GPT-4o (latest)
- Gemini Pro 1.5 (large context)
- Llama 3.1 70B (cost-effective)

**Capabilities:**
1. **CV Customization**: Rewrites work experience, prioritizes skills
2. **Cover Letter Generation**: Context-aware, professional tone
3. **Skill Extraction**: Categorizes job requirements
4. **Language Detection**: Supports English & Russian

### Customization Strategy
```typescript
// Simplified flow:
1. Extract job skills (structured JSON)
2. Analyze candidate CV
3. Reorder/rewrite experience by relevance
4. Add metrics and quantifiable achievements
5. Match terminology from job description
6. Generate skill match percentage
```

---

## 💾 Database Integration

### Drizzle ORM

**Important:** This service does **NOT** run migrations. Schema is managed by Phoenix Core.
```typescript
// Read-only operations:
import { db } from './db/client'
import { parsedCvs } from './db/schema'

// Save parsed CV
await db.insert(parsedCvs).values({
  userId: null,  // MVP: no auth
  firstName: 'Alexander',
  lastName: 'Sakhatskii',
  // ...
})

// Query CVs
const cvs = await db.select().from(parsedCvs).limit(20)
```

### Schema Introspection
```bash
# Update types from database (if Core changed schema)
bun run db:introspect
```

---

## 📁 Project Structure
```
src/
├── app.ts                      # Main Elysia application
├── index.ts                    # Entry point
├── config/
│   └── env.ts                  # Environment validation
├── db/
│   ├── client.ts               # Drizzle connection
│   └── schema.ts               # Database types (from Core)
├── services/
│   ├── cv-parser.service.ts    # PDF/DOCX parsing + AI
│   ├── ai.service.ts           # OpenRouter integration
│   ├── storage.service.ts      # Database operations
│   ├── openrouter.service.ts   # Model catalog
│   └── realtime.service.ts     # WebSocket registry
├── routes/
│   ├── health.routes.ts        # Health check
│   ├── model.routes.ts         # AI model listing
│   ├── cv.routes.ts            # CV upload/customize
│   ├── job.routes.ts           # Job search
│   ├── application.routes.ts   # Application submit
│   ├── auth.routes.ts          # OAuth proxy
│   └── ws.routes.ts            # WebSocket server
├── middleware/
│   └── error-handler.ts        # Global error handling
└── utils/
    └── file-upload.ts          # File validation
```

---

## 🧪 Testing
```bash
# Run tests (if implemented)
bun test

# Type checking
bun run check

# Lint
bun run lint
```

---

## 🔒 Security Notes

### Current Implementation (MVP)

- ✅ CORS configured
- ✅ File type validation
- ✅ File size limits
- ⚠️ No authentication (proxied from Core)
- ⚠️ No rate limiting (delegated to Core)

### Production Checklist

- [ ] Add JWT validation
- [ ] Implement request signing
- [ ] Add rate limiting middleware
- [ ] Sanitize file uploads (virus scan)
- [ ] Enable HTTPS/TLS
- [ ] Add request logging
- [ ] Implement API key rotation

---

## 🚀 Deployment

### Docker
```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://..."
OPENROUTER_API_KEY="sk-or-..."
CORE_URL="https://core.yourdomain.com"
ORCHESTRATOR_SECRET="<strong-secret>"
ALLOWED_ORIGINS="https://yourdomain.com"
```

---

## 🤝 Integration Examples

### Frontend (SvelteKit)
```typescript
// src/lib/api/cv.api.ts
const API_URL = import.meta.env.VITE_API_URL

export async function uploadCv(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${API_URL}/api/cv/upload`, {
    method: 'POST',
    body: formData
  })
  
  return await res.json()
}
```

### Phoenix Core

Core broadcasts jobs to this API's `/api/v1/jobs/broadcast` endpoint:
```elixir
# lib/core/broadcaster.ex
def broadcast_jobs(jobs, stats) do
  Req.post(
    "#{@api_base_url}/api/v1/jobs/broadcast",
    json: %{jobs: jobs, stats: stats},
    headers: [{"X-Core-Secret", @api_secret}]
  )
end
```

---

## 📖 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Elysia Documentation](https://elysiajs.com)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Drizzle ORM](https://orm.drizzle.team)

---

## 📄 License

MIT License © 2025 Aleksandr Sakhatskii

---

<div align="center">
  <strong>Built with ⚡ and Bun</strong>
  <br>
  <sub>Because speed matters</sub>
</div>