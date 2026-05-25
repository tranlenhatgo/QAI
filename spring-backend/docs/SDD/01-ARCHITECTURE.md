# 01 — Spring Boot Backend Architecture

## Overview

The QAI Spring Boot backend is the core data service for the quiz platform. It manages quiz CRUD, question management, quiz-taking sessions, and user profiles. It uses **Google Firestore** as its sole database. AI question generation is handled by the AI Study Coach service.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Clients                                          │
│  Next.js (:3000)          AI Study Coach (:8000)                        │
└──────────┬─────────────────────────────┬────────────────────────────────┘
           │ HTTP REST                    │ HTTP REST
           ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Spring Boot (:8080)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Controllers (HTTP Layer)                                                │
│  ┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ QuizCtrl     │ │ QuestionCtrl     │ │ TakeQuizCtrl     │            │
│  │ POST /quiz   │ │ POST /question   │ │ POST /take-quiz  │            │
│  │ GET  /quiz/* │ │ GET  /question/* │ │      /start      │            │
│  │ PUT  /quiz/* │ │ POST /update     │ │      /end        │            │
│  └──────┬───────┘ └──────┬───────────┘ └──────┬───────────┘            │
│         │                 │                     │                        │
│  ┌──────┴───────┐ ┌──────┴───────────┐ ┌──────┴───────────┐            │
│  │ QuizService  │ │ QuestionService  │ │ TakeQuizService  │            │
│  └──────┬───────┘ └──────┬───────────┘ └──────┬───────────┘            │
│         │                 │                     │                        │
├─────────┴─────────────────┴─────────────────────┴───────────────────────┤
│                    Google Firestore                                       │
│  Collections:  quiz | question | take_quiz | take_question               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Spring Boot | 3.4.3 |
| Language | Java | 17 |
| Database | Google Firestore | via firebase-admin 9.3.0 |
| Auth | Firebase Admin Auth | 9.3.0 |
| Security | Spring Security | (Boot managed) |
| Build | Maven (wrapper) | 3.x |
| HTTP Client | Apache HttpClient5 | 5.4.1 |
| Validation | Jakarta Validation + Hibernate Validator | 3.0.2 / 8.0.0 |
| Boilerplate | Lombok | 1.18.36 |
| JSON | Jackson (Spring default) | (Boot managed) |

---

## Package Structure

```
com.myproject.quizzai/
├── QuizzAiOnlineApplication.java    # Spring Boot entry point
├── config/
│   ├── AppConfig.java               # RestTemplate bean (timeout configured)
│   ├── FirebaseConfiguration.java   # FirebaseApp, Firestore, FirebaseAuth beans
│   ├── SecurityConfig.java          # CORS + CSRF disabled + permitAll
│   └── SecurityCorsProperties.java  # Externalized CORS config
├── controller/
│   ├── QuizController.java          # /quiz — CRUD
│   ├── QuestionController.java      # /question — CRUD
│   ├── TakeQuizController.java      # /take-quiz — start/end sessions
│   ├── TakeQuestionController.java  # /take-question (if needed)
│   └── UserController.java          # /user — profile/leaderboard
├── service/
│   ├── QuizService.java             # Quiz business logic + Firestore
│   ├── QuestionService.java         # Question CRUD + Firestore
│   ├── TakeQuizService.java         # Quiz session management
│   ├── TakeQuestionService.java     # Per-question answer storage
│   └── UserService.java             # User profile aggregation
├── model/
│   ├── Quiz.java                    # Firestore document shape
│   ├── Question.java                # Firestore document shape
│   ├── TakeQuiz.java                # Quiz attempt record
│   ├── TakeQuestion.java            # Per-question answer record
│   ├── User.java                    # User data
│   ├── Category.java                # Enum: SCIENCE, MATH, etc.
│   ├── Status.java                  # Enum: quiz/take status
│   ├── Role.java                    # User roles
│   └── CheckAnswer.java             # Answer checking model
├── dto/
│   ├── QuizCreationRequestDto.java  # Quiz create input
│   ├── QuizResponseDto.java         # Quiz API response
│   ├── QuestionCreationRequestDto.java
│   ├── QuestionResponseDto.java
│   ├── QuestionUpdateRequestDto.java
│   ├── TakeQuizStartRequestDto.java # Start quiz input
│   ├── TakeQuizStartResponseDto.java
│   ├── TakeQuizEndRequestDto.java   # End quiz input
│   ├── TakeQuizResponseDto.java
│   ├── TakeQuestionSaveRequestDto.java
│   └── UserQuizResponseDto.java
├── exceptions/
│   ├── QuizException.java           # Business logic exceptions
│   └── ModelVerificationException.java
└── utils/
    ├── IdUtil.java                  # 8-char UUID generator
    ├── RestVerifier.java            # Request validation helper
    ├── TimestampDeserializer.java   # ISO-8601 → Firestore Timestamp
    └── TimeUtils.java              # Time utilities
```

Score string `"7/10"` is parsed by coach via `_parse_score()` → `(7, 10)`.
