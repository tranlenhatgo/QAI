# 11 — UI & User Interaction

## Screen Overview

| Screen | Route | Purpose |
| -------- | ------- | --------- |
| Home | `/` | Category grid + game mode selection + embedded AI chat |
| Play | `/play` | Question gameplay with timer, wildcards, keyboard shortcuts |
| Create | `/create` | Quiz creation (title, categories, questions) |
| Profile | `/profile` | Quiz history, leaderboard, attempt stats |
| Chat | `/chat` | Full AI Study Coach interface (WebSocket/HTTP) |

---

## Home Screen

**Layout**: Two-column grid on desktop (1.4fr + 1fr), single column on mobile.

### Category Grid

- 4 columns on desktop → 3 on tablet → 2 on mobile

- Color-coded cards with SVG icons per category

- Click → navigates to `/play` with selected category

- Hover: scale 1.03, outline-offset animation

### Game Mode Cards

- **Classic** — No time pressure, wildcards available

- **Time** — Countdown timer per question

- **Infinite** — Endless mode, track personal record

### Embedded AI Coach

- Mini chat panel below game modes

- Mode toggle: "Simple" vs "Agentic"

- Connection status indicator (green/amber dot)

- Message history within session

---

## Gameplay Screen (`/play`)

**Layout**: Full-screen centered question area with dynamic category-colored background.

### Question Display

- Question text + 4 answer options

- Slide animations between questions (`slide-left`, `slide-right`)

- Auto-advance on correct answer (1s delay)

- Color feedback: green (correct), red (wrong)

- Shake animation on answer reveal

### Keyboard Shortcuts

| Key | Action |
| ----- | -------- |
| ← / → | Navigate questions |
| A / B / C / D | Select answer |
| S | Use skip wildcard |
| H | Use half (50/50) wildcard |

### Timer

- SVG circular countdown (bottom-center)

- Pulse animation when < 6 seconds remaining (red)

- Auto-answers when time expires (counts as wrong)

### Wildcards Panel

- Fixed top-right position (vertical on desktop, horizontal on mobile)

- Badge counters showing remaining uses

- **Skip** — Skip to next question

- **Half (50/50)** — Remove 2 wrong answers

- **Lives** — Extra chances

- Disabled state: grayscale + cursor-not-allowed

- Hover: scale 1.05, Active: scale 0.95

### Game Over Dialog

- Modal with score display

- **Win**: Confetti animation (5-stage particle burst) + win sound

- **Lose**: Red X icon + score

- **Infinity mode**: Trophy icon

- Question review: expand to see all answers (color-coded)

- "Show correct answer" button (decrypts in quiz mode)

- Actions: "Go back" / "Play Again" / "Try Again"

---

## Create Screen

**Layout**: Vertical form with animated scrolling background.

- Requires authentication (redirects to login if no session)

- Warns on page navigation (`onbeforeunload`)

- Sections: Header → Info (title, description, categories) → Questions editor

---

## Profile Screen

**Layout**: 3-column grid on desktop (sticky left profile card + 2-col quiz history), single column on mobile.

- Shows created quizzes and attempt history

- Logout with sound effect (`pop-down`)

- Quiz detail modal on click

---

## Chat Screen (AI Study Coach)

**Layout**: Fixed sidebar (20rem) + flexible main chat panel.

### Sidebar

- Conversation history list (create, select, delete)

- Account section (login/logout)

- Settings toggles:
  - Compact mode
  - Show timestamps
  - Auto-connect WebSocket

### Chat Panel

- Connection status (green/amber dot)

- Streaming indicator ("Thinking...", mode label)

- Message composer (text input + send)

- Empty state placeholder

- Markdown rendering in messages

---

## Gamification Summary

| Element | Implementation | Screen |
| --------- | --------------- | -------- |
| Confetti | `react-canvas-confetti` (5-stage burst) | GameOver |
| Sound effects | `playSound()` (correct, wrong, pop-down, win) | Play, Profile |
| Countdown timer | SVG circle + pulse animation | Play |
| Color-coded categories | Dynamic background per category | Play |
| Keyboard shortcuts | `useEffect` keydown listeners | Play |
| Wildcard system | Skip, 50/50, Lives with counters | Play |
| Lives system | Lose on timeout, visual feedback | Play |
| Infinity mode | Endless progression, 5-question chunks | Play |
| Score display | `"correct/total"` format | GameOver |
| Badge counters | Floating white badges on wildcards | Play |

---

## Responsive Breakpoints

| Breakpoint | Tailwind | Behavior |
| ----------- | ---------- | ---------- |
| < 640px | default | Mobile: single column, stacked layouts |
| 640px+ | `sm:` | Tablet: 3-col categories, row game modes |
| 1024px+ | `lg:` | Desktop: multi-column grids, sidebars visible |

---

## Transition & Animation Patterns

| Animation | CSS Class | Usage |
| ----------- | ----------- | ------- |
| Question slide | `slide-left`, `slide-right` | Navigate between questions |
| Answer shake | `shake-left-right` | Correct answer reveal |
| Timer pulse | `animate-pulse` (red) | Critical time remaining |
| Background scroll | `bg-vertical-scroll-animation` | Create page |
| Hover scale | `hover:scale-[1.03]` | Cards, buttons |
| Button press | `active:scale-[0.95]` | Wildcards, actions |
