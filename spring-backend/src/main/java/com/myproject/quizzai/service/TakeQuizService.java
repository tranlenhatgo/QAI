package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.Firestore;
import com.myproject.quizzai.dto.*;
import com.myproject.quizzai.model.Quiz;
import com.myproject.quizzai.model.Status;
import com.myproject.quizzai.model.TakeQuiz;
import com.myproject.quizzai.utils.IdUtil;
import com.myproject.quizzai.utils.TimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TakeQuizService {

    private final Firestore firestore;
    private static final Logger logger = LoggerFactory.getLogger(TakeQuizService.class);

    private final QuestionService questionService;
    private final QuizService quizService;
    private final TakeQuestionService takeQuestionService;
    private final WebhookService webhookService;

    @SneakyThrows
    public TakeQuizStartResponseDto StartQuiz(TakeQuizStartRequestDto takeQuizDto) {
        String quizId = takeQuizDto.getQuizId();
        String playerName = takeQuizDto.getPlayerName();

        List<QuestionResponseDto> questionDtos = questionService.getQuestionsByQuizId(quizId);

        String id = IdUtil.generateId();

        TakeQuiz takeQuiz = TakeQuiz.builder()
                .id(id)
                .quiz_id(quizId)
                .player_id(takeQuizDto.getPlayerId())
                .player_name(playerName)
                .status(Status.PENDING)
                .start_time(Timestamp.now())
                .created_at(Timestamp.now())
                .updated_at(Timestamp.now())
                .build();

        firestore.collection("take_quiz").document(id).set(takeQuiz).get();

        return new TakeQuizStartResponseDto(id,questionDtos);
    }

    // Method to save a taken quiz
    @SneakyThrows
    public void EndQuiz(TakeQuizEndRequestDto takeQuizDto) {

        String takeId = takeQuizDto.getTakeId();
        List<TakeQuestionSaveRequestDto> takeQuestionDtos = takeQuizDto.getTakeQuestionSaveRequestDtos();

        takeQuestionService.saveTakeQuestions(takeId,takeQuestionDtos);

        String score = takeQuestionService.getScore(takeId);
        TakeQuiz oldTakeQuiz = firestore.collection("take_quiz").document(takeId).get().get().toObject(TakeQuiz.class);
        assert oldTakeQuiz != null;



        TakeQuiz takeQuiz = TakeQuiz.builder()
                .id(takeId)
                .quiz_id(oldTakeQuiz.getQuiz_id())
                .player_id(oldTakeQuiz.getPlayer_id())
                .player_name(oldTakeQuiz.getPlayer_name())
                .score(score)
                .status(Status.ACTIVE)
                .start_time(oldTakeQuiz.getStart_time())
                .end_time(Timestamp.now())
                .created_at(oldTakeQuiz.getCreated_at())
                .updated_at(Timestamp.now())
                .build();

        // Update the quiz status and score in Firestore
        firestore.collection("take_quiz").document(takeId).set(takeQuiz).get();

        // Notify AI Coach via webhook (non-blocking)
        String category = getQuizCategory(oldTakeQuiz.getQuiz_id());
        webhookService.notifyQuizCompleted(takeQuiz, oldTakeQuiz.getQuiz_id(), category, takeQuestionDtos);
    }

    /**
     * Look up quiz category from Firestore.
     * Returns "unknown" if quiz not found.
     */
    @SneakyThrows
    private String getQuizCategory(String quizId) {
        if (quizId == null || quizId.isBlank()) {
            return "unknown";
        }
        Quiz quiz = firestore.collection("quiz").document(quizId).get().get().toObject(Quiz.class);
        if (quiz != null && quiz.getCategories() != null && !quiz.getCategories().isEmpty()) {
            return quiz.getCategories().get(0).name().toLowerCase();
        }
        return "unknown";
    }

    // Method to get a taken quiz by ID
    @SneakyThrows
    public TakeQuiz getTakeQuizById(String id) {
        return firestore.collection("take_quiz").document(id).get().get().toObject(TakeQuiz.class);
    }

    // Method to return a list of taken quiz by take quiz ID
    @SneakyThrows
    public List<TakeQuiz> getTakeQuizByQuizId(String quizId) {
        return firestore.collection("take_quiz")
                .whereEqualTo("quiz_id", quizId)
                .get()
                .get()
                .toObjects(TakeQuiz.class);
    }

    // Method to return a list of taken quiz by player ID
    @SneakyThrows
    public List<TakeQuizResponseDto> getTakeQuizByPlayerId(String playerId) {
        List<TakeQuiz> takeQuizzes = firestore.collection("take_quiz")
                .whereEqualTo("player_id", playerId)
                .get()
                .get()
                .toObjects(TakeQuiz.class);

        List<TakeQuizResponseDto> takeQuizResponseDtos = new ArrayList<>();

        for (TakeQuiz takeQuiz : takeQuizzes) {
            if (takeQuiz.getScore() == null || takeQuiz.getScore().isBlank()) {
                continue;
            }
            String quizId = takeQuiz.getQuiz_id();
            QuizResponseDto quizResponse = quizService.getQuizById(quizId);

            String quizTitle = (quizResponse != null) ? quizResponse.getTitle() : "Unknown Quiz";

            TakeQuizResponseDto takeQuizResponseDto = TakeQuizResponseDto.builder()
                    .quizId(quizId)
                    .quizTitle(quizTitle)
                    .categories(quizResponse != null ? quizResponse.getCategories() : null)
                    .score(takeQuiz.getScore())
                    .status(takeQuiz.getStatus().toString())
                    .updatedAt(TimeUtils.toIsoString(takeQuiz.getUpdated_at()))
                    .build();

            takeQuizResponseDtos.add(takeQuizResponseDto);
        }
        return takeQuizResponseDtos;
    }
}
