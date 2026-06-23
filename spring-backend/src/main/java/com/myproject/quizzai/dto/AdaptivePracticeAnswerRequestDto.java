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
    private String templateId;
    private String subskill;
    private String difficulty;
    private String explanation;
    private String adaptationReason;
    private String planningIntent;
    private String validationStatus;
    private Double masteryBefore;
    private Double masteryAfter;
    private Integer attemptIndex;
}
