# 08 — Build & Tooling

## Maven Build

The project uses Maven Wrapper (no global Maven install needed):

```bash
# Build JAR (skip tests)
.\mvnw.cmd -q -DskipTests package

# Run
.\mvnw.cmd spring-boot:run

# Run tests
.\mvnw.cmd test
```

---

## Compiler Configuration

### Lombok Annotation Processing

```xml
<plugin>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <annotationProcessorPaths>
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
      </path>
    </annotationProcessorPaths>
  </configuration>
</plugin>
```

Lombok is excluded from the final JAR via `spring-boot-maven-plugin`:
```xml
<exclude>
  <groupId>org.projectlombok</groupId>
  <artifactId>lombok</artifactId>
</exclude>
```

---

## Logging

Uses **Log4j 2** (explicit dependency, not Spring Boot default SLF4J/Logback):
- `log4j-core` 2.24.3
- `log4j-api` 2.24.3

---

## API Documentation

**Swagger/OpenAPI** annotations present on DTOs:
```java
@Schema(requiredMode = Schema.RequiredMode.REQUIRED)
```

> Note: No Swagger UI endpoint is currently configured (annotations exist but no springdoc dependency for UI).

---

## Test Framework

Included via `spring-boot-starter-test`:
- **JUnit Jupiter** (JUnit 5)
- **Mockito**
- **Spring Test**

Test location: `src/test/java/`

> Prerequisite: Tests require `serviceAccountKey.json` to be present (Firebase context loads during tests).

---

## Build Profiles

No Maven profiles defined — single build configuration for all environments.
Environment-specific config is handled via `application.properties` overrides at runtime.
