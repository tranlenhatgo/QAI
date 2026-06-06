package com.myproject.quizzai.controller;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.myproject.quizzai.dto.SubscriptionCheckoutRequestDto;
import com.myproject.quizzai.dto.SubscriptionResponseDto;
import com.myproject.quizzai.service.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(SubscriptionController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Subscription Controller", description = "Lite/Full subscription entitlement")
public class SubscriptionController {

    public static final String ROOT_MAPPING = "subscription";
    private static final Logger logger = LoggerFactory.getLogger(SubscriptionController.class);

    private final SubscriptionService subscriptionService;
    private final FirebaseAuth firebaseAuth;

    @GetMapping("/current")
    @Operation(summary = "Get current user's subscription")
    public ResponseEntity<SubscriptionResponseDto> getCurrent(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = requireUserId(authorization);
        logger.info("getCurrent() user={}", userId);
        return ResponseEntity.ok(subscriptionService.getCurrent(userId));
    }

    @PostMapping("/signup")
    @Operation(summary = "Create Lite subscription for a new user")
    public ResponseEntity<SubscriptionResponseDto> signup(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = requireUserId(authorization);
        logger.info("signup() user={}", userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(subscriptionService.createLiteForSignup(userId));
    }

    @PostMapping("/checkout")
    @Operation(summary = "Mock checkout for a Full subscription plan")
    public ResponseEntity<SubscriptionResponseDto> checkout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody SubscriptionCheckoutRequestDto dto
    ) {
        String userId = requireUserId(authorization);
        logger.info("checkout() user={} plan={}", userId, dto == null ? null : dto.getPlan());
        return ResponseEntity.ok(subscriptionService.checkout(userId, dto));
    }

    private String requireUserId(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        String token = authorization.substring("Bearer ".length()).trim();
        if (token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        try {
            return firebaseAuth.verifyIdToken(token).getUid();
        } catch (FirebaseAuthException error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid auth token", error);
        }
    }
}
