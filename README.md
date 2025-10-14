# 🚀 UllGetTheJob API

> **Blazingly fast Bun + Elysia BFF (Backend For Frontend)** ⚡  
> REST API service that proxies to Phoenix Core for HH.ru operations

---

## ✨ What's This?

**UllGetTheJob API** is a modern, type-safe REST API built with cutting-edge technologies. This service handles:

- 📄 **Document parsing** (PDF, DOCX) for resume processing
- 🔐 **JWT authentication** with secure token management
- 🗄️ **PostgreSQL database** (schema managed by Phoenix Core)
- 🤖 **AI services** (CV customization, cover letters, skills extraction)
- 🔗 **Proxy to Core** for HH.ru OAuth and job operations

---

## 🛠️ Tech Stack

- **Bun** - Ultra-fast JavaScript runtime
- **Elysia** - Ergonomic web framework with end-to-end type safety
- **TypeScript** - Type-safe development
- **Drizzle ORM** - Lightweight ORM (introspection only; no migrations here)
- **PostgreSQL** - Robust relational database
- **Zod** - Schema validation
- **JWT** - Secure authentication
- **Mammoth** - DOCX parsing
- **pdf-parse** - PDF parsing

---

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
pnpm install
# or
bun install

# Start development server (hot reload)
bun run dev

# Or start production server
bun run start
```

---

## 📚 Available Scripts

```bash
# Development with hot reload
bun run dev

# Production start
bun run start

# Introspect DB (if needed for types)
bun run db:introspect

# Install dependencies
pnpm install
```

---

## 🏗️ Project Structure

```
src/
├── app.ts           # Elysia app configuration
├── index.ts         # Entry point
├── config/          # Configuration files
├── db/              # Database schemas & migrations
├── middleware/      # Auth & request middleware
├── routes/          # API route handlers
├── services/        # Business logic layer
├── utils/           # Helper utilities
└── workers/         # Background jobs
```

---

## 🔌 API Features

- ✅ **RESTful endpoints** for CV upload/customization/application
- ✅ **AI prompts** improved for customization and cover letters
- ✅ **Skills extraction** now returns structured categories
- ✅ **CORS support** for cross-origin requests
- ✅ **Core proxy** for OAuth login

### OAuth Routes (proxy -> Core)
- GET `/api/auth/hh/login` → `{ url, state }`
- GET `/api/auth/hh/status` → connection status (MVP: false)
- GET `/api/hh/resumes` → placeholder (to be implemented)

Env vars:
```
CORE_URL=http://localhost:4000
ORCHESTRATOR_SECRET=shared_secret_between_core_and_api
OPENROUTER_API_KEY=your_openrouter_key
```

---

## 🧪 Development

- Do NOT run Drizzle migrations for shared tables; Core owns schema
- Use `OPENROUTER_API_KEY` for AI services
- CORS origins configured via `ALLOWED_ORIGINS`

---

## 📖 Learn More

- Bun Documentation
- Elysia Documentation
- Drizzle ORM
- TypeScript

---

## 📄 License

MIT License © 2025 Aleksandr Sakhatskiy

---

<div align="center">
  Built with ⚡ and Bun
</div>

