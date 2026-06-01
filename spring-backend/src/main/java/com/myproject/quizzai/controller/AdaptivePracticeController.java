package com.myproject.quizzai.controller;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.myproject.quizzai.dto.AdaptivePracticeAnswerRequestDto;
import com.myproject.quizzai.dto.AdaptivePracticeQuestionDto;
import com.myproject.quizzai.dto.AdaptivePracticeSessionStateResponseDto;
import com.myproject.quizzai.service.AdaptivePracticeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(AdaptivePracticeController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Adaptive Practice Controller", description = "Adaptive Infinity Quiz practice journal")
public class AdaptivePracticeController {

    public static final String ROOT_MAPPING = "adaptive-practice";
    private static final Logger logger = LoggerFactory.getLogger(AdaptivePracticeController.class);

    private final AdaptivePracticeService adaptivePracticeService;
    private final FirebaseAuth firebaseAuth;

    @GetMapping("/session-state")
    @Operation(summary = "Get selected-category adaptive practice state")
    public ResponseEntity<AdaptivePracticeSessionStateResponseDto> getSessionState(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam String category
    ) {
        String userId = requireUserId(authorization);
        logger.info("getSessionState() user={} category={}", userId, category);
        return ResponseEntity.ok(adaptivePracticeService.getSessionState(userId, category));
    }

    @PostMapping("/answer")
    @Operation(summary = "Save one adaptive practice answer")
    public ResponseEntity<AdaptivePracticeQuestionDto> saveAnswer(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody AdaptivePracticeAnswerRequestDto dto
    ) {
        String userId = requireUserId(authorization);
        logger.info("saveAnswer() user={} category={} source={}", userId, dto == null ? null : dto.getCategory(), dto == null ? null : dto.getSource());
        return ResponseEntity.status(HttpStatus.CREATED).body(adaptivePracticeService.saveAnswer(userId, dto));
    }

    private String requireUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        try {
            return firebaseAuth.verifyIdToken(token).getUid();
        } catch (FirebaseAuthException error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid auth token", error);
        }
    }
}
