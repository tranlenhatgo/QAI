# Category & AI Feature Compatibility — Fix Plan

## Problem Statement

The quiz schema and AI features (weakness analysis, spaced repetition, progress tracking) had fundamental compatibility issues that caused incorrect category reporting.

**User-reported symptom**: Took a Math quiz → weakness analysis shows "General Knowledge" instead of "Math".

**Resolution**: Phase 1 fixed category normalization and null-safety. Phase 2 enforced single-category-per-quiz constraint, ensuring the AI features always attribute results to the correct category.

---

## Phase 1 Status: ✅ COMPLETED

**Changes applied:**

| File | Change |
| --- | --- |
| `spring-backend/.../QuizService.java` | Null-safety on `getCategories()`, return lowercase |
| `spring-backend/.../TakeQuizService.java` | Null/blank check on quizId in `getQuizCategory()` |
| `ai-study-coach/server/learning/weakness.py` | Normalize categories to lowercase, fallback "general" |
| `ai-study-coach/server/learning/progress.py` | Fallback aligned to lowercase "general" |
| `frontend/src/assets/categories.json` | Added Math, Literature, Sports |
| `AGENTS.md` (root) | Categories convention: "always lowercase in API responses" |
| `spring-backend/AGENTS.md` | Documented null-safety + lowercase output |

**Verified:** Spring Boot compiles ✅ | AI Coach tests 10/10 ✅

---

## Root Causes Identified

### 1. Question-Level Category Missing

**The core design gap**: Questions have NO individual `category` field.

| Layer | Category lives at |
| --- | --- |
| Quiz (Firestore) | `quiz.categories: List<Category>` (quiz-level, can be multiple) |
| Question (Firestore) | ❌ No category field |
| TakeQuiz (Firestore) | ❌ No category field |
| AI Coach webhook payload | Single `category` string (first quiz category only) |

**Impact**: If a quiz has 5 categories (e.g., Math, Science, History, Geography, Art), ALL questions in that quiz are attributed to ALL 5 categories equally. The AI cannot track which specific question belongs to which category. A student who got all Math questions correct but all Science questions wrong would show identical accuracy for both.

### 2. Fallback to "GENERAL" When Quiz Lookup Fails

In both `weakness.py` and `progress.py`:

```python
try:
    quiz = await quiz_client.get_quiz_details(quiz_id)
    categories = quiz.categories if quiz and quiz.categories else ["GENERAL"]
except Exception:
    categories = ["GENERAL"]
```

If `get_quiz_details()` returns 404 (quiz not in Firestore) or throws (NPE in Spring Boot), the fallback `["GENERAL"]` is used silently.

**When this happens**:

- "New Game" mode: AI-generated questions are never saved as a quiz document → `quiz_id` is empty or points to nothing
- Quiz deleted after being played
- Spring Boot NPE if `quiz.getCategories()` is null

### 3. Category Casing Inconsistency

| Component | Category format | Example |
| --- | --- | --- |
| Java Category enum | UPPER_SNAKE | `MATH`, `GENERAL_CULTURE` |
| Spring Boot API response | lowercase (after fix) | `["math", "science"]` |
| Webhook payload | lowercase | `"math"` |
| Frontend categories.json | Display names | `"General culture"` |
| Frontend save payload | UPPER_SNAKE | `"GENERAL_CULTURE"` |
| AI Coach spaced_repetition | lowercase (from webhook) | `"math"` |
| AI Coach progress.py | Normalized to lowercase | `"math"` |
| AI Coach weakness.py | Normalized to lowercase (after fix) | `"math"` |
| Firestore review_schedule | lowercase | `"math"` |

### 4. Frontend Was Missing Categories

`frontend/src/assets/categories.json` was missing 3 categories from the Java enum:

- ✅ Fixed: Added Math, Literature, Sports

### 5. Webhook Only Sends First Category

```java
// TakeQuizService.getQuizCategory()
return quiz.getCategories().get(0).name().toLowerCase();
```

For multi-category quizzes, only the FIRST category is sent to the AI Coach. All spaced repetition scheduling happens under that single category.

### 6. "New Game" Quizzes Have No Persistence for AI Features

The "New Game" flow (PlayForm → AI-generated questions → play → GameOver):

- Questions are generated on-the-fly
- **No quiz document is created in Firestore**
- **No take_quiz record is created** (only quiz room mode calls `takeQuiz()`)
- **No webhook is fired** (webhook only fires from `TakeQuizService.EndQuiz()`)
- **Zero tracking** by AI features

This means: casual play (non-quiz-room) is completely invisible to the AI Coach. No weakness analysis, no spaced repetition, no progress tracking.

### 7. NPE Risk in QuizService

```java
// QuizService.getQuizById() — FIXED in Phase 1
.categories(quiz.getCategories() != null
    ? quiz.getCategories().stream().map(c -> c.name().toLowerCase()).toList()
    : Collections.emptyList())
```

---

## Fix Plan

### Phase 1: Critical — Fix Category Consistency ✅ DONE

- 1.1 Normalize categories to lowercase everywhere ✅
- 1.2 Fix null-safety in QuizService ✅
- 1.3 Fix weakness.py to normalize categories ✅
- 1.4 Sync frontend categories.json with Java enum ✅

---

### Phase 2: Enforce Single Category Per Quiz ✅ COMPLETED

**Rationale**: The AI features work correctly when a quiz has exactly 1 category. Instead of adding per-question categories (complex), enforce the constraint that solves the problem simply.

**Changes applied:**

| File | Change |
| --- | --- |
| `frontend/src/components/Create/CreateInfo.jsx` | `handleCategoryToggle` now replaces selection (single-select) |
| `frontend/src/components/Form/NewGameForm.jsx` | Changed checkboxes to radio buttons for categories |
| `frontend/src/components/Form/PlayForm.jsx` | `handleInputs` sets categories to single-item array |
| `frontend/src/components/Form/CreateQuizRoomForm.jsx` | Changed checkboxes to radio buttons, single-select handler |
| `frontend/src/components/Form/QuizBrowser.jsx` | Added category dropdown filter for browsing quizzes by category |
| `frontend/src/store/useCreate.js` | `addCreatedCategory` replaces array; default `quizQuery.categories` is `[]` |
| `frontend/src/helpers/gameConfig.js` | `queryValidator` limits categories to 1 item |
| `spring-backend/.../QuizCreationRequestDto.java` | `@Size(max = 1)` validation on `categories` field |
| `spring-backend/.../QuizController.java` | Added `@Valid` on create/update + new `GET /quiz/category/{category}` endpoint |
| `spring-backend/.../QuizService.java` | Added `getQuizzesByCategory()` — Firestore `whereArrayContains` query |

**Verified:** Spring Boot compiles ✅ | Frontend lint ✅ (no warnings/errors)

---

### Phase 3: Track Non-Quiz-Room Play (Future)

#### 3.1 Save AI-generated games as quiz documents

When `GameOver` renders for a non-quiz-room game, auto-persist:

1. Create a quiz document with category derived from the topic
2. Create a take_quiz record
3. Call `save-attempt` endpoint → triggers webhook → AI Coach tracks it

**Pros**: Full tracking, no AI Coach changes needed.
**Cons**: Generates many quiz documents (could clutter user's quiz list — mark as `status: GENERATED`).

#### 3.2 Alternative: Direct tracking endpoint

Add a lightweight `/api/coach/track-game` BFF route that sends results directly to AI Coach without persisting a quiz document. Simpler but bypasses the established data flow.

---

### Phase 4: Multi-Category Handling (Future Work)

If multi-category quizzes are ever needed:

1. Add `category` field to `Question` model (nullable, inherits quiz category if null)
2. Update AI generation to tag each question with its category
3. Webhook sends per-question categories
4. Weakness/progress analyzers use question-level categories

This is documented as "future work" in the thesis.

---

## Priority Order

| Phase | Effort | Impact | Status |
| --- | --- | --- | --- |
| 1.1 Normalize casing | Small | Fixes display inconsistency | ✅ Done |
| 1.2 Null safety | Small | Prevents silent failures | ✅ Done |
| 1.3 weakness.py normalize | Small | Fixes the reported bug | ✅ Done |
| 1.4 Frontend categories | Small | Allows selecting Math | ✅ Done |
| 2.x Single category enforcement | Small | Prevents multi-cat accuracy issues | ✅ Done |
| 3.x Track non-quiz games | Medium | Enables AI for casual play | 🔲 Future |
| 4.x Per-question categories | Large | Full multi-category support | 🔲 Future work |

---

## Testing After Fix

1. Create a quiz with category "MATH" (single category — the only option now)
2. Take the quiz, get a score
3. Check webhook fires with `category: "math"`
4. Check `GET /progress/{userId}` returns `categories: [{category: "math", ...}]`
5. Chat with AI: "What are my weak areas?" → should show "math" not "general"
6. Check `review_schedule` Firestore has `category: "math"`
7. Try creating quiz → frontend only allows selecting 1 category (radio buttons)
8. POST to `/quiz` with 2+ categories → backend returns 400 validation error
9. Browse quizzes by category → QuizBrowser dropdown filters correctly
10. `GET /quiz/category/math` → returns only quizzes with math category
