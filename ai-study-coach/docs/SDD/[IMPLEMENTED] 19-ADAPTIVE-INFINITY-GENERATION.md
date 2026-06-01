# 19 - Adaptive Infinity Generation

## Purpose
Generate compact same-category AI question batches for Adaptive Infinity Quiz while respecting Lite/Full model routing and avoiding silent tier fallback.

## Interface Contract
- Endpoint: `POST /generate/adaptive-questions`
- Auth: `X-API-Key` when `COACH_API_KEY` is configured.
- Request:

```json
{
  "user_id": "firebase-uid",
  "category": "Sports",
  "tier": "lite",
  "count": 5,
  "history": [],
  "wrong_questions": [],
  "recent_questions": []
}
```

- Response:

```json
{
  "questions": [
    {
      "question": "In basketball, how many points is a free throw worth?",
      "answers": ["1", "2", "3", "4"],
      "correctAnswer": "1",
      "topic": "sports",
      "source": "adaptive_ai",
      "generatedFromQuestion": null
    }
  ],
  "tier": "lite"
}
```

## Behavior Specification
1. Validate that `category` is present.
2. Validate `tier` is exactly `lite` or `full`.
3. Validate `count` against the selected tier: Lite requires `5`, Full requires `10`.
4. Use only selected-category context:
   - Lite: last 5 answered questions, wrong-repeat questions, and recent question texts.
   - Full: last 20 answered questions, wrong-repeat questions, and recent question texts.
5. Lite routes to LM Studio local inference with `qwen/qwen3.5-9b`.
6. Full routes to the configured Full provider.
7. If the selected provider is unavailable, return `503`; do not silently switch tier.
8. Generate exactly the selected tier batch size:
   - Lite: 5 multiple-choice questions.
   - Full: 10 multiple-choice questions.
   - same category only;
   - exactly 4 answers;
   - one `correctAnswer` that matches an answer option;
   - `source="adaptive_ai"`;
   - include `topic` and `generatedFromQuestion`.
9. Wrong prior answers should target the same concept or a prerequisite.
10. Correct prior answers should increase difficulty slightly or move to a nearby same-category concept.
11. Validate generated JSON and retry once if a batch is malformed or duplicate-heavy.

## Output Normalization
The route tolerates provider responses that use option labels such as `A`, `B`, `C`, `D`, or numeric labels `1`-`4` for `correctAnswer`. These are mapped to the corresponding answer text before validation.

## Acceptance Criteria
- Missing category returns `400`.
- Missing or invalid tier returns `400`.
- Lite count other than `5` returns `400`; Full count other than `10` returns `400`.
- Lite uses LM Studio and does not call the Full provider.
- Full uses the Full provider and does not fall back to Lite.
- Provider unavailable returns `503`.
- Malformed or duplicate batches retry once, then return `502`.
- `python -m py_compile server/routes/generate.py server/llm/lm_studio.py` passes.

## Live Test Notes
On 2026-05-31, the route was live-tested through the Next.js BFF and directly against AI Study Coach. Direct validation rejected missing category, missing tier, and invalid counts for the selected tier. Lite generation used LM Studio with `qwen/qwen3.5-9b` and returned 5 valid same-category questions. Full generation returned 10 questions with `tier:"full"` when the Full provider was configured.
