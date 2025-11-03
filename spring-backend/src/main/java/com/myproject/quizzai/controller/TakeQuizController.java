package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.TakeQuizEndRequestDto;
import com.myproject.quizzai.dto.TakeQuizStartRequestDto;
import com.myproject.quizzai.dto.TakeQuizStartResponseDto;
import com.myproject.quizzai.service.TakeQuizService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(TakeQuizController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Take Quiz Controller", description = "Controller for managing quiz taked by players")
public class TakeQuizController {
    public static final String ROOT_MAPPING = "take-quiz";
    private static final Logger logger = LoggerFactory.getLogger(TakeQuizController.class);

    private final TakeQuizService takeQuizService;

    //POST /take-quiz/start
    @PostMapping("/start")
    @Operation(summary = "Start a quiz")
    public ResponseEntity<TakeQuizStartResponseDto> StartQuiz(@RequestBody TakeQuizStartRequestDto takeQuizDto) {
        logger.info("StartQuiz() method called with quiz ID: {}", takeQuizDto.getQuizId());

        TakeQuizStartResponseDto startResponseDto = takeQuizService.StartQuiz(takeQuizDto);

        return new ResponseEntity<>(startResponseDto, HttpStatus.OK);
    }

    //GET /take-quiz/end
    @PostMapping("/end")
    @Operation(summary = "End a quiz")
    public ResponseEntity<Map<String, String>> EndQuiz(@RequestBody TakeQuizEndRequestDto takeQuizDto) {
        logger.info("EndQuiz() method called with take ID: {}", takeQuizDto.getTakeId());

        takeQuizService.EndQuiz(takeQuizDto);

        Map<String, String> response = Map.of("message", "Quiz ended successfully");
        return new ResponseEntity<>(response, HttpStatus.OK);
    }


}
