# Spring Boot Backend — Specification-Driven Development Guide

> SDD for the QAI Spring Boot backend — quiz CRUD, question management, quiz-taking, and user profiles.

---

## Project Context

**Product**: QAI Backend — a Spring Boot REST API managing quizzes, questions, quiz sessions, and user profiles with Google Firestore.

**Architecture**:
```
Next.js Frontend (:3000) ──REST──→ Spring Boot (:8080) ──gRPC──→ Firestore
AI Study Coach (:8000)  ──REST──→ Spring Boot (:8080)
```

---

## File Index

| # | File | What It Specifies |
|---|------|-------------------|
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | System topology, tech stack, package structure |
| 02 | [REST-API.md](./02-REST-API.md) | All REST endpoints, DTOs, error shape |
| 03 | [FIRESTORE-SCHEMA.md](./03-FIRESTORE-SCHEMA.md) | Collection schemas, relationships |
| 04 | [DATA-FLOWS.md](./04-DATA-FLOWS.md) | End-to-end data flows for all operations |
| 05 | [CONFIGURATION.md](./05-CONFIGURATION.md) | Firebase setup, security, CORS, properties |
| 06 | [CONVENTIONS.md](./06-CONVENTIONS.md) | Coding conventions, integration points, dev workflow |
| 07 | [VALIDATION-ERRORS.md](./07-VALIDATION-ERRORS.md) | Validation architecture, exception handling, Lombok |
| 08 | [BUILD-TOOLING.md](./08-BUILD-TOOLING.md) | Maven build, Lombok processing, logging, tests |
| 09 | [QUIZ-WEBHOOK-SENDER.md](./09-QUIZ-WEBHOOK-SENDER.md) | Send quiz completion webhook to AI Coach |

---

## Quick Start

```bash
cd spring-backend
# Place Firebase credentials
cp path/to/serviceAccountKey.json src/main/resources/

# Build
.\mvnw.cmd -q -DskipTests package

# Run
.\mvnw.cmd spring-boot:run
# → http://localhost:8080
```

## Dependencies

- Java 17+
- Google Firestore (via Firebase service account)
- No external services required for core operations
