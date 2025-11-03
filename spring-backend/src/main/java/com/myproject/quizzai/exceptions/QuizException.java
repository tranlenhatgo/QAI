package com.myproject.quizzai.exceptions;

import java.io.Serial;

public class QuizException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    public QuizException() {
        super();
    }

    public QuizException(String message) {
        super(message);
    }
}