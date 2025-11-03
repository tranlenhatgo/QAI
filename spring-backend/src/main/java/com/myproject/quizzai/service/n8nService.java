package com.myproject.quizzai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.myproject.quizzai.dto.MultipartInputStreamFileResource;
import com.myproject.quizzai.dto.QuizResponseN8n;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@RequiredArgsConstructor
public class n8nService {
    private static final Logger logger = LoggerFactory.getLogger(n8nService.class);

    private static final String URL = "http://localhost:5678";  // Replace with ngrok instance URL

    private static final String N8N_WEBHOOK_URL =  URL+"/webhook";


    private final RestTemplate restTemplate;

    public void uploadFileToN8n(String quizId, MultipartFile file) throws IOException {
        String uploadUrl = N8N_WEBHOOK_URL + "/upload";

        // Set up headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultipartInputStreamFileResource resource =
                new MultipartInputStreamFileResource(file.getInputStream(), file.getOriginalFilename(), file.getSize());

        // Prepare the multipart body
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("quiz_id", quizId);
        body.add("data", resource);

        // Create the request entity
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        // Send the request
        restTemplate.postForEntity(uploadUrl, request, String.class);
        logger.info("File uploaded to n8n successfully for quiz ID: {}", quizId);
    }


    public ResponseEntity<QuizResponseN8n.Output> getQuestionFromN8n(String quizId) {
        String getQuestionUrl = N8N_WEBHOOK_URL + "/get-question";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        String requestPayload = String.format("{\"quiz_id\": \"%s\"}", quizId);
        HttpEntity<String> request = new HttpEntity<>(requestPayload, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(getQuestionUrl, request, String.class);
            logger.info("Received response from n8n: {}", response.getBody());

            ObjectMapper objectMapper = new ObjectMapper();
            QuizResponseN8n quizResponseN8n = objectMapper.readValue(response.getBody(), QuizResponseN8n.class);

            return ResponseEntity.status(response.getStatusCode()).body(quizResponseN8n.getOutput());
        } catch (Exception e) {
            logger.error("Error while sending request to n8n: {}", e.getMessage());
            throw new RuntimeException("Failed to send webhook to n8n", e);
        }
    }
}
