# Chapter 6: Testing and Evaluation

## 6.1 Testing Strategy

The project employs a multi-layered testing approach aligned with the testing pyramid:

| Layer | Scope | Tools | Location |
|-------|-------|-------|----------|
| Unit Tests | Individual functions, services | JUnit 5, pytest | Per-service test directories |
| Integration Tests | Service interactions, database | Spring Boot Test, pytest-asyncio | Per-service test directories |
| API Tests | REST endpoint contracts | MockMvc, httpx test client | Per-service test directories |
| Manual/E2E | Full user workflows | Browser-based | Developer-driven |

## 6.2 Spring Boot Testing

### 6.2.1 Unit Tests

Service layer tests mock the Firestore dependency:

```java
@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock private Firestore firestore;
    @Mock private CollectionReference collection;
    @InjectMocks private QuizService quizService;

    @Test
    void createQuiz_validInput_returnsQuizWithId() {
        // Arrange
        QuizCreateDto dto = QuizCreateDto.builder()
            .title("Test Quiz")
            .categories(List.of(Category.SCIENCE))
            .build();
        // ... mock Firestore document set
        
        // Act
        QuizResponseDto result = quizService.create(dto, "user-123");
        
        // Assert
        assertNotNull(result.getId());
        assertEquals("Test Quiz", result.getTitle());
    }
}
```

### 6.2.2 Controller Tests

REST endpoints tested via MockMvc:

```java
@WebMvcTest(QuizController.class)
class QuizControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private QuizService quizService;

    @Test
    void getQuizById_exists_returns200() throws Exception {
        when(quizService.getById("quiz-1")).thenReturn(sampleQuiz());
        
        mockMvc.perform(get("/quiz/quiz-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Sample"));
    }

    @Test
    void getQuizById_notFound_returns404() throws Exception {
        when(quizService.getById("missing")).thenThrow(new ResourceNotFoundException(""));
        
        mockMvc.perform(get("/quiz/missing"))
            .andExpect(status().isNotFound());
    }
}
```

### 6.2.3 Test Coverage

Test reports generated via Maven Surefire:

```bash
./mvnw test
# Reports: target/surefire-reports/
```

## 6.3 AI Coach Testing

### 6.3.1 Unit Tests

Python tests use pytest with mocking for external services:

```python
# tests/test_learning.py

def test_sm2_quality_above_3_increases_interval():
    service = SpacedRepetitionScheduler()
    schedule = ReviewItem(easiness=2.5, interval_days=1, repetitions=0)
    
    result = service.compute_next_review("SCIENCE", 0.9, schedule)
    
    assert result.repetitions == 1
    assert result.interval_days == 1  # First successful: interval stays 1

def test_sm2_second_success_sets_interval_3():
    service = SpacedRepetitionScheduler()
    schedule = ReviewItem(easiness=2.5, interval_days=1, repetitions=1)
    
    result = service.compute_next_review("SCIENCE", 0.9, schedule)
    
    assert result.repetitions == 2
    assert result.interval_days == 3  # Second successful: interval = 3

def test_sm2_failure_resets():
    service = SpacedRepetitionScheduler()
    schedule = ReviewItem(easiness=2.5, interval_days=3, repetitions=2)
    
    result = service.compute_next_review("SCIENCE", 0.3, schedule)
    
    assert result.repetitions == 0
    assert result.interval_days == 0.5  # Reset on failure (12 hours)
```

### 6.3.2 AI Response Quality Tests

Tests verify LLM output parsing and validation:

```python
# tests/test_ai_response.py

def test_parse_generated_questions_valid_json():
    raw = '[{"content": "Q?", "answers": ["A","B","C","D"], "correct_answer": "A"}]'
    questions = parse_questions(raw)
    assert len(questions) == 1
    assert questions[0].correct_answer in questions[0].answers

def test_parse_generated_questions_invalid_format():
    raw = "This is not JSON"
    with pytest.raises(QuestionParseError):
        parse_questions(raw)

def test_validate_question_rejects_less_than_4_answers():
    q = {"content": "Q?", "answers": ["A", "B"], "correct_answer": "A"}
    assert not is_valid_question(q)
```

### 6.3.3 Integration Tests

Test the ingestion pipeline end-to-end:

```python
@pytest.mark.asyncio
async def test_ingest_pdf_extracts_and_chunks():
    with open("tests/fixtures/sample.pdf", "rb") as f:
        content = f.read()
    
    text = _extract_text(content, "sample.pdf")
    assert len(text) > 50
    assert _is_meaningful_text(text)
    
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    assert len(chunks) > 0
    assert all(len(c) <= 500 for c in chunks)

async def test_ingest_image_only_pdf_rejects():
    with open("tests/fixtures/scanned.pdf", "rb") as f:
        content = f.read()
    
    text = _extract_text(content, "scanned.pdf")
    assert not _is_meaningful_text(text)
```

### 6.3.4 Running Tests

```bash
cd ai-study-coach
python -m pytest tests/ -v
```

## 6.4 Frontend Testing Considerations

The frontend relies primarily on:
- **Type checking** via JSDoc annotations (no TypeScript, but IDE support).
- **Manual testing** of UI flows and WebSocket interactions.
- **Browser DevTools** for WebSocket frame inspection and state debugging.

Zustand stores are testable in isolation:
```javascript
// Example: testing parseScore utility
test('parseScore handles valid format', () => {
    const result = parseScore('3/5')
    expect(result.correct).toBe(3)
    expect(result.total).toBe(5)
    expect(result.percent).toBe(60)
})

test('parseScore returns null for invalid', () => {
    expect(parseScore('invalid')).toBeNull()
    expect(parseScore(null)).toBeNull()
})
```

## 6.5 Evaluation Results

### 6.5.1 Functional Requirements Verification

| Requirement | Status | Verification Method |
|-------------|--------|---------------------|
| FR-01: Quiz Management | ✓ Complete | API + UI testing |
| FR-02: AI Question Generation | ✓ Complete | Generated questions validated |
| FR-03: AI Study Coach | ✓ Complete | WebSocket streaming verified |
| FR-04: Spaced Repetition | ✓ Complete | SM-2 unit tests + manual |
| FR-05: Progress Tracking | ✓ Complete | Metrics computation verified |
| FR-06: Document Management | ✓ Complete | Upload → index → search flow |
| FR-07: Step-by-Step Solver | ✓ Complete | LLM output format verified |
| FR-08: Authentication | ✓ Complete | Firebase Auth integration |

### 6.5.2 Non-Functional Requirements Verification

| Requirement | Target | Measured | Status |
|-------------|--------|----------|--------|
| NFR-01.1: Page load | < 3s | ~1.5s (dev) | ✓ |
| NFR-01.2: First token (Lite) | < 2s | ~1.2s | ✓ |
| NFR-01.3: First token (Full) | < 4s | ~2.5s | ✓ |
| NFR-01.4: Generate 5 questions | < 15s | ~8s (Full) | ✓ |
| NFR-01.5: Ingest 10-page PDF | < 30s | ~12s | ✓ |
| NFR-01.6: RAG search | < 500ms | ~200ms | ✓ |

### 6.5.3 AI Quality Assessment

Question generation quality was assessed through manual review of a sample of 50 generated questions across different categories and source materials:

| Metric | Estimated Score | Method |
|--------|----------------|--------|
| Grammatical correctness | ~95% | Manual review |
| Factual accuracy | ~85–90% | Cross-reference with source |
| Distractor plausibility | ~80% | Subjective assessment |
| Appropriate difficulty | ~75% | Expert judgment |
| Format compliance (4 options) | 100% | Automated check |

Note: These are approximate assessments based on manual inspection during development, not formal benchmark results. No automated evaluation pipeline was implemented.

The Full tier (DeepSeek) was observed to produce noticeably higher quality output than Lite tier (local models) in terms of factual accuracy and distractor plausibility.

### 6.5.4 Spaced Repetition Effectiveness

The SM-2 algorithm's effectiveness is well-established in cognitive science literature (see Chapter 2). Our implementation follows the standard algorithm with minor interval adjustments (initial intervals of 1 and 3 days instead of 1 and 6). No controlled user study was conducted within the scope of this project; effectiveness claims are based on the underlying algorithm's published research results.

### 6.5.5 RAG Retrieval Quality

Tested informally with uploaded documents and representative queries during development:

| Metric | Estimated Score | Method |
|--------|----------------|--------|
| Relevant chunk in top 5 results | ~80–85% | Manual inspection |
| Precision of returned results | ~70% | Manual inspection |

Note: These estimates are based on developer testing with a small sample. A formal evaluation with labeled relevance judgments was not conducted. Performance is adequate for educational contexts where approximate retrieval suffices.

## 6.6 Known Limitations

1. **Image-only PDFs**: Cannot process scanned documents (design decision — no OCR).
2. **Local model quality**: Lite tier struggles with complex questions and nuanced distractors.
3. **Context window**: Very long documents may exceed LM Studio's context window during generation.
4. **Concurrent WebSocket**: Not load-tested beyond 10 simultaneous sessions.
5. **Offline AI**: AI features require network (even Lite tier needs LM Studio running locally).
