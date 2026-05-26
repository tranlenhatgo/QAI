package com.myproject.quizzai.controller;

import com.myproject.quizzai.dto.ReviewScheduleResponseDto;
import com.myproject.quizzai.dto.ReviewScheduleUpsertDto;
import com.myproject.quizzai.service.ReviewScheduleService;
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
@RequestMapping(ReviewScheduleController.ROOT_MAPPING)
@RequiredArgsConstructor
@Tag(name = "Review Schedule Controller", description = "Spaced repetition review schedule CRUD")
public class ReviewScheduleController {

    public static final String ROOT_MAPPING = "review-schedule";
    private static final Logger logger = LoggerFactory.getLogger(ReviewScheduleController.class);

    private final ReviewScheduleService reviewScheduleService;

    @PostMapping
    @Operation(summary = "Create or update a review schedule for a user+category")
    public ResponseEntity<ReviewScheduleResponseDto> upsert(@RequestBody ReviewScheduleUpsertDto dto) {
        logger.info("upsert() user={} category={}", dto.getUser_id(), dto.getCategory());
        ReviewScheduleResponseDto result = reviewScheduleService.upsert(dto);
        return ResponseEntity.status(HttpStatus.OK).body(result);
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get all review schedules for a user")
    public ResponseEntity<List<ReviewScheduleResponseDto>> getByUserId(@PathVariable String userId) {
        logger.info("getByUserId() user={}", userId);
        List<ReviewScheduleResponseDto> schedules = reviewScheduleService.getByUserId(userId);
        return ResponseEntity.ok(schedules);
    }

    @GetMapping("/user/{userId}/due")
    @Operation(summary = "Get due review schedules for a user (next_review <= now)")
    public ResponseEntity<List<ReviewScheduleResponseDto>> getDueByUserId(@PathVariable String userId) {
        logger.info("getDueByUserId() user={}", userId);
        List<ReviewScheduleResponseDto> schedules = reviewScheduleService.getDueByUserId(userId);
        return ResponseEntity.ok(schedules);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a review schedule by ID")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        logger.info("delete() id={}", id);
        reviewScheduleService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
