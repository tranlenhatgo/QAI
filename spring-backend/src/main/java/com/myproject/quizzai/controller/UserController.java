package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.UserQuizResponseDto;
import com.myproject.quizzai.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(UserController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Take Quiz Controller", description = "Controller for managing quiz taked by players")
public class UserController {
    public static final String ROOT_MAPPING = "user";
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    private final UserService userService;

    // Add your methods here

    @GetMapping("/quiz-profile")
    public ResponseEntity<UserQuizResponseDto> getQuizProfile(@RequestParam String userId) {
        logger.info("getQuizProfile() method called with user ID: {}", userId);

        UserQuizResponseDto quizProfile = userService.getQuizProfile(userId);

        return ResponseEntity.ok(quizProfile);

    }
}
