package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(title = "Quiz Start Request", accessMode = Schema.AccessMode.WRITE_ONLY)
public class TakeQuizStartRequestDto {
    @NotBlank(message = "Quiz ID cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String quizId;

    private String playerId;

    @NotBlank(message = "Player ID cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String playerName;
}
