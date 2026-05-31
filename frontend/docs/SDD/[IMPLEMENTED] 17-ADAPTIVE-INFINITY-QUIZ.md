# 17 - Adaptive Infinity Quiz

## Purpose
Turn the existing `/play` Infinity mode into signed-in, single-category adaptive practice with static warmup questions, tier-sized AI batches, and in-session wrong-question repeats.

## Interface Contract
- Entry point: `PlayForm.jsx` exposes the `Infinity Quiz` checkbox.
- Guests cannot enable Infinity Quiz; clicking the checkbox opens the auth modal and leaves the mode disabled.
- Lite and Full users can enable Infinity Quiz.
- Route: `/play?infinitymode=true&categories=<single-category-id>`.
- BFF routes:
  - `GET /api/adaptive-practice/session-state?category=<category>`
  - `POST /api/adaptive-practice/answer`
  - `POST /api/coach/adaptive-questions`

## State
The question store owns the adaptive session state:

| State | Purpose |
| --- | --- |
| `adaptiveQueue` | Active non-repeat queue of static and AI questions |
| `adaptiveWrongQueue` | Wrong questions scheduled for exact repeats |
| `adaptiveHistory` | Current session answer records for results and AI context |
| `adaptiveRecentAnswers` | Last 20 persisted answers returned by Spring plus in-session answers |
| `adaptiveLoading` | Session initialization and persistence state |
| `adaptiveAiLoading` | Background AI batch request state |
| `adaptiveEndReason` | User-visible reason when no more questions can be served |
| `adaptiveSessionState` | Spring-backed category state |

## Behavior Specification
1. Resolve exactly one selected category from `queries.categories[0]`.
2. Build deterministic static IDs as `<category-id>:<hash(question + correctAnswer)>` and store them on question objects as `sourceQuestionId`.
3. Start the session by loading static `questions.json` questions and Spring session state.
4. If `hasStaticHistoryInCategory` is false, enqueue unanswered static questions first.
5. If any static question was already answered in the category, request AI questions immediately.
6. When the non-repeat queue reaches 5 remaining questions, prefetch one AI batch in the background.
7. On each answer:
   - append to `adaptiveHistory`;
   - persist through `POST /api/adaptive-practice/answer`;
   - if wrong, schedule the exact question after 2 intervening questions;
   - if wrong again on repeat, reschedule after 4 intervening questions;
   - if correct on repeat, remove it from the active wrong queue.
8. The next question priority is:
   - due wrong-question repeat;
   - existing static or AI queue;
   - newly fetched AI batch;
   - end only when AI fails and no queue/repeats remain.

## AI Request Shape
`POST /api/coach/adaptive-questions` receives category context from the store and forwards a compact request:

```json
{
  "category": "Sports",
  "history": [
    {
      "question": "...",
      "answers": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "selectedAnswer": "B",
      "wasCorrect": false,
      "source": "static_json"
    }
  ],
  "wrong_questions": [],
  "recent_questions": ["..."]
}
```

The BFF resolves the runtime tier from subscription state. Lite or locked users forward `tier="lite"`, `count=5`, and only the last 5 history, wrong-repeat, and recent question items. Full-entitled users forward `tier="full"`, `count=10`, and the last 20 history, wrong-repeat, and recent question items.

## Rendering
- Only the active Infinity question is mounted.
- Status counters show active queue and AI-loading state without hidden historical DOM growth.
- Game over/results include total answered, correct, wrong, static, AI-generated, and repeated-wrong counts.

## Acceptance Criteria
- Guest clicking `Infinity Quiz` opens auth and does not enable the checkbox.
- Lite and Full users can enable `Infinity Quiz`.
- New category sessions serve static `questions.json` items first.
- Returning category sessions request AI immediately.
- Lite AI requests use batch size 5 and context window 5; Full AI requests use batch size 10 and context window 20.
- Wrong questions repeat exactly after the configured cadence.
- Adaptive answers are persisted through Spring and do not appear in formal quiz history.
- `npm run lint` and `npm run build` pass.

## Live Test Notes
On 2026-05-31, the feature was live-tested with fresh Lite and Full Firebase users against local Spring Boot, Next.js, AI Study Coach, and LM Studio. Browser checks confirmed guest blocking, static-first category warmup, Lite `tier:"lite"` AI prefetch, Full `tier:"full"` prefetch, one mounted question, and exact wrong-question repeat after two intervening answers.
