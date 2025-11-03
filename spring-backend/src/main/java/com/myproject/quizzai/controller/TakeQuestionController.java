package com.myproject.quizzai.controller;

import com.myproject.quizzai.service.TakeQuestionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(TakeQuestionController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Take Question Controller", description = "Controller for managing questions taken by players")
public class TakeQuestionController {
    public static final String ROOT_MAPPING = "take-question";
    private static final Logger logger = LoggerFactory.getLogger(TakeQuestionController.class);

    private final TakeQuestionService takeQuestionService;

    //POST /take-question/save
//    @PostMapping("/save")
//    @Operation(summary = "Save list of questions taken by players")
//    public ResponseEntity<Map<String, String>> saveTakeQuestions(@RequestBody List<TakeQuestionSaveRequestDto> takeQuestionDtos) {
//        logger.info("saveTakeQuestions() method called with questions: {}", takeQuestionDtos);
//
//        Map<String, String> result = takeQuestionService.saveTakeQuestions(takeQuestionDtos);
//        if (result != null && !result.isEmpty()) {
//            return ResponseEntity.status(HttpStatus.CREATED).body(result);
//        } else {
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
//        }
//    }

    //GET /results?takeId={takeId}
//    @GetMapping("/results")
//    @Operation(summary = "Get number of correct answer and total question taken by a player")
//    public ResponseEntity<Map<String, Integer>> getResultQuestions(@RequestParam String takeId) {
//        logger.info("getResults() method called with take ID: {}", takeId);
//
//        Map<String, Integer> result = takeQuestionService.getScore(takeId);
//        if (result != null && !result.isEmpty()) {
//            return ResponseEntity.ok(result);
//        } else {
//            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
//        }
//    }
}
