# 12 — AI Coach Dashboard Page

## Overview

A dedicated dashboard page (`/coach`) that showcases all AI Study Coach capabilities in one place. Requires authentication for full features (unauthenticated users see a preview with sign-in prompt).

---

## Route

| Route | File | Auth Required |
| --- | --- | --- |
| `/coach` | `src/pages/coach/index.js` | Yes (full features) |

---

## Page Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│  AI Coach Dashboard                     [Refresh] [Profile/Login]│
├──────────────────────────────────────────────────────────────────┤
│  [Overview] [Generate] [Solver] [Materials] [Weaknesses] [Chat]  │
│                                               Tier: [Lite] [Full]│
├──────────────────────────────────────────────────────────────────┤
│  AI Coach Workspace                                              │
│  {Selected Feature Title}                                        │
│  {Description text}                                   Full tier  │
│                                                                   │
│  ┌──────────────── Active Feature Panel ───────────────────────┐ │
│  │  Overview tab:                                               │ │
│  │    NotificationBell (unread count + dismissable list)        │ │
│  │    ProgressOverview (trend chart + mastery breakdown)        │ │
│  │    DueReviews (spaced repetition cards)                      │ │
│  │                                                               │ │
│  │  Generate tab: GenerateQuestions                              │ │
│  │  Solver tab: StepSolver                                      │ │
│  │  Materials tab: StudyMaterials                                │ │
│  │  Weaknesses tab: MyWeaknesses                                │ │
│  │  Chat tab: EmbeddedChat                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Responsive Behavior

- **Desktop (1024px+)**: 2-column grid for middle sections, full-width banner + chat
- **Tablet (640px+)**: 2-column grid, collapsible chat
- **Mobile (<640px)**: Single column, all sections stacked, chat minimized to floating button

---

## Section Specifications

### 1. Progress Overview (Banner)

**Status**: ✅ Implemented

**User sees**:

- Line chart showing quiz scores over time (last 30 days)
- Top 3 weak topics (lowest scores) as colored badges
- Study streak counter (consecutive days with activity)

**Data source**: `GET /user/quiz-profile?userId=` → aggregate scores by date and category.

**Interactions**:

- Hover chart points → tooltip with score details
- Click weak topic badge → scrolls to "My Weaknesses" section
- Streak counter animates on page load

---

### 2. Generate Questions

**Status**: ✅ Ready

**User sees**:

- Topic input field (text or select from categories)
- Question count slider (1–20, default 5)
- [Generate] button
- Loading spinner during generation
- Generated questions listed below (expandable cards)

**Data source**: `POST /generate/from-topics` (AI Study Coach)

**Interactions**:

- Type topic → click Generate → see questions appear
- Expand question card → see all 4 answers + correct one highlighted
- [Save to Quiz] button → creates quiz in Spring Boot
- [Regenerate] → generates new set
- File upload tab → `POST /generate/from-file` for document-based generation

---

### 3. Step-by-Step Solver

**Status**: ✅ Ready (backend: `POST /solve`, WebSocket streaming)

**User sees**:

- Large textarea for problem input
- [Solve] button
- Solution displayed as numbered steps:

  ```text
  Step 1: Identify known variables
    → x = 5, y = 3
  Step 2: Apply Pythagorean theorem
    → c² = x² + y²
  Step 3: Calculate
    → c = √34 ≈ 5.83
  Final Answer: 5.83 (confidence: high)
  ```

**Data source**: `POST /solve` (AI Study Coach REST endpoint) or WebSocket agentic mode

**Interactions**:

- Type problem → click Solve → see steps appear one by one (streamed)
- Each step is expandable (show/hide reasoning)
- [Ask follow-up] → opens chat with problem context pre-filled
- [Copy solution] → copies formatted solution to clipboard

---

### 4. My Weaknesses

**Status**: ✅ Implemented

**User sees**:

- Grid of topic cards (one per category attempted)
- Each card shows: category name, icon, average score, attempt count
- Color-coded: red (< 50%), amber (50-75%), green (> 75%)
- [Practice this] button on weak topics

**Data source**: `GET /user/quiz-profile?userId=` → group `take_quiz` by category, average scores

**Interactions**:

- Cards sorted by score (weakest first)
- Click [Practice this] → generates 5 questions on that topic (calls Generate Questions)
- Hover card → shows score breakdown (e.g., "3/10, 5/10, 7/10 — improving!")

---

### 5. Study Materials

**Status**: ✅ Implemented (UI component ready, backend RAG endpoint planned)

**User sees**:

- Drag-and-drop upload area (accepts PDF, TXT, MD)
- List of uploaded documents (name, date, page count)
- [Delete] button per document
- Upload status indicator (processing/indexed/failed)

**Data source**: Supabase pgvector (document chunks + embeddings)

**Interactions**:

- Drag file → upload → see processing status
- Once indexed, documents are used by RAG tool in chat/agentic mode
- Click document → preview first page
- [Generate questions from this] → calls `/generate/from-file`

---

### 6. Chat Panel (Embedded)

**Status**: ✅ Ready

**User sees**:

- Collapsible chat panel at bottom of page
- Same functionality as `/chat` page (conversations, mode toggle, streaming)
- Connection status indicator
- Minimize/maximize toggle

**Data source**: WebSocket `ws://{COACH_URL}/ws/chat` + HTTP fallback

**Interactions**:

- Same as `/chat` — type message, receive streaming response
- Mode toggle: Simple (quick) / Agentic (tools)
- Context-aware: if user just generated questions or solved a problem, chat has that context
- Minimize → collapses to small bar showing last message

---

## Component Architecture

```text
src/pages/coach/index.js
src/components/Coach/
├── CoachDashboard.jsx         # Main layout orchestrator (tabbed nav)
├── ProgressOverview.jsx       # Score trend chart + streak + mastery breakdown
├── MasteryBreakdown.jsx       # Per-category mastery bars
├── GenerateQuestions.jsx      # Topic input + generation + results
├── StepSolver.jsx             # Problem input + step display
├── MyWeaknesses.jsx           # Topic cards grid
├── StudyMaterials.jsx         # Upload + document list
├── EmbeddedChat.jsx           # Reuses Chat components in panel mode
├── DueReviews.jsx             # Spaced repetition due-now items
├── ReviewCard.jsx             # Individual review card with start button
└── NotificationBell.jsx       # Unread notification badge + dismissable list
```

---

## State Management

Zustand slice: `useCoach` (in `src/store/useCoach.js`)

```javascript
{
  // Generate Questions
  generatedQuestions: [],
  isGenerating: false,
  generateTopic: '',
  generateCount: 5,

  // Step Solver
  solutionSteps: [],
  isSolving: false,
  currentProblem: '',

  // Weaknesses
  weaknesses: [],       // { category, avgScore, attempts }
  isLoadingProfile: false,

  // Study Materials
  documents: [],        // { id, name, status, uploadedAt }
  isUploading: false,

  // Progress
  scoreHistory: [],     // { date, score, category }
  streak: 0,

  // Due Reviews (spaced repetition)
  dueReviews: [],       // { category, next_review, interval_days, easiness }
  upcomingReviews: [],  // reviews coming soon but not yet due
  isLoadingReviews: false,

  // Notifications (Firestore-backed via Spring Boot)
  notifications: [],    // { id, title, message, type, read, created_at }

  // UI state
  activeCoachFeature: 'overview',
  coachTier: 'full',
}
```

---

## API Calls from Dashboard

| Action | Endpoint | Service |
| -------- | ---------- | --------- |
| Generate questions | `POST /generate/from-topics` | AI Coach |
| Generate from file | `POST /generate/from-file` | AI Coach |
| Solve problem (REST) | `POST /solve` | AI Coach |
| Solve problem (stream) | WebSocket stage events | AI Coach |
| Fetch weaknesses | `GET /user/quiz-profile?userId=` | Spring Boot |
| Save generated quiz | `POST /quiz` + `POST /question` | Spring Boot |
| Upload document | (planned) `POST /rag/upload` | AI Coach |
| Fetch progress | `GET /user/quiz-profile?userId=` | Spring Boot |
| Fetch due reviews | `GET /api/coach/review-schedule/user/{userId}/due` | Spring Boot (via BFF) |
| Complete review | `POST /api/coach/review-completed` | AI Coach (via BFF) |
| Fetch notifications | `GET /api/coach/notifications/{userId}` | Spring Boot (via BFF) |
| Mark notification read | `PATCH /api/coach/notifications/{id}/read` | Spring Boot (via BFF) |

---

## Step-by-Step Solver — Frontend Implementation

### Component: `StepSolver.jsx`

```jsx
// src/components/Coach/StepSolver.jsx
import { useState } from 'react';
import { useCoach } from '@/store/useCoach';

export default function StepSolver() {
  const { solutionSteps, isSolving, currentProblem, solveProblem, clearSolution } = useCoach();

  return (
    <div className="rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Step-by-Step Solver</h3>

      {/* Problem Input */}
      <textarea
        className="w-full min-h-[120px] border rounded-lg p-3 resize-y"
        placeholder="Enter a math, science, or analytical problem..."
        value={currentProblem}
        onChange={(e) => useCoach.setState({ currentProblem: e.target.value })}
        disabled={isSolving}
      />

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => solveProblem(currentProblem)}
          disabled={!currentProblem.trim() || isSolving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {isSolving ? 'Solving...' : 'Solve'}
        </button>
        {solutionSteps.length > 0 && (
          <button onClick={clearSolution} className="px-4 py-2 border rounded-lg">
            Clear
          </button>
        )}
      </div>

      {/* Solution Steps Display */}
      {solutionSteps.length > 0 && (
        <div className="mt-6 space-y-4">
          {solutionSteps.map((step) => (
            <StepCard key={step.step_id} step={step} />
          ))}
        </div>
      )}

      {/* Final Answer */}
      {!isSolving && solutionSteps.length > 0 && useCoach.getState().finalAnswer && (
        <FinalAnswer />
      )}
    </div>
  );
}
```

### Zustand Actions (`useCoach.js`)

```javascript
// In useCoach slice — Step Solver actions

solveProblem: async (problem) => {
  set({ isSolving: true, solutionSteps: [], finalAnswer: null, confidence: null });

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_COACH_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': getApiKey() },
      body: JSON.stringify({ problem, user_id: getUserId() }),
    });

    if (!res.ok) throw new Error(`Solve failed: ${res.status}`);

    const data = await res.json();
    // data: { problem, analysis, steps[], final_answer, confidence }

    set({
      solutionSteps: data.steps,         // [{step_id, goal, reasoning, result}]
      finalAnswer: data.final_answer,
      confidence: data.confidence,
      analysis: data.analysis,
    });
  } catch (err) {
    console.error('Solve error:', err);
    // TODO: show toast/error state
  } finally {
    set({ isSolving: false });
  }
},

clearSolution: () => set({
  solutionSteps: [],
  finalAnswer: null,
  confidence: null,
  analysis: null,
  currentProblem: '',
}),
```

### WebSocket Streaming Alternative

For real-time step-by-step streaming (agentic mode), use the existing WebSocket:

```javascript
// Send solve request through WebSocket
ws.send(JSON.stringify({
  type: 'message',
  content: problem,
  mode: 'agentic',        // triggers StepSolver in agent loop
}));

// Listen for stage events
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'stage':
      // msg: { stage: "planning"|"step_1"|"synthesizing", status: "start"|"end" }
      if (msg.stage === 'planning' && msg.status === 'start') {
        set({ isSolving: true, currentStage: 'planning' });
      }
      if (msg.stage.startsWith('step_') && msg.status === 'start') {
        set({ currentStage: msg.stage });
      }
      break;

    case 'content':
      // Append streaming content to current step
      appendToCurrentStep(msg.content);
      break;
  }
};
```

### StepCard Sub-Component

```jsx
function StepCard({ step }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h4 className="font-medium">
          Step {step.step_id}: {step.goal}
        </h4>
        <span className="text-sm text-gray-500">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
          <p className="text-gray-500 italic mb-2">Reasoning:</p>
          <p>{step.reasoning}</p>
        </div>
      )}

      <div className="mt-2 text-sm font-medium text-blue-700">
        → {step.result}
      </div>
    </div>
  );
}
```

### FinalAnswer Sub-Component

```jsx
function FinalAnswer() {
  const { finalAnswer, confidence, analysis } = useCoach();

  const confidenceColor = {
    high: 'text-green-600',
    medium: 'text-amber-600',
    low: 'text-red-600',
  }[confidence] || 'text-gray-600';

  return (
    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      {analysis && <p className="text-sm text-gray-600 mb-2">{analysis}</p>}
      <p className="text-lg font-semibold">{finalAnswer}</p>
      <p className={`text-sm mt-1 ${confidenceColor}`}>
        Confidence: {confidence}
      </p>
      <button
        onClick={() => navigator.clipboard.writeText(finalAnswer)}
        className="mt-2 text-xs text-blue-600 hover:underline"
      >
        Copy answer
      </button>
    </div>
  );
}
```

### Response Shape from `POST /solve`

```json
{
  "problem": "Solve x² + 5x + 6 = 0",
  "analysis": "Quadratic equation, factorable",
  "steps": [
    { "step_id": 1, "goal": "Identify method", "reasoning": "...", "result": "Use factoring" },
    { "step_id": 2, "goal": "Factor", "reasoning": "...", "result": "(x+2)(x+3)=0" },
    { "step_id": 3, "goal": "Solve", "reasoning": "...", "result": "x=-2, x=-3" }
  ],
  "final_answer": "x = -2, x = -3",
  "confidence": "high"
}
```

---

## Implementation Priority

| Priority | Section | Status | Notes |
| ---------- | --------- | -------- | ------- |
| 1 | Generate Questions | ✅ Implemented | Topic + file-based generation |
| 2 | Chat Panel (Embedded) | ✅ Implemented | Full chat in tabbed panel |
| 3 | Step-by-Step Solver | ✅ Implemented | REST `POST /solve` + streaming |
| 4 | My Weaknesses | ✅ Implemented | Quiz profile grouping + practice buttons |
| 5 | Progress Overview | ✅ Implemented | SVG trend chart + mastery breakdown |
| 6 | Due Reviews | ✅ Implemented | Spaced repetition schedule from Spring Boot |
| 7 | Notification Bell | ✅ Implemented | Firestore-backed unread notifications |
| 8 | Study Materials | ✅ UI Ready | Upload UI built, RAG backend pending |
