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

import com.myproject.quizzai.dto.TakeQuestionSaveRequestDto;
import com.myproject.quizzai.model.CheckAnswer;
import com.myproject.quizzai.model.TakeQuiz;
import com.myproject.quizzai.utils.TimeUtils;

import java.util.HashMap;
import java.util.List;
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
    public void notifyQuizCompleted(TakeQuiz takeQuiz, String quizId, String category,
                                    List<TakeQuestionSaveRequestDto> questionResults) {
        if (!enabled || apiKey.isEmpty()) {
            logger.debug("Webhook disabled or no API key configured, skipping");
            return;
        }

        try {
            String completedAt = TimeUtils.toIsoString(takeQuiz.getEnd_time());

            Map<String, Object> payload = new HashMap<>();
            payload.put("user_id", takeQuiz.getPlayer_id());
            payload.put("quiz_id", quizId);
            payload.put("score", takeQuiz.getScore());
            payload.put("category", category != null ? category : "unknown");
            payload.put("completed_at", completedAt != null ? completedAt : "");

            // Include per-question results for detailed analysis
            if (questionResults != null && !questionResults.isEmpty()) {
                List<Map<String, Object>> questions = questionResults.stream()
                        .map(q -> {
                            Map<String, Object> qMap = new HashMap<>();
                            qMap.put("question_id", q.getQuestion_id());
                            qMap.put("correct", q.getCheck_answer() == CheckAnswer.CORRECT);
                            return qMap;
                        })
                        .toList();
                payload.put("questions", questions);
            }

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
