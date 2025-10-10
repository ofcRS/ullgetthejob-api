# 🚀 UllGetTheJob API

> **Blazingly fast Bun + Elysia REST API** ⚡  
> High-performance API service for job application management with document parsing & JWT auth!

---

## ✨ What's This?

**UllGetTheJob API** is a modern, type-safe REST API built with cutting-edge technologies. This service handles:

- 📄 **Document parsing** (PDF, DOCX) for resume processing
- 🔐 **JWT authentication** with secure token management
- 🗄️ **PostgreSQL database** with Drizzle ORM
- 🎯 **Type-safe** with TypeScript & Zod validation
- ⚡ **Blazingly fast** powered by Bun runtime
- 🌐 **CORS-enabled** for seamless frontend integration

---

## 🛠️ Tech Stack

- **Bun** - Ultra-fast JavaScript runtime
- **Elysia** - Ergonomic web framework with end-to-end type safety
- **TypeScript** - Type-safe development
- **Drizzle ORM** - Lightweight & performant ORM
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

# Generate database schema
bun run db:generate

# Run migrations
bun run db:migrate

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

# Generate Drizzle schema
bun run db:generate

# Run database migrations
bun run db:migrate

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
DATABASE_URL=postgresql://user:password@localhost:5432/ullgetthejob
JWT_SECRET=your-secret-key
PORT=3000
```

### Database Management

```bash
# Generate migration files
bun run db:generate

# Apply migrations
bun run db:migrate
```

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

