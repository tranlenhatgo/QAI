package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.QuizResponseN8n;
import com.myproject.quizzai.service.n8nService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping(n8nController.ROOT_MAPPING)
@RequiredArgsConstructor
public class n8nController {
    public static final String ROOT_MAPPING = "/n8n";
    private static final Logger logger = LoggerFactory.getLogger(n8nController.class);

    private final n8nService n8nService;

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("quiz_id") String quizId,
                                                      @RequestParam("data") MultipartFile file) throws IOException {
        logger.info("Received file upload request for quiz ID: {}", quizId);
        n8nService.uploadFileToN8n(quizId, file);

        Map<String, Object> response = Map.of(
            "message", "Forwarded to n8n successfully"
        );

        return ResponseEntity.status(200).body(response);
    }

    @PostMapping(value = "/get-question", consumes = "application/json")
    public ResponseEntity<QuizResponseN8n.Output> sendWebhookWithQuizId(@RequestBody Map<String, String> requestBody) {
        String quizId = requestBody.get("quiz_id");
        logger.info("Sending webhook to n8n with quiz ID: {}", quizId);
        return n8nService.getQuestionFromN8n(quizId);
    }
}
