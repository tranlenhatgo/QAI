package com.myproject.quizzai.service;

import com.myproject.quizzai.dto.UserQuizResponseDto;
import lombok.SneakyThrows;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final QuizService quizService;
    private final TakeQuizService takeQuizService;

    public UserService(QuizService quizService, TakeQuizService takeQuizService) {
        this.quizService = quizService;
        this.takeQuizService = takeQuizService;
    }

    @SneakyThrows
    public UserQuizResponseDto getQuizProfile(String userId) {
        // Simulate a delay for demonstration purposes

        // Create a dummy response
        UserQuizResponseDto response = new UserQuizResponseDto();
        response.setQuizzesCreated(quizService.getQuizByUserId(userId));
        response.setQuizzesTaken(takeQuizService.getTakeQuizByPlayerId(userId));

        return response;
    }
}
