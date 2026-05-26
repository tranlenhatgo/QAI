package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(title = "Review Schedule Upsert Request", accessMode = Schema.AccessMode.WRITE_ONLY)
public class ReviewScheduleUpsertDto {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String user_id;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String category;

    @Schema(description = "SM-2 easiness factor (default 2.5)")
    private double easiness;

    @Schema(description = "Current interval in days")
    private int interval_days;

    @Schema(description = "Consecutive successful repetitions")
    private int repetitions;

    @Schema(description = "ISO-8601 timestamp for next review")
    private String next_review;

    @Schema(description = "ISO-8601 timestamp of last review")
    private String last_reviewed;

    @Schema(description = "Score in 'correct/total' format")
    private String last_score;

}
