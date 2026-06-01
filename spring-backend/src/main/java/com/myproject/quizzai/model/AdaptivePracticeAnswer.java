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
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
