package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.QuizCreationRequestDto;
import com.myproject.quizzai.dto.QuizResponseDto;
import com.myproject.quizzai.model.Quiz;
import com.myproject.quizzai.service.QuizService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping(QuizController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Quiz Controller", description = "Controller for managing quizzes")
public class QuizController {
    public static final String ROOT_MAPPING = "quiz";
    private static final Logger logger = LoggerFactory.getLogger(QuizController.class);

    private final QuizService quizService;

    //POST /quiz
    @PostMapping
    @Operation(summary = "Create a new quiz")
    public ResponseEntity<Map<String, String>> create(@Valid @RequestBody QuizCreationRequestDto quizCreationRequest) {
        logger.info("create() method called with request: {}", quizCreationRequest);

        String quizId = quizService.create(quizCreationRequest);
        //create a json for response
        Map<String, String> response = new HashMap<>();
        response.put("quizId", quizId);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // Find quiz by User ID
    // GET /quiz/user/{userId}
    @GetMapping("/user/{userId}")
    @Operation(summary = "Get quiz by user ID")
    public ResponseEntity<List<QuizResponseDto>> getQuizByUserId(@PathVariable String userId) {
        logger.info("getQuizByUserId() method called with user ID: {}", userId);

        List<QuizResponseDto> quiz = quizService.getQuizByUserId(userId);
        if (quiz != null && !quiz.isEmpty()) {
            return ResponseEntity.ok(quiz);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    // Get quiz by ID
    // GET /quiz/{id}
    @GetMapping("/{id}")
    @Operation(summary = "Get quiz by ID")
    public ResponseEntity<QuizResponseDto> getQuizById(@PathVariable String id) {
        logger.info("getQuizById() method called with ID: {}", id);

        QuizResponseDto quiz = quizService.getQuizById(id);
        if (quiz != null) {
            return ResponseEntity.ok(quiz);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    //Update quiz by ID
    // PUT /quiz/update/{id}
    @PutMapping("/update/{id}")
    @Operation(summary = "Update quiz by ID")
    public ResponseEntity<Void> updateQuiz(@PathVariable String id, @Valid @RequestBody QuizCreationRequestDto quizCreationRequest) {
        logger.info("updateQuizById() method called with ID: {} and request: {}", id, quizCreationRequest);

        quizService.updateQuizById(id, quizCreationRequest);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    // Get all active quizzes
    // GET /quiz
    @GetMapping
    @Operation(summary = "Get all active quizzes")
    public ResponseEntity<List<QuizResponseDto>> getAllQuizzes() {
        logger.info("getAllQuizzes() method called");

        List<QuizResponseDto> quizzes = quizService.getAllQuizzes();
        return ResponseEntity.ok(quizzes);
    }

    // Get quizzes by category
    // GET /quiz/category/{category}
    @GetMapping("/category/{category}")
    @Operation(summary = "Get active quizzes by category")
    public ResponseEntity<List<QuizResponseDto>> getQuizzesByCategory(@PathVariable String category) {
        logger.info("getQuizzesByCategory() method called with category: {}", category);

        List<QuizResponseDto> quizzes = quizService.getQuizzesByCategory(category);
        return ResponseEntity.ok(quizzes);
    }
}
