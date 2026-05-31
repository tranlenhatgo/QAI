package com.myproject.quizzai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptivePracticeQuestionDto {

    private String id;
    private String category;
    private String sourceQuestionId;
    private String question;
    private List<String> answers;
    private String correctAnswer;
    private String selectedAnswer;
    private boolean correct;
    private String source;
    private boolean repeated;
    private String generatedFromQuestion;
    private String createdAt;
    private String updatedAt;
}
