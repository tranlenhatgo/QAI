package com.myproject.quizzai.dto;


import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
@Schema(title = "Question Creation Request DTO", accessMode = Schema.AccessMode.WRITE_ONLY)
public class QuestionCreationRequestDto {

    @NotBlank(message = "Quiz ID cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ID of the quiz this question belongs to")
    private String quiz_id;

    @NotBlank(message = "Content cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Content of the question")
    private String content;

    @NotBlank(message = "Answers cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "List of possible answers for the question")
    private List<String> answers;

    @NotBlank(message = "Correct answer cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Correct answer for the question")
    private String correct_answer;

}