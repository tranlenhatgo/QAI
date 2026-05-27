# 06 — Conventions & Integration

## Coding Conventions

| Convention | Details |
|-----------|---------|
| IDs | 8-char UUID slices via `IdUtil.generateId()` |
| Score format | `"correct/total"` string (e.g., `"7/10"`) |
| Field naming | snake_case in Firestore (mirrors model fields) |
| Categories | Uppercase enum in Java, lowercase strings from client. **Max 1 category per quiz** (enforced by `@Size(max=1)` on DTO). API responses always return lowercase. |
| Timestamps | ISO-8601 in JSON → `TimestampDeserializer` → Firestore Timestamp |
| Controller pattern | Thin controller → Service has business logic → Direct Firestore access |
| Error shape | `{ message, statusCode }` |
| Root mappings | `ROOT_MAPPING` constant in each controller |
| Async | `@SneakyThrows` + `.get()` on Firestore futures (sync-style) |

---

## Integration Points

| Dependency | Direction | Protocol | Purpose |
|-----------|-----------|----------|---------|
| Next.js frontend | ← inbound | REST | All quiz/user operations |
| AI Study Coach | ← inbound | REST | Fetch quiz history, quiz details |
| AI Study Coach | → outbound | REST (webhook) | Notify quiz completion for spaced repetition |
| Firebase/Firestore | → outbound | gRPC (SDK) | All data persistence |

---

## Developer Workflow

```bash
# Build (skip tests)
.\mvnw.cmd -q -DskipTests package

# Run locally
.\mvnw.cmd spring-boot:run

# Run tests (requires serviceAccountKey.json)
.\mvnw.cmd test
```

---

## Dependency Versions

| Dependency | Version | Managed By |
|-----------|---------|-----------|
| Spring Boot | 3.4.3 | Parent POM |
| Java | 17 | `pom.xml` |
| firebase-admin | 9.3.0 | Explicit |
| Apache HttpClient5 | 5.4.1 | Explicit |
| Lombok | 1.18.36 | Explicit |
| Jakarta Validation | 3.0.2 | Explicit |
| Hibernate Validator | 8.0.0 | Explicit |
| Jackson | Boot-managed | Parent POM |
