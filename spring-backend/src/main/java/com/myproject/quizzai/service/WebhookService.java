package com.myproject.quizzai.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.myproject.quizzai.model.TakeQuiz;

import java.util.Map;

@Service
public class WebhookService {

    private static final Logger logger = LoggerFactory.getLogger(WebhookService.class);

    @Value("${coach.webhook.url:http://localhost:8000/webhook/quiz-completed}")
    private String webhookUrl;

    @Value("${coach.webhook.api-key:}")
    private String apiKey;

    @Value("${coach.webhook.enabled:true}")
    private boolean enabled;

    private final RestTemplate restTemplate;

    public WebhookService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Notify AI Coach that a quiz has been completed.
     * Non-blocking: failures are logged but don't affect quiz completion.
     */
    public void notifyQuizCompleted(TakeQuiz takeQuiz, String quizId, String category) {
        if (!enabled || apiKey.isEmpty()) {
            logger.debug("Webhook disabled or no API key configured, skipping");
            return;
        }

        try {
            Map<String, Object> payload = Map.of(
                "user_id", takeQuiz.getPlayer_id(),
                "quiz_id", quizId,
                "score", takeQuiz.getScore(),
                "category", category != null ? category : "unknown",
                "completed_at", takeQuiz.getEnd_time() != null
                    ? takeQuiz.getEnd_time().toString()
                    : ""
            );

            HttpHeaders headers = new HttpHeaders();
            headers.set("X-API-Key", apiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                webhookUrl, request, Map.class
            );

            logger.info("Webhook sent for take_quiz {}: status {}",
                takeQuiz.getId(), response.getStatusCode());

        } catch (Exception e) {
            // Non-blocking: quiz completion succeeds even if webhook fails
            logger.warn("Webhook delivery failed for take_quiz {}: {}",
                takeQuiz.getId(), e.getMessage());
        }
    }
}
