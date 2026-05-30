# Chapter 5: Implementation — Part 2: Next.js Frontend

## 5.10 Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (Pages Router) | 15.5.14 |
| UI Library | React | 18+ |
| State Management | Zustand | 5+ |
| Styling | Tailwind CSS | 3+ |
| Authentication | Firebase Auth (Client SDK) | — |
| Database (Client) | Firebase Firestore (Client SDK) | — |
| PWA | next-pwa / Custom Service Worker | — |
| HTTP Client | Fetch API | — |
| WebSocket | Native WebSocket API | — |

## 5.11 Project Structure

```
frontend/src/
├── pages/
│   ├── _app.js              # App shell: auth listener, store hydration
│   ├── index.js             # Landing page
│   ├── dashboard.js         # Main user dashboard
│   ├── chat.js              # Full-page AI chat
│   ├── quiz/                # Quiz browsing and gameplay
│   └── api/                 # BFF API routes
│       ├── coach/           # AI Coach proxy routes
│       │   ├── generate-questions.js
│       │   ├── upload-material.js
│       │   └── delete-material/[id].js
│       ├── quiz/            # Quiz proxy routes
│       ├── take-quiz/       # Attempt proxy routes
│       └── review-schedules/ # Schedule proxy routes
├── components/
│   ├── Coach/               # AI Coach dashboard components
│   │   ├── CoachDashboard.jsx  # Tab container (Overview, Chat, Generate, Materials)
│   │   ├── Overview.jsx        # Progress metrics + due reviews
│   │   ├── ChatTab.jsx         # Embedded chat interface
│   │   ├── GenerateQuestions.jsx # Question generation form + results
│   │   └── StudyMaterials.jsx   # Document upload and management
│   ├── Chat/               # Chat widget components
│   │   ├── ChatWidget.jsx     # Floating widget (bottom-right corner)
│   │   ├── MessageBubble.jsx  # Individual message rendering
│   │   └── ToolPill.jsx       # Tool execution status pills
│   ├── Quiz/               # Quiz components
│   └── Layout/             # Navigation, header, footer
├── store/
│   ├── useBoundStore.js    # Merged Zustand store
│   ├── useAuth.js          # Authentication state
│   ├── useChat.js          # Chat/WebSocket state + logic
│   ├── useCoach.js         # Coach dashboard state (Firestore docs)
│   ├── useQueries.js       # Quiz data fetching
│   ├── useQuestions.js     # Question state
│   ├── useCreate.js        # Quiz creation flow
│   └── useWildcards.js     # Misc UI state
├── helpers/
│   ├── auth/firebase.js    # Firebase app initialization
│   └── quiz/               # Quiz-related utilities
├── lib/                    # Shared utilities
└── styles/                 # Global CSS + Tailwind config
```

## 5.12 State Management Architecture

### 5.12.1 Bound Store Pattern

The application uses Zustand's slice pattern, merging multiple domain stores into a single hook:

```javascript
import { create } from 'zustand'

export const useBoundStore = create((...a) => ({
    ...useWildcardsStore(...a),
    ...useQueriesStore(...a),
    ...useQuestionsStore(...a),
    ...useAuthStore(...a),
    ...useCreateQuestionsStore(...a),
    ...useChatStore(...a),
    ...useCoachStore(...a),
}))
```

This approach provides:
- Single subscription point for components.
- Cross-slice access (e.g., chat store reads auth state).
- No context provider nesting.

### 5.12.2 Chat Store (useChat.js)

The chat store manages the most complex client-side logic:

**State**:
- `conversations[]`: Array of conversation objects with messages.
- `activeConversationId`: Currently active conversation.
- `chatConfig`: tier, mode, transport, server URL.
- `isStreaming`: Whether AI is currently generating.
- `settings`: User preferences (chat position, theme).

**WebSocket Management**:
- Connection lifecycle: connect on first message, reconnect with backoff.
- Session initialization: sends `session_start` with tier/mode/user_id.
- Message streaming: accumulates `content` events into assistant message.
- Tool tracking: renders `tool` events as status pills.
- Stop support: sends `stop` message to cancel generation.
- Persistence: conversations saved to localStorage for offline access.

**Key implementation detail** — the WebSocket `onmessage` handler:
```javascript
socket.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    switch (msg.type) {
        case 'session_ack':
            // Store available tools, confirm session
            break
        case 'content':
            // Append token to current assistant message
            appendToAssistantMessage(msg.content)
            break
        case 'tool':
            // Add/update tool pill in message metadata
            updateToolStatus(msg.tool, msg.status, msg.result)
            break
        case 'stage':
            // Update thinking indicator
            break
        case 'done':
            // Mark streaming complete
            set({ isStreaming: false })
            break
        case 'error':
            // Display error in chat
            break
    }
}
```

### 5.12.3 Coach Store (useCoach.js)

Manages the Coach dashboard state with Firestore persistence:

**Document Management**:
- `uploadStudyMaterial(file)`: Upload → extract → embed → persist metadata to Firestore.
- `removeDocument(docId)`: Delete from Firestore + delete RAG chunks from Supabase.
- `loadUserDocuments()`: Fetch from Firestore on auth, called in `_app.js`.

**Progress Computation**:
- `computeOverview()`: Aggregates quiz history into mastery metrics.
- `getDueReviews()`: Filters review schedules where `next_review ≤ now`.

**Question Generation**:
- `generateQuestions(topic, count, documentName)`: Calls BFF route, optional RAG context.

## 5.13 BFF API Routes

### 5.13.1 Authentication Middleware

Every BFF route verifies the Firebase ID token using `withAuth` middleware, which validates tokens via the Firebase REST API:

```javascript
// lib/withAuth.js
async function verifyFirebaseIdToken(idToken) {
    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        }
    )
    if (!response.ok) return null
    const data = await response.json()
    return data?.users?.[0]?.localId  // Firebase UID
}

export default function withAuth(handler) {
    return async function authMiddleware(req, res) {
        const token = readAuthToken(req)  // from cookie or Authorization header
        if (!token) return res.status(401).json({ message: 'Unauthorized' })
        
        const uid = await verifyFirebaseIdToken(token)
        if (!uid) return res.status(401).json({ message: 'Invalid token' })
        
        req.user = { uid }
        return handler(req, res)
    }
}
```

This approach avoids the Firebase Admin SDK dependency in the Next.js serverless environment by using Google's REST-based token verification endpoint.

### 5.13.2 Secret Injection

The BFF injects server-side secrets when proxying to AI Coach:

```javascript
const response = await fetch(`${COACH_URL}/generate/from-topics`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.COACH_API_KEY,  // Never exposed to client
    },
    body: JSON.stringify({
        topics: req.body.topics,
        num_questions: req.body.count,
        document_name: req.body.documentName || null,
        user_id: req.user.uid,
    }),
})
```

## 5.14 AI Coach Dashboard

### 5.14.1 Overview Tab

Displays:
- **Mastery rings**: Per-category circular progress indicators.
- **Due reviews**: Cards for categories needing review with "Review" buttons.
- **Study streak**: Consecutive active days.
- **Quick stats**: Total quizzes, overall accuracy, strongest/weakest category.

### 5.14.2 Generate Tab

Form-driven question generation:
- Topic input (free text).
- Count selector (1–20).
- Document picker dropdown (Full tier only — disabled with opacity in Lite).
- Generated questions rendered as interactive cards with reveal-answer toggle.

### 5.14.3 Materials Tab

Document management interface:
- Drag-and-drop upload zone (accepts PDF, TXT, MD).
- Document list with status badges:
  - Blue "Processing" during upload.
  - Green "RAG" when indexed.
  - Amber "Failed" with error tooltip.
- Delete button per document (confirms, then removes from Firestore + Supabase).

## 5.15 PWA Implementation

### 5.15.1 Web App Manifest

```json
{
  "name": "QAI - AI Quiz Platform",
  "short_name": "QAI",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512" }
  ]
}
```

### 5.15.2 Service Worker

The custom service worker (`public/sw.js`) implements:
- **Precaching**: Static assets cached at install time.
- **Runtime caching**: API responses cached with network-first strategy.
- **Offline fallback**: Serves cached pages when offline.
- **Workbox integration**: Uses `workbox-f1770938.js` for caching strategies.

## 5.16 Chat Widget

A floating widget accessible from any page:

- **Position**: Bottom-right corner, draggable.
- **States**: Collapsed (icon button) → Expanded (chat window).
- **Routing**: Hidden on `/chat` page to avoid duplication.
- **Connection**: Shares WebSocket state with full chat page via Zustand store.

The widget is rendered in `_app.js` and conditionally hidden based on current route:

```javascript
const DEFAULT_HIDDEN_PATHS = ['/chat']

// In _app.js render:
{!hiddenPaths.includes(router.pathname) && <ChatWidget />}
```

## 5.17 Responsive Design

Tailwind CSS utility classes provide responsive behavior:
- **Mobile** (<768px): Single-column layout, collapsible navigation, full-width cards.
- **Tablet** (768–1024px): Two-column grid where appropriate.
- **Desktop** (>1024px): Full sidebar navigation, multi-column dashboards.

The Coach Dashboard uses a tab-based layout on mobile and a sidebar-with-content layout on desktop, managed via Tailwind breakpoint classes (`md:`, `lg:`).
