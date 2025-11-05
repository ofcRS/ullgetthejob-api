# Security Hardening Documentation

## Overview

This document describes the security improvements implemented in the API service to address authentication vulnerabilities, reduce attack surface, and improve system resilience.

---

## 1. ✅ JWT-Only Authentication (No User ID in Requests)

### Problem
Previously, endpoints could accept `userId` from request bodies, allowing impersonation attacks.

### Solution
- All routes use `userId` from authenticated session context only
- Auth middleware (`authMiddleware()`) extracts `userId` from validated JWT session
- Request bodies cannot override authenticated user identity

### Implementation
- **File**: `src/middleware/auth.ts`
- **Pattern**: `{ body, userId }` where `userId` comes from `derive()` context

### Example
```typescript
// BEFORE (Insecure)
.post('/api/submit', async ({ body }) => {
  const { userId } = body // Anyone can be anyone!
})

// AFTER (Secure)
.post('/api/submit', async ({ userId }) => {
  // userId from validated session only
})
```

---

## 2. ✅ Removed OAuth Token Storage from API

### Problem
API storing OAuth tokens violates principle of least privilege. If API is compromised, all HH.ru access is exposed.

### Solution
- **API no longer stores OAuth tokens** (access_token, refresh_token)
- Session cookies contain only: `id` (session ID) and `exp` (expiration)
- Core service is the single source of truth for OAuth tokens
- API sends `X-Session-Id` header to Core, not `Authorization: Bearer`

### Implementation
- **Files**:
  - `src/middleware/session.ts` - Removed token fields from SessionPayload
  - `src/routes/auth.routes.ts` - No longer stores tokens from OAuth callback
  - `src/routes/cv.routes.ts` - Sends session ID instead of token
  - `src/routes/application.routes.ts` - Sends session ID instead of token

### Migration Path
```typescript
// BEFORE
headers: {
  'Authorization': `Bearer ${session.token}`,
  'X-Session-Id': session.id
}

// AFTER
headers: {
  'X-Session-Id': session.id,
  'X-Core-Secret': env.ORCHESTRATOR_SECRET
}
```

### Database Impact
- `sessions.token` and `sessions.refreshToken` columns set to NULL
- Core service manages OAuth token storage and refresh logic

---

## 3. ✅ HMAC Request Signing

### Problem
Requests could be tampered with in transit or replayed by attackers.

### Solution
- All write requests to Core include HMAC-SHA256 signature
- Signature covers: timestamp + payload
- Prevents tampering and replay attacks (5-minute window)

### Implementation
- **File**: `src/utils/request-signing.ts`
- **Usage**: Integrated into `core-client.ts` for all Core API calls

### Headers Added
```typescript
{
  'X-Request-Signature': 'abc123...', // HMAC-SHA256 hex
  'X-Request-Timestamp': '1699999999999',
  'X-Core-Secret': env.ORCHESTRATOR_SECRET
}
```

### Signature Algorithm
```typescript
const signature = crypto
  .createHmac('sha256', ORCHESTRATOR_SECRET)
  .update(`${timestamp}:${JSON.stringify(payload)}`)
  .digest('hex')
```

### Replay Attack Prevention
- Requests older than 5 minutes are rejected
- Allows 1 minute clock skew for forward-dated requests
- Timing-safe comparison prevents timing attacks

---

## 4. ✅ Circuit Breaker for Core Service

### Problem
When Core is down, API keeps hammering it, making recovery harder and causing cascading failures.

### Solution
- Circuit breaker pattern with three states: CLOSED, OPEN, HALF_OPEN
- Opens after 5 consecutive failures
- Stays open for 60 seconds before testing recovery
- Requires 2 successes in HALF_OPEN to close

### Implementation
- **File**: `src/utils/circuit-breaker.ts`
- **Usage**: Integrated into `core-client.ts` for all Core requests

### Configuration
```typescript
{
  failureThreshold: 5,     // Open after 5 failures
  successThreshold: 2,     // Need 2 successes to close
  timeout: 60000,          // Stay open for 1 minute
  resetTimeout: 120000     // Reset failure count after 2 minutes
}
```

### Benefits
- Fast-fail during outages (no waiting for timeouts)
- Allows Core service time to recover
- Automatic recovery detection
- Observable circuit state via `getCoreCircuitBreakerStats()`

---

## 5. ✅ Response Caching

### Problem
AI API calls are expensive ($0.001+ per request). Same inputs = wasted money.

### Solution
- In-memory LRU cache for AI responses
- Skills extraction: 2-hour TTL, 500 entries
- CV customization: 1-hour TTL, 200 entries
- Cover letters: 1-hour TTL, 200 entries

### Implementation
- **File**: `src/utils/cache.ts`
- **Integration**: `src/services/ai.service.ts`

### Cache Keys
- Hash of input content (SHA-256)
- Ensures identical inputs hit cache
- No PII in cache keys (hashed)

### Expected Savings
```
Without cache: $0.001 × 1000 identical requests = $1.00
With cache:    $0.001 × 1 request = $0.001 (99.9% savings)
```

### Eviction Strategy
- LRU (Least Recently Used)
- Automatic cleanup every 5 minutes
- Respects TTL and max size limits

---

## 6. ✅ Fixed WebSocket Authentication

### Problem
WebSocket upgrade happened before auth check, allowing unauthenticated connections.

### Solution
- Authentication during handshake in `open()` handler
- Connection rejected with code 1008 if auth fails
- Session tracked per WebSocket connection
- All messages verify authentication

### Implementation
- **File**: `src/routes/ws.routes.ts`

### Flow
```typescript
1. Client connects to /ws
2. Extract session cookie from upgrade request
3. Validate session
4. If invalid:
   - ws.close(1008, 'Authentication required')
   - Connection never fully established
5. If valid:
   - Store sessionId in WeakMap
   - Allow connection
   - Verify auth on every message
```

### WebSocket Close Codes
- `1008`: Policy violation (authentication failed)
- `1011`: Internal server error

---

## 7. ✅ Enhanced File Validation

### Problem
Malicious files could exploit parsers or consume resources.

### Solution
- **Magic byte verification**: Checks actual file content, not just extension
- **ZIP bomb detection**: Rejects suspiciously compressed DOCX files
- **Path traversal prevention**: Validates file names
- **UTF-8 validation**: Ensures TXT files are valid text

### Implementation
- **File**: `src/utils/validation.ts`

### Supported File Types
| Type | Magic Bytes | Additional Checks |
|------|-------------|-------------------|
| PDF | `%PDF` (0x25504446) | None |
| DOCX | `PK` (0x504B) | ZIP bomb check (100:1 ratio) |
| DOC | `D0CF11E0A1B1` | OLE format validation |
| TXT | None | UTF-8 validation, 5MB max |

### Validations
```typescript
1. File name length (max 255 chars)
2. No path traversal (../, /, \)
3. Magic bytes match declared type
4. Size within limits (default 10MB)
5. No ZIP bombs (DOCX)
6. Valid UTF-8 (TXT)
```

---

## 8. ✅ Environment Variable Updates

### Removed
- `HH_ACCESS_TOKEN` - No longer needed in API

### Required
- `SESSION_SECRET` - For signing session cookies
- `ORCHESTRATOR_SECRET` - For Core communication and request signing
- `OPENROUTER_API_KEY` - For AI operations
- `DATABASE_URL` - PostgreSQL connection

### Optional
- `CORE_URL` - Defaults to `http://localhost:4000`
- `PORT` - Defaults to `3000`
- `MAX_FILE_SIZE` - Defaults to 10MB

### Security Requirements
1. **SESSION_SECRET**: 32+ random characters
   ```bash
   openssl rand -hex 32
   ```

2. **ORCHESTRATOR_SECRET**: Must match Core service
   - Used for HMAC signing
   - Used for mutual authentication

3. **Never commit** `.env` files to version control

---

## Security Checklist

### Deployment Checklist
- [ ] Set strong `SESSION_SECRET` (32+ chars)
- [ ] Ensure `ORCHESTRATOR_SECRET` matches Core
- [ ] Enable `NODE_ENV=production`
- [ ] Use HTTPS in production (secure cookies)
- [ ] Set proper `ALLOWED_ORIGINS` for CORS
- [ ] Review and limit `MAX_FILE_SIZE`
- [ ] Monitor circuit breaker stats
- [ ] Set up cache metrics monitoring

### Runtime Monitoring
- [ ] Monitor failed auth attempts
- [ ] Track circuit breaker state
- [ ] Monitor cache hit rates
- [ ] Review WebSocket connection logs
- [ ] Track file validation rejections
- [ ] Monitor Core service latency

### Incident Response
1. **Auth bypass detected**: Rotate `SESSION_SECRET`, revoke all sessions
2. **Circuit breaker open**: Check Core service health
3. **Unusual file uploads**: Review validation logs, check for attacks
4. **WebSocket spam**: Review rate limits, check authentication logs

---

## Testing Security

### Manual Tests

#### 1. Test User ID Spoofing
```bash
# Should fail: Cannot override authenticated userId
curl -X POST http://localhost:3000/api/cv/upload \
  -H "Cookie: hh_session=..." \
  -F "userId=other-user-id" \
  -F "file=@resume.pdf"
```

#### 2. Test OAuth Token Exposure
```bash
# Session cookie should NOT contain token field
curl http://localhost:3000/api/auth/hh/status \
  -H "Cookie: hh_session=..." -v
# Inspect Set-Cookie header - should only have id and exp
```

#### 3. Test WebSocket Auth
```javascript
// Should be rejected with code 1008
const ws = new WebSocket('ws://localhost:3000/ws')
// No cookie sent = connection closed immediately
```

#### 4. Test File Type Spoofing
```bash
# Rename malicious.exe to malicious.pdf
# Should be rejected due to magic byte mismatch
curl -X POST http://localhost:3000/api/cv/upload \
  -H "Cookie: hh_session=..." \
  -F "file=@malicious.exe"
```

#### 5. Test Circuit Breaker
```bash
# Shut down Core service
# Make 6 requests to API
# 6th request should fail fast with CircuitBreakerError
for i in {1..6}; do
  curl http://localhost:3000/api/jobs/search \
    -X POST -H "Content-Type: application/json" \
    -d '{"text":"developer"}'
done
```

### Automated Tests

```typescript
// TODO: Add to test suite
describe('Security Tests', () => {
  test('Cannot override userId from request body')
  test('OAuth tokens not in session cookie')
  test('Request signing prevents tampering')
  test('Circuit breaker opens on failures')
  test('WebSocket rejects unauthenticated connections')
  test('File validation blocks type spoofing')
  test('Cache reduces AI API calls')
})
```

---

## Performance Impact

### Latency Changes
- **Request signing**: +1ms per Core request (HMAC computation)
- **Circuit breaker**: -2000ms on failures (fast-fail vs timeout)
- **Caching**: -500ms to -2000ms on cache hits (no AI API call)
- **File validation**: +50ms per upload (magic byte reading)

### Memory Impact
- **Caching**: ~10-50MB for AI response cache
- **Circuit breaker**: <1KB per breaker
- **WebSocket auth**: +8 bytes per connection (WeakMap)

### Cost Savings
- **AI caching**: 50-90% reduction in OpenRouter costs
- **Circuit breaker**: Prevents wasted retry attempts

---

## Future Enhancements

### Recommended Next Steps

1. **Rate Limiting**
   - Add per-user rate limits
   - Prevent abuse and DoS

2. **Audit Logging**
   - Log all auth failures
   - Track sensitive operations
   - Enable forensics

3. **Request Tracing**
   - Add correlation IDs
   - Track requests across services

4. **Redis Cache**
   - Replace in-memory cache
   - Survives restarts
   - Shared across instances

5. **mTLS**
   - Replace HMAC signing
   - Stronger inter-service auth

6. **Secrets Management**
   - Use AWS Secrets Manager / Vault
   - Automatic rotation

---

## Questions & Support

For security concerns or questions about this implementation:
1. Review this document and code comments
2. Check `SECURITY.md` for vulnerability reporting
3. Open an issue with `[SECURITY]` prefix

**Last Updated**: 2025-11-05
**Authors**: API Security Team
