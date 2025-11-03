package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema (title = "Question Update Request DTO", accessMode = Schema.AccessMode.WRITE_ONLY)
public class QuestionUpdateRequestDto {
    private String questionId;
    private String quizId;
    private String content;
    private List<String> answers;
    private String correctAnswer;

}
