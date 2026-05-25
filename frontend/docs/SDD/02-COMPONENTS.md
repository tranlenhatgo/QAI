# 02 — Component Architecture

## Component Tree

```
src/components/
├── Auth/           # Authentication forms
├── Chat/           # AI coaching chat
│   ├── StudyCoachWidget.jsx   # Floating widget (embeddable)
│   └── ChatTranscript.jsx     # Message display
├── Create/         # Quiz creation
│   ├── CreateHeader.jsx
│   ├── CreateInfo.jsx
│   └── CreateQuestions.jsx
├── Form/           # Global modal forms (mounted in _app.js)
│   ├── AuthForm.jsx           # Login/register modal
│   ├── PlayForm.jsx           # Game configuration
│   ├── NewGameForm.jsx        # New game setup
│   ├── JoinGameForm.jsx       # Join quiz room
│   └── CreateQuizRoomForm.jsx # Create room modal
├── Home/           # Landing page
│   ├── MainHome.jsx
│   ├── Categories.jsx
│   ├── GameModes.jsx
│   └── HomeHeader.jsx
├── Play/           # Gameplay
│   ├── GameInfo.jsx
│   ├── GameOver.jsx           # Results + confetti + save attempt
│   └── PlayHeader.jsx
├── Profile/        # User profile
│   ├── ProfileHeader.jsx
│   ├── ProfileInfo.jsx
│   ├── ProfileLeaderboard.jsx
│   ├── QuizHistory.jsx
│   └── QuizQuestionsModal.jsx
├── Questions/      # Question display during play
│   ├── Questions.jsx
│   ├── QuestionSlider.jsx
│   ├── QuestionsNavbar.jsx
│   └── Wildcards.jsx
├── PageError.jsx
├── PageFooter.jsx
└── PageLoading.jsx
```

---

## Component Responsibilities

### Auth/
Authentication UI — login/register forms with Firebase integration.

### Chat/
- **StudyCoachWidget.jsx** — Floating chat widget that can be embedded on any page. Manages WebSocket connection lifecycle and message rendering.
- **ChatTranscript.jsx** — Renders conversation history with markdown support.

### Create/
Quiz creation flow — header with navigation, info form (title, description, categories), and question editor with add/remove/reorder.

### Form/
Global modals rendered in `_app.js` and triggered via `document.getElementById`. Each form manages its own local state and calls appropriate helpers on submit.

### Home/
Landing page — displays category grid for quick play, game mode options, and header with auth status.

### Play/
Gameplay UI — timer display, score info, game-over screen with confetti animation and attempt saving.

### Profile/
User profile — shows created quizzes, attempt history, leaderboard position, and quiz detail modal.

### Questions/
Core gameplay component — renders current question with answer options, navigation slider, navbar for jumping between questions, and wildcard buttons (50/50, skip).
