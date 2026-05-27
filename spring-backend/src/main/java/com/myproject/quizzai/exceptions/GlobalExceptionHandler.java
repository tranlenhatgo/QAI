package com.myproject.quizzai.exceptions;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ExecutionException.class)
    public ResponseEntity<Map<String, Object>> handleExecutionException(ExecutionException exception) {
        if (isQuotaExceeded(exception)) {
            logger.warn("Firestore quota exceeded: {}", exception.getMessage());
            return error(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Firestore quota exceeded. Wait for quota reset, reduce requests, or use a Firebase project with available quota."
            );
        }

        logger.error("Async backend operation failed", exception);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Backend operation failed");
    }

    private boolean isQuotaExceeded(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String className = current.getClass().getName();
            String message = current.getMessage();
            if (className.contains("ResourceExhaustedException")
                    || contains(message, "RESOURCE_EXHAUSTED")
                    || contains(message, "Quota exceeded")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean contains(String value, String fragment) {
        return value != null && value.contains(fragment);
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of(
                "message", message,
                "statusCode", status.value()
        ));
    }
}
