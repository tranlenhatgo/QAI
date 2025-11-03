package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.Firestore;
import com.myproject.quizzai.dto.TakeQuestionSaveRequestDto;
import com.myproject.quizzai.model.TakeQuestion;
import com.myproject.quizzai.utils.IdUtil;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
@RequiredArgsConstructor
public class TakeQuestionService {
    private final Firestore firestore;
    private static final Logger logger = LoggerFactory.getLogger(TakeQuestionService.class);


    // Method to save a list of questions taken by players
    @SneakyThrows
    public void saveTakeQuestions(String takeId, List<TakeQuestionSaveRequestDto> takeQuestionDtos) {

        for (TakeQuestionSaveRequestDto takeQuestionDto : takeQuestionDtos) {
            String id = IdUtil.generateId();
            TakeQuestion takeQuestion = TakeQuestion.builder()
                    .id(id)
                    .take_id(takeId)
                    .question_id(takeQuestionDto.getQuestion_id())
                    .answer(takeQuestionDto.getAnswer())
                    .check_answer(String.valueOf(takeQuestionDto.getCheck_answer()))
                    .created_at(Timestamp.now())
                    .updated_at(Timestamp.now())
                    .build();

            // Save the TakeQuestion object to Firestore
            firestore.collection("take_question").document(id).set(takeQuestion).get();
        }

    }

    // Method to get a number of correct answers and total questions for a given take_id
    @SneakyThrows
    public String getScore(String takeId) {
        int correctAnswers = 0;
        int totalQuestions = 0;

        // Query Firestore to get the questions taken by the player
        List<TakeQuestion> takeQuestions = firestore.collection("take_question")
                .whereEqualTo("take_id", takeId)
                .get()
                .get()
                .toObjects(TakeQuestion.class);

        for (TakeQuestion takeQuestion : takeQuestions) {
            totalQuestions++;
            if (takeQuestion.getCheck_answer().equals("CORRECT")) {
                correctAnswers++;
            }
        }

        return String.format("%d/%d", correctAnswers, totalQuestions);
    }

}
