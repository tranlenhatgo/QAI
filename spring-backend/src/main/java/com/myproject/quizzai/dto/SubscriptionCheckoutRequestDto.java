package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(title = "Subscription Checkout Request", accessMode = Schema.AccessMode.WRITE_ONLY)
public class SubscriptionCheckoutRequestDto {

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "monthly | yearly | forever")
    private String plan;

}
