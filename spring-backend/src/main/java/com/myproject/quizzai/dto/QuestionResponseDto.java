package com.myproject.quizzai.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.google.cloud.Timestamp;
import com.myproject.quizzai.model.Status;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@Schema(title = "QuestionResponse", accessMode = Schema.AccessMode.READ_ONLY)
public class QuestionResponseDto {
    private String id;
    private String quizId;
    private String question;
    private List<String> answers;
    private String correctAnswer;
}
