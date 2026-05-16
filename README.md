# quiz-ai-app

## Quick Start

From the repo root, start the Spring Boot backend, Next.js frontend, and AI Study Coach together:

```powershell
.\start-dev.ps1
```

First-time dependency setup:

```powershell
.\start-dev.ps1 -Install
```

Useful flags:

- `-BuildBackend` runs `mvnw.cmd -q -DskipTests package` before starting Spring Boot.
- `-SkipBackend`, `-SkipFrontend`, or `-SkipCoach` starts only the services you need.
- `-DryRun` prints the generated commands without opening service windows.

The launcher opens each service in its own PowerShell window:

- Frontend: `http://localhost:3000`
- Spring backend: `http://localhost:8080`
- AI Study Coach: `http://localhost:8000`

External tools still need to be running separately when those features are used: n8n on `:5678` and LM Studio on `:1234`.
Online Quiz Web App – A feature-rich quiz platform with login, player mode, AI-generated questions, manual quiz creation, answer review, and performance tracking. Built for interactive and intelligent quiz experiences
