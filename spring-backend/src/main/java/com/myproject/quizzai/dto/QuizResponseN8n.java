package com.myproject.quizzai.dto;

import lombok.Data;

import java.util.List;

@Data
public class QuizResponseN8n {
    private Output output;

    @Data
    public static class Output {
        private String question;
        private List<String> answers;
        private String correctAnswer;
    }
}