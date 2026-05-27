# 08 — Quiz Generation

## Purpose

Generate quizzes based on study materials (RAG) or specified topics. Supports multiple question types. Used in Full Agentic mode as a multi-step capability (retrieve context → plan questions → generate → validate format).

**Design constraint**: The frontend enforces single-category selection for quiz generation. All generated questions belong to one category, ensuring accurate AI tracking (spaced repetition, progress, weakness analysis).

---

## Interface Contract

```python
class QuizGenerator:
    """
    Generates quizzes from study materials or topics.
    
    Can be invoked:
    1. As part of the agentic loop (LLM decides to generate a quiz)
    2. As a direct capability (user explicitly requests a quiz)
    """

    async def generate(
        self,
        topic: str,
        num_questions: int = 5,
        question_types: list[str] = ["multiple_choice", "short_answer"],
        difficulty: str = "medium",
        context: str = "",  # RAG context if available
        on_event: Callable = None,
    ) -> Quiz:
        """
        Generate a structured quiz.
        
        Returns: Quiz object with questions, options, and answers.
        """
```

---

## Data Shapes

```python
# server/capabilities/quiz.py

from dataclasses import dataclass, field
from enum import Enum

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"
    TRUE_FALSE = "true_false"
    FILL_BLANK = "fill_blank"

class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

@dataclass
class QuizOption:
    """A single option for multiple choice questions."""
    label: str       # "A", "B", "C", "D"
    text: str        # The option text
    is_correct: bool

@dataclass
class QuizQuestion:
    """A single quiz question."""
    id: int
    type: QuestionType
    question: str
    options: list[QuizOption] | None = None  # For multiple_choice
    correct_answer: str = ""                  # For short_answer, true_false, fill_blank
    explanation: str = ""                     # Why this is the correct answer
    difficulty: Difficulty = Difficulty.MEDIUM
    topic: str = ""

@dataclass
class Quiz:
    """A complete quiz."""
    title: str
    topic: str
    questions: list[QuizQuestion]
    difficulty: Difficulty
    generated_at: str = ""
    source: str = ""  # "rag" if from study materials, "general" if from LLM knowledge
```

---

## Behavior Specification

### Quiz Generation Flow

```text
┌──────────────────────────────────────────────────────────┐
│                 QUIZ GENERATION PIPELINE                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. CONTEXT GATHERING                                     │
│     ├─ If kb_id exists → RAG search for topic            │
│     └─ If no kb_id → use LLM's general knowledge         │
│                                                           │
│  2. QUESTION PLANNING                                     │
│     └─ LLM plans N questions with type distribution       │
│                                                           │
│  3. QUESTION GENERATION                                   │
│     └─ LLM generates each question with structured output │
│                                                           │
│  4. VALIDATION                                            │
│     ├─ JSON structure check                               │
│     ├─ Exactly one correct answer per MC question         │
│     └─ No duplicate questions                             │
│                                                           │
│  5. RETURN Quiz object                                    │
└──────────────────────────────────────────────────────────┘
```

### Implementation

````python
# server/capabilities/quiz.py

import json
from server.llm.base import LLMService, Message, Role

class QuizGenerator:
    def __init__(self, llm: LLMService, rag_tool: RAGTool | None = None):
        self.llm = llm
        self.rag = rag_tool
    
    async def generate(
        self,
        topic: str,
        num_questions: int = 5,
        question_types: list[str] = ["multiple_choice", "short_answer"],
        difficulty: str = "medium",
        context: str = "",
        kb_id: str = "",
        on_event=None,
    ) -> Quiz:
        # Step 1: Gather context
        if not context and self.rag and kb_id:
            if on_event:
                await on_event({"type": "stage", "stage": "searching_materials", "status": "start"})
            context = await self.rag.execute({"query": topic, "kb_id": kb_id})
            if on_event:
                await on_event({"type": "stage", "stage": "searching_materials", "status": "end"})
        
        # Step 2 & 3: Generate questions via LLM
        if on_event:
            await on_event({"type": "stage", "stage": "generating_questions", "status": "start"})
        
        prompt = self._build_generation_prompt(
            topic, num_questions, question_types, difficulty, context
        )
        
        result = await self.llm.complete_sync(
            messages=[
                Message(role=Role.SYSTEM, content=QUIZ_SYSTEM_PROMPT),
                Message(role=Role.USER, content=prompt),
            ],
            tools=None,
        )
        
        if on_event:
            await on_event({"type": "stage", "stage": "generating_questions", "status": "end"})
        
        # Step 4: Parse and validate
        quiz = self._parse_quiz_response(result.content, topic, difficulty)
        
        return quiz
    
    def _build_generation_prompt(self, topic, num_questions, types, difficulty, context):
        type_str = ", ".join(types)
        
        prompt = f"""Generate a quiz about: {topic}

Requirements:
- Number of questions: {num_questions}
- Question types: {type_str}
- Difficulty: {difficulty}
"""
        if context:
            prompt += f"""
Use the following study material as the source for questions:

---
{context}
---

Generate questions that test understanding of this material.
"""
        else:
            prompt += "\nGenerate questions from your general knowledge about this topic.\n"
        
        prompt += """
Respond with a JSON array of questions. Each question must have this structure:
```json
[
  {
    "type": "multiple_choice",
    "question": "What is...?",
    "options": [
      {"label": "A", "text": "Option text", "is_correct": false},
      {"label": "B", "text": "Option text", "is_correct": true},
      {"label": "C", "text": "Option text", "is_correct": false},
      {"label": "D", "text": "Option text", "is_correct": false}
    ],
    "explanation": "B is correct because...",
    "topic": "subtopic name"
  },
  {
    "type": "short_answer",
    "question": "Explain...",
    "correct_answer": "The expected answer...",
    "explanation": "This is correct because...",
    "topic": "subtopic name"
  }
]
```

IMPORTANT: Return ONLY the JSON array, no other text."""
        
        return prompt
    
    def _parse_quiz_response(self, response: str, topic: str, difficulty: str) -> Quiz:
        """Parse LLM JSON response into Quiz object."""
        # Extract JSON from response (handle markdown code blocks)
        json_str = response.strip()
        if json_str.startswith("```"):
            json_str = json_str.split("\n", 1)[1]
            json_str = json_str.rsplit("```", 1)[0]
        
        try:
            questions_data = json.loads(json_str)
        except json.JSONDecodeError:
            # Attempt repair: find first [ and last ]
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                questions_data = json.loads(response[start:end])
            else:
                raise ValueError("Failed to parse quiz JSON from LLM response")
        
        # Convert to QuizQuestion objects
        questions = []
        for i, q in enumerate(questions_data):
            question = QuizQuestion(
                id=i + 1,
                type=QuestionType(q["type"]),
                question=q["question"],
                explanation=q.get("explanation", ""),
                difficulty=Difficulty(difficulty),
                topic=q.get("topic", topic),
            )
            
            if q["type"] == "multiple_choice":
                question.options = [
                    QuizOption(
                        label=opt["label"],
                        text=opt["text"],
                        is_correct=opt["is_correct"],
                    )
                    for opt in q["options"]
                ]
                # Validate exactly one correct answer
                correct_count = sum(1 for o in question.options if o.is_correct)
                if correct_count != 1:
                    # Fix: mark first option as correct if none/multiple
                    for opt in question.options:
                        opt.is_correct = False
                    question.options[0].is_correct = True
            else:
                question.correct_answer = q.get("correct_answer", "")
            
            questions.append(question)
        
        return Quiz(
            title=f"Quiz: {topic}",
            topic=topic,
            questions=questions,
            difficulty=Difficulty(difficulty),
            source="rag" if questions_data else "general",
        )
````

### Quiz System Prompt

```python
QUIZ_SYSTEM_PROMPT = """You are a quiz generator for an educational platform.

Rules:
1. Generate clear, unambiguous questions
2. For multiple choice: exactly 4 options, exactly 1 correct
3. Distractors should be plausible but clearly wrong to someone who studied
4. Explanations should teach WHY the answer is correct
5. Match the requested difficulty:
   - Easy: recall/recognition questions
   - Medium: understanding/application questions
   - Hard: analysis/synthesis questions
6. Output ONLY valid JSON — no markdown, no explanations outside the JSON
7. Each question must be self-contained (no "as mentioned above")
"""
```

---

## Integration with Agentic Mode

In Full Agentic mode, the quiz generation can be triggered by the LLM deciding to generate a quiz. This is NOT a separate tool — it's a **capability** the orchestrator activates based on user intent.

```python
# How it connects to the agentic loop:

# Option A: LLM uses existing tools to gather data, then orchestrator 
#           detects quiz intent and switches to quiz generation mode.

# Option B (Simpler): Add a "generate_quiz" tool definition that wraps QuizGenerator

class GenerateQuizTool(BaseTool):
    name = "generate_quiz"
    description = "Generate a quiz for the student on a given topic. Use when the student asks for a quiz, practice questions, or test."
    
    def parameters_schema(self):
        return {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "Topic for the quiz"},
                "num_questions": {"type": "integer", "description": "Number of questions (default: 5)"},
                "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
            },
            "required": ["topic"]
        }
    
    async def execute(self, arguments: dict) -> str:
        quiz = await self.generator.generate(
            topic=arguments["topic"],
            num_questions=arguments.get("num_questions", 5),
            difficulty=arguments.get("difficulty", "medium"),
            kb_id=self.session_kb_id,
        )
        # Return as JSON string for LLM to format nicely
        return json.dumps(asdict(quiz), indent=2)
```

---

## WebSocket Events During Quiz Generation

```json
{"type": "stage", "stage": "searching_materials", "status": "start"}
{"type": "stage", "stage": "searching_materials", "status": "end"}
{"type": "stage", "stage": "generating_questions", "status": "start"}
{"type": "stage", "stage": "generating_questions", "status": "end"}
{"type": "content", "content": "Here's your quiz on Photosynthesis:\n\n"}
{"type": "content", "content": "**Question 1** (Multiple Choice)..."}
```

---

## Acceptance Criteria

- [ ] Generates valid Quiz objects with the requested number of questions
- [ ] Supports multiple_choice, short_answer, true_false, fill_blank types
- [ ] Multiple choice questions have exactly 4 options and 1 correct answer
- [ ] RAG context is used when kb_id is available
- [ ] Works without RAG (general knowledge) when no kb_id
- [ ] JSON parsing handles markdown code blocks in LLM response
- [ ] JSON repair attempted on parse failure (find `[...]` bounds)
- [ ] Difficulty levels produce appropriately challenging questions
- [ ] Stage events are emitted during generation
- [ ] Generated questions are self-contained (no cross-references)
- [ ] Explanations are present for every question
- [ ] Can be used as a tool (GenerateQuizTool) in the agentic loop

---

## Dependencies

- `server/llm/base.py` — LLMService
- `server/tools/rag.py` — RAGTool (optional)
- `json` (stdlib)

---

## DeepTutor Reference

| This Module | DeepTutor Equivalent | What Changed |
| ------------- | --------------------- | -------------- |
| `QuizGenerator` | `deeptutor/capabilities/deep_question/` | Single-stage instead of 3-stage pipeline |
| Question types | 6 types in DeepTutor | Reduced to 4 most common types |
| JSON parsing | `repair_json()` utility | Simplified repair (bracket bounds only) |
| Validation | `quiz_validator.py` | Inline validation, no separate validator |
| Mimic mode (PDF clone) | `mimic_strategy.py` | Removed entirely (too complex) |
| Followup mode | `followup_strategy.py` | Removed (not needed for MVP) |
