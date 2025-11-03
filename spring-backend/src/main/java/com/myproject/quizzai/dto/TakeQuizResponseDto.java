package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(title = "Take Quiz Response DTO", accessMode = Schema.AccessMode.READ_ONLY)
public class TakeQuizResponseDto {
    private String quizId;
    private String quizTitle;
    private String score;
    private String status;
    private String updatedAt;
}
