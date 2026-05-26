package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(title = "Notification Creation Request", accessMode = Schema.AccessMode.WRITE_ONLY)
public class NotificationCreateDto {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String user_id;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "REVIEW_DUE | PROGRESS_MILESTONE")
    private String type;

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private String title;

    private String message;

    @Schema(description = "ISO-8601 expiry timestamp (optional)")
    private String expires_at;

}
