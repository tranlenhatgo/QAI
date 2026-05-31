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
@Schema(title = "Subscription Response", accessMode = Schema.AccessMode.READ_ONLY)
public class SubscriptionResponseDto {

    private String plan;
    private boolean fullAccess;
    private String subscriptionStatus;
    private String source;
    private Integer priceUsd;
    private String startedAt;
    private String expiresAt;
    private String createdAt;
    private String updatedAt;

}
