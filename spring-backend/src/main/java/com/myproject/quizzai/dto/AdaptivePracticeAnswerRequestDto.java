package com.myproject.quizzai.dto;

import lombok.Data;

import java.util.List;

@Data
public class AdaptivePracticeAnswerRequestDto {

    private String category;
    private String sourceQuestionId;
    private String question;
    private List<String> answers;
    private String correctAnswer;
    private String selectedAnswer;
    private Boolean correct;
    private String source;
    private Boolean repeated;
    private String generatedFromQuestion;
}
