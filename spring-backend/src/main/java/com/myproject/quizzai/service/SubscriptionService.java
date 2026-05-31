package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.myproject.quizzai.dto.SubscriptionCheckoutRequestDto;
import com.myproject.quizzai.dto.SubscriptionResponseDto;
import com.myproject.quizzai.model.Subscription;
import com.myproject.quizzai.utils.TimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private static final Logger logger = LoggerFactory.getLogger(SubscriptionService.class);
    private static final String USERS_COLLECTION = "users";
    private static final String SUBSCRIPTION_COLLECTION = "subscription";
    private static final String CURRENT_DOCUMENT = "current";

    private final Firestore firestore;

    @SneakyThrows
    public SubscriptionResponseDto getCurrent(String userId) {
        DocumentSnapshot snapshot = currentRef(userId).get().get();
        if (!snapshot.exists()) {
            return legacyResponse();
        }

        Subscription subscription = fromSnapshot(snapshot);
        if (subscription == null) {
            return unavailableResponse();
        }

        subscription.setId(CURRENT_DOCUMENT);
        if (isExpired(subscription)) {
            subscription.setFullAccess(false);
            subscription.setSubscriptionStatus("expired");
            subscription.setUpdatedAt(Timestamp.now());
            currentRef(userId).set(subscription).get();
            logger.info("Expired subscription for user={}", userId);
        }

        return toResponse(subscription);
    }

    @SneakyThrows
    public SubscriptionResponseDto createLiteForSignup(String userId) {
        DocumentReference ref = currentRef(userId);
        DocumentSnapshot snapshot = ref.get().get();
        if (snapshot.exists()) {
            return getCurrent(userId);
        }

        Timestamp now = Timestamp.now();
        Subscription subscription = Subscription.builder()
                .id(CURRENT_DOCUMENT)
                .plan("lite")
                .fullAccess(false)
                .subscriptionStatus("none")
                .source("signup")
                .createdAt(now)
                .updatedAt(now)
                .build();

        ref.set(subscription).get();
        logger.info("Created Lite subscription for user={}", userId);
        return toResponse(subscription);
    }

    @SneakyThrows
    public SubscriptionResponseDto checkout(String userId, SubscriptionCheckoutRequestDto dto) {
        String plan = normalizePlan(dto == null ? null : dto.getPlan());
        Timestamp now = Timestamp.now();
        Subscription existing = getExistingSubscription(userId);
        Timestamp createdAt = existing != null && existing.getCreatedAt() != null ? existing.getCreatedAt() : now;

        Subscription subscription = Subscription.builder()
                .id(CURRENT_DOCUMENT)
                .plan(plan)
                .fullAccess(true)
                .subscriptionStatus("active")
                .source("mock_payment")
                .priceUsd(priceForPlan(plan))
                .startedAt(now)
                .expiresAt(expiresAt(plan, now))
                .createdAt(createdAt)
                .updatedAt(now)
                .build();

        currentRef(userId).set(subscription).get();
        logger.info("Updated subscription plan={} user={}", plan, userId);
        return toResponse(subscription);
    }

    @SneakyThrows
    private Subscription getExistingSubscription(String userId) {
        DocumentSnapshot snapshot = currentRef(userId).get().get();
        return snapshot.exists() ? fromSnapshot(snapshot) : null;
    }

    private DocumentReference currentRef(String userId) {
        return firestore.collection(USERS_COLLECTION)
                .document(userId)
                .collection(SUBSCRIPTION_COLLECTION)
                .document(CURRENT_DOCUMENT);
    }

    private String normalizePlan(String plan) {
        if (plan == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "plan is required");
        }
        String normalized = plan.trim().toLowerCase();
        if (!normalized.equals("monthly") && !normalized.equals("yearly") && !normalized.equals("forever")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "plan must be monthly, yearly, or forever");
        }
        return normalized;
    }

    private Integer priceForPlan(String plan) {
        return switch (plan) {
            case "monthly" -> 2;
            case "yearly" -> 20;
            case "forever" -> 100;
            default -> null;
        };
    }

    private Timestamp expiresAt(String plan, Timestamp startedAt) {
        Instant instant = Instant.ofEpochSecond(startedAt.getSeconds(), startedAt.getNanos());
        Instant expires = switch (plan) {
            case "monthly" -> instant.atOffset(ZoneOffset.UTC).plusMonths(1).toInstant();
            case "yearly" -> instant.atOffset(ZoneOffset.UTC).plusYears(1).toInstant();
            default -> null;
        };
        return expires == null ? null : Timestamp.ofTimeSecondsAndNanos(expires.getEpochSecond(), expires.getNano());
    }

    private Subscription fromSnapshot(DocumentSnapshot snapshot) {
        Boolean fullAccess = snapshot.getBoolean("fullAccess");
        Long priceUsd = snapshot.getLong("priceUsd");
        return Subscription.builder()
                .id(CURRENT_DOCUMENT)
                .plan(snapshot.getString("plan"))
                .fullAccess(fullAccess != null && fullAccess)
                .subscriptionStatus(snapshot.getString("subscriptionStatus"))
                .source(snapshot.getString("source"))
                .priceUsd(priceUsd == null ? null : priceUsd.intValue())
                .startedAt(readTimestamp(snapshot, "startedAt"))
                .expiresAt(readTimestamp(snapshot, "expiresAt"))
                .createdAt(readTimestamp(snapshot, "createdAt"))
                .updatedAt(readTimestamp(snapshot, "updatedAt"))
                .build();
    }

    private Timestamp readTimestamp(DocumentSnapshot snapshot, String field) {
        Object raw = snapshot.get(field);
        if (raw instanceof Timestamp timestamp) {
            return timestamp;
        }
        if (raw instanceof String value && !value.isBlank()) {
            Instant instant = Instant.parse(value);
            return Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano());
        }

        return null;
    }

    private boolean isExpired(Subscription subscription) {
        return subscription.isFullAccess()
                && "active".equals(subscription.getSubscriptionStatus())
                && subscription.getExpiresAt() != null
                && subscription.getExpiresAt().compareTo(Timestamp.now()) < 0;
    }

    private SubscriptionResponseDto legacyResponse() {
        return SubscriptionResponseDto.builder()
                .plan("legacy")
                .fullAccess(true)
                .subscriptionStatus("legacy")
                .source("missing_subscription_record")
                .build();
    }

    private SubscriptionResponseDto unavailableResponse() {
        return SubscriptionResponseDto.builder()
                .plan("lite")
                .fullAccess(false)
                .subscriptionStatus("unavailable")
                .source("read_error")
                .build();
    }

    private SubscriptionResponseDto toResponse(Subscription subscription) {
        return SubscriptionResponseDto.builder()
                .plan(subscription.getPlan())
                .fullAccess(subscription.isFullAccess())
                .subscriptionStatus(subscription.getSubscriptionStatus())
                .source(subscription.getSource())
                .priceUsd(subscription.getPriceUsd())
                .startedAt(TimeUtils.toIsoString(subscription.getStartedAt()))
                .expiresAt(TimeUtils.toIsoString(subscription.getExpiresAt()))
                .createdAt(TimeUtils.toIsoString(subscription.getCreatedAt()))
                .updatedAt(TimeUtils.toIsoString(subscription.getUpdatedAt()))
                .build();
    }
}
