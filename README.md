# 🚀 UllGetTheJob API

> **Blazingly fast Bun + Elysia BFF (Backend For Frontend)** ⚡  
> REST API service that proxies to Phoenix Core for HH.ru operations

---

## ✨ What's This?

**UllGetTheJob API** is a modern, type-safe REST API built with cutting-edge technologies. This service handles:

- 📄 **Document parsing** (PDF, DOCX) for resume processing
- 🔐 **JWT authentication** with secure token management
- 🗄️ **PostgreSQL database** (schema managed by Phoenix Core)
- 🎯 **Type-safe** with TypeScript & Zod validation
- ⚡ **Blazingly fast** powered by Bun runtime
- 🌐 **CORS-enabled** for seamless frontend integration

---

## 🛠️ Tech Stack

- **Bun** - Ultra-fast JavaScript runtime
- **Elysia** - Ergonomic web framework with end-to-end type safety
- **TypeScript** - Type-safe development
- **Drizzle ORM** - Lightweight ORM (introspection only; no migrations here)
- **PostgreSQL** - Robust relational database
- **Zod** - Schema validation
- **JWT** - Secure authentication
- **bcrypt** - Password hashing
- **Mammoth** - DOCX parsing
- **pdf-parse** - PDF parsing

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (latest version)
- PostgreSQL database
- Node.js (for pnpm compatibility)

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

- ✅ **RESTful endpoints** for job application CRUD
- ✅ **JWT authentication** with secure token handling
- ✅ **Resume parsing** from PDF/DOCX files
- ✅ **Type-safe** request/response validation
- ✅ **CORS support** for cross-origin requests
- ✅ **Database migrations** with Drizzle Kit

---

## 🧪 Development

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=postgresql://postgres:1@localhost:5432/ullget
CORE_URL=http://localhost:4000
ORCHESTRATOR_SECRET=shared_secret_between_core_and_api
JWT_SECRET=your_jwt_secret
OPENROUTER_API_KEY=your_openrouter_key
```

### Important Notes

⚠️ Do NOT run Drizzle migrations. Phoenix Core manages the database schema.

⚠️ Do NOT integrate with HH.ru directly. Use Phoenix Core API endpoints.

---

## 📖 Learn More

- [Bun Documentation](https://bun.sh/docs)
- [Elysia Documentation](https://elysiajs.com)
- [Drizzle ORM](https://orm.drizzle.team)
- [TypeScript](https://www.typescriptlang.org)

---

## 📄 License

MIT License - Copyright (c) 2025 Aleksandr Sakhatskiy

---

<div align="center">
  Built with ⚡ and Bun
</div>

