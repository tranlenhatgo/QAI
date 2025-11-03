package com.myproject.quizzai.dto;

import com.myproject.quizzai.model.CheckAnswer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Objects;

@Data
@Schema(title = "Take Question Save Request DTO", accessMode = Schema.AccessMode.WRITE_ONLY)
public class TakeQuestionSaveRequestDto {

    @NotBlank(message = "Question ID cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "ID of the question this answer belongs to")
    private String question_id;

    @NotBlank(message = "Answer cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Answer provided by the player")
    private String answer;

    @NotBlank(message = "Check Answer cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Check answer provided by the player")
    private CheckAnswer check_answer;

    public void setCheck_answer(String check_answer) {
        if (Objects.equals(check_answer, "1")) {
            this.check_answer = CheckAnswer.CORRECT;
        } else if (Objects.equals(check_answer,  "2")) {
            this.check_answer = CheckAnswer.CORRECT;
        } else if (Objects.equals(check_answer, "-1")) {
            this.check_answer = CheckAnswer.INCORRECT;
        } else {
            this.check_answer = CheckAnswer.NOT_ANSWERED;
        }
    }
}
