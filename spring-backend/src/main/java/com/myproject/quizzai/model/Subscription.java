package com.myproject.quizzai.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Subscription {

    @DocumentId
    private String id;
    private String plan;
    private boolean fullAccess;
    private String subscriptionStatus;
    private String source;
    private Integer priceUsd;
    private Timestamp startedAt;
    private Timestamp expiresAt;
    private Timestamp createdAt;
    private Timestamp updatedAt;

}
