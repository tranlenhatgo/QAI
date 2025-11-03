package com.myproject.quizzai.dto;

import com.google.cloud.Timestamp;
import com.myproject.quizzai.model.Status;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(title = "QuizResponse", accessMode = Schema.AccessMode.READ_ONLY)
public class QuizResponseDto {
    private String quiz_id;
    private String host_id;
    private String title;
    private String description;
    private String status;
    private List<String> categories;
    private String start_time;
    private String end_time;
}
