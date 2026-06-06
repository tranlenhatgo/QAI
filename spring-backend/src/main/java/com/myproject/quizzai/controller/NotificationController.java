package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.NotificationCreateDto;
import com.myproject.quizzai.dto.NotificationResponseDto;
import com.myproject.quizzai.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(NotificationController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Notification Controller", description = "User notifications CRUD")
public class NotificationController {

    public static final String ROOT_MAPPING = "notification";
    private static final Logger logger = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationService notificationService;

    @PostMapping
    @Operation(summary = "Create a notification")
    public ResponseEntity<NotificationResponseDto> create(@RequestBody NotificationCreateDto dto) {
        logger.info("create() type={} user={}", dto.getType(), dto.getUser_id());
        NotificationResponseDto result = notificationService.create(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get all notifications for a user")
    public ResponseEntity<List<NotificationResponseDto>> getAllByUserId(@PathVariable String userId) {
        logger.info("getAllByUserId() user={}", userId);
        List<NotificationResponseDto> notifications = notificationService.getAllByUserId(userId);
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/user/{userId}/unread")
    @Operation(summary = "Get unread notifications for a user")
    public ResponseEntity<List<NotificationResponseDto>> getUnreadByUserId(@PathVariable String userId) {
        logger.info("getUnreadByUserId() user={}", userId);
        List<NotificationResponseDto> notifications = notificationService.getUnreadByUserId(userId);
        return ResponseEntity.ok(notifications);
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<Void> markAsRead(@PathVariable String id) {
        logger.info("markAsRead() id={}", id);
        notificationService.markAsRead(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/user/{userId}/read-all")
    @Operation(summary = "Mark all notifications as read for a user")
    public ResponseEntity<Void> markAllAsRead(@PathVariable String userId) {
        logger.info("markAllAsRead() user={}", userId);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a notification")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        logger.info("delete() id={}", id);
        notificationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
