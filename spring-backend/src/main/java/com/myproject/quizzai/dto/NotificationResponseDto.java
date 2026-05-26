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
@Schema(title = "Notification Response", accessMode = Schema.AccessMode.READ_ONLY)
public class NotificationResponseDto {

    private String id;
    private String user_id;
    private String type;
    private String title;
    private String message;
    private boolean read;
    private String created_at;
    private String expires_at;

}
