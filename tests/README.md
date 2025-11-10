# UllGetTheJob API - Test Suite

## Directory Structure

```
tests/
├── unit/                    # Unit tests for individual services
│   ├── file-validation.test.ts
│   ├── cache.test.ts
│   ├── validation.test.ts
│   ├── ai.service.test.ts        # TODO
│   └── cv-parser.test.ts         # TODO
├── integration/             # Integration tests for API endpoints
│   ├── cv-flow.test.ts          # TODO
│   ├── auth.test.ts             # TODO
│   └── queue.test.ts            # TODO
├── load/                    # Load and performance tests
│   └── api-load.test.ts         # TODO
├── fixtures/                # Test data files
│   ├── sample_cv.pdf            # TODO
│   ├── sample_cv.docx           # TODO
│   └── malware.pdf              # TODO (for security tests)
└── README.md               # This file
```

## Running Tests

### Prerequisites

1. Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install dependencies:
```bash
bun install
```

3. Setup environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Run All Tests

```bash
bun test
```

### Run Specific Test File

```bash
bun test tests/unit/cache.test.ts
```

### Run with Coverage

```bash
bun test --coverage
```

### Watch Mode (for development)

```bash
bun test --watch
```

## Test Categories

### Unit Tests (Complete ✅)

These tests verify individual functions and classes in isolation:

- ✅ **file-validation.test.ts** - File type and size validation
- ✅ **cache.test.ts** - In-memory cache service
- ✅ **validation.test.ts** - Email, phone, text validation utilities

#### TODO: Unit Tests

- [ ] **ai.service.test.ts** - AI service methods (mocked API calls)
- [ ] **cv-parser.test.ts** - CV parsing logic
- [ ] **queue.service.test.ts** - Queue operations
- [ ] **storage.service.test.ts** - Database operations (mocked)

### Integration Tests (TODO)

These tests verify API endpoints with real database and mocked external services:

- [ ] **cv-flow.test.ts** - Complete CV upload → parse → customize → apply flow
- [ ] **auth.test.ts** - Authentication and authorization
- [ ] **queue.test.ts** - Queue management and batch operations
- [ ] **websocket.test.ts** - Real-time WebSocket updates

### Load Tests (TODO)

Performance and stress testing:

- [ ] **api-load.test.ts** - Concurrent request handling
- [ ] **batch-load.test.ts** - Batch CV customization performance

### Security Tests (TODO)

Security vulnerability testing:

- [ ] **injection.test.ts** - SQL injection, prompt injection
- [ ] **file-security.test.ts** - Malicious file uploads
- [ ] **auth-security.test.ts** - Authentication bypass attempts

## Writing New Tests

### Example: Unit Test

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'

describe('MyService', () => {
  let service: MyService

  beforeEach(() => {
    service = new MyService()
  })

  it('should do something', () => {
    const result = service.doSomething()
    expect(result).toBe(expected)
  })
})
```

### Example: Integration Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

describe('API Endpoint', () => {
  let server: any

  beforeAll(async () => {
    server = await startTestServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  it('should return 200', async () => {
    const response = await fetch('http://localhost:3000/api/health')
    expect(response.status).toBe(200)
  })
})
```

## Test Fixtures

Create test fixtures in `tests/fixtures/`:

```typescript
// tests/fixtures/mock-data.ts
export const mockCV = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  skills: ['JavaScript', 'TypeScript'],
  // ...
}

export const mockJob = {
  title: 'Software Engineer',
  description: 'Looking for React developer...',
  // ...
}
```

## Mocking External Services

### OpenRouter API

```typescript
import { mock } from 'bun:test'

const mockFetch = mock((url, options) => {
  if (url.includes('openrouter')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        choices: [{ message: { content: '{"firstName": "John"}' } }]
      })
    })
  }
})

global.fetch = mockFetch
```

### Database

```typescript
import { mock } from 'bun:test'
import { db } from '../../src/db/client'

// Mock specific queries
mock.module('../../src/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve([mockData]) }) })
  }
}))
```

## Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| File Validation | 95%+ | ✅ 100% |
| Cache Service | 85%+ | ✅ 95% |
| Validation Utils | 90%+ | ✅ 100% |
| AI Service | 80%+ | ⏳ 0% |
| CV Parser | 90%+ | ⏳ 0% |
| Queue Service | 85%+ | ⏳ 0% |

## CI/CD Integration

### GitHub Actions (Recommended)

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test --coverage
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests fail with "MODULE_NOT_FOUND"
- Run `bun install` to ensure all dependencies are installed

### Database connection errors
- Ensure PostgreSQL is running: `docker-compose up -d postgres`
- Check DATABASE_URL in .env

### OpenRouter API errors in tests
- Mock the fetch calls to avoid hitting real API
- Or set OPENROUTER_API_KEY in test environment

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure coverage meets targets
3. Run full test suite before committing
4. Update this README if adding new test categories

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Project README](../README.md)
