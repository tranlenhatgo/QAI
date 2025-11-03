package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
@Schema(title = "Take Quiz Start Response Dto", accessMode = Schema.AccessMode.READ_ONLY)
public class TakeQuizStartResponseDto {
    @NotBlank(message = "Taken Quiz ID cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ID of the taken quiz")
    private String takeId;

    @NotBlank(message = "List of questions cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "List of questions for the quiz")
    private List<QuestionResponseDto> questionResponseDtos; // List of questions for the quiz
}
