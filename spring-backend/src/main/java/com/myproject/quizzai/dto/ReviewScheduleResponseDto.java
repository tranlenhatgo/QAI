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
@Schema(title = "Review Schedule Response", accessMode = Schema.AccessMode.READ_ONLY)
public class ReviewScheduleResponseDto {

    private String id;
    private String user_id;
    private String category;
    private double easiness;
    private double interval_days;
    private int repetitions;
    private String next_review;
    private String last_reviewed;
    private String last_score;
    private String updated_at;

}
