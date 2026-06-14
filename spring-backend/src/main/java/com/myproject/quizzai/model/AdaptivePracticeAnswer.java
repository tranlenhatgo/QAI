package com.myproject.quizzai.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptivePracticeAnswer {

    @DocumentId
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
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
