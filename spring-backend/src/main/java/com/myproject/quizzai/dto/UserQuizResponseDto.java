package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(title = "User Quiz Response DTO", accessMode = Schema.AccessMode.READ_ONLY)
public class UserQuizResponseDto {
    private List<QuizResponseDto> quizzesCreated;

    private List<TakeQuizResponseDto> quizzesTaken;
}
