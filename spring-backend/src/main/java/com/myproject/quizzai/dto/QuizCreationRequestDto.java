package com.myproject.quizzai.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.google.cloud.Timestamp;
import com.myproject.quizzai.model.Category;
import com.myproject.quizzai.utils.TimestampDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import lombok.SneakyThrows;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Schema(title = "Quiz Creation Request DTO", accessMode = Schema.AccessMode.WRITE_ONLY)
public class QuizCreationRequestDto {

    private String user_id;

    @NotBlank(message = "Title cannot be blank")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String title;

    private String description;

    @Schema(description = "List of category IDs related to the quiz")
    private List<String> categories;

    @Schema(description = "Start time of the quiz")
    @JsonDeserialize(using = TimestampDeserializer.class)
    private Timestamp start_time;

    @Schema(description = "End time of the quiz")
    @JsonDeserialize(using = TimestampDeserializer.class)
    private Timestamp end_time;

    @SneakyThrows
    public List<Category> getCategories() {
        List<Category> categoriesEnum = new ArrayList<>();

        if (this.categories != null) {
            for (String category : this.categories) {
                categoriesEnum.add(Category.valueOf(category));
            }
        }
        return categoriesEnum;
    }


}

