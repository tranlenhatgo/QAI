# 05 — Configuration

## Firebase Setup

- **Credentials**: `src/main/resources/serviceAccountKey.json`
- **Loaded by**: `FirebaseConfiguration` (eagerly initialized)
- **Beans provided**: `FirebaseApp`, `Firestore`, `FirebaseAuth`

### FirebaseConfiguration.java
```java
@Configuration
public class FirebaseConfiguration {
    @Bean
    public FirebaseApp firebaseApp() { ... }

    @Bean
    public Firestore firestore(FirebaseApp app) { ... }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp app) { ... }
}
```

---

## Security (SecurityConfig)

| Setting | Value | Rationale |
|---------|-------|-----------|
| CSRF | Disabled | Stateless REST API |
| Sessions | STATELESS | No server-side session state |
| Authorization | `permitAll` | No server-side auth enforcement currently |
| CORS | Configurable | Via `SecurityCorsProperties` |

---

## CORS Configuration

Externalized via `SecurityCorsProperties` (bound to `security.cors.*`):

### application.properties
```properties
security.cors.allowed-origins=http://localhost:3000
security.cors.allowed-methods=GET,POST,PUT,DELETE,OPTIONS
security.cors.allowed-headers=*
security.cors.allow-credentials=true
```

---

## AppConfig

Provides a `RestTemplate` bean with connection/read timeouts configured.
Used by any service that makes outbound HTTP calls.

---

## Prerequisites

| Requirement | Path | Purpose |
|-------------|------|---------|
| Firebase credentials | `src/main/resources/serviceAccountKey.json` | Required for Firestore + Auth |
| Java 17+ | — | Language level |
| Maven wrapper | `mvnw.cmd` / `mvnw` | Build tool (no global Maven needed) |

> Without `serviceAccountKey.json`, the Spring context fails to load.
