package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.myproject.quizzai.dto.ReviewScheduleResponseDto;
import com.myproject.quizzai.dto.ReviewScheduleUpsertDto;
import com.myproject.quizzai.model.ReviewSchedule;
import com.myproject.quizzai.utils.IdUtil;
import com.myproject.quizzai.utils.TimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewScheduleService {

    private static final Logger logger = LoggerFactory.getLogger(ReviewScheduleService.class);
    private static final String COLLECTION = "review_schedule";

    private final Firestore firestore;

    @SneakyThrows
    public ReviewScheduleResponseDto upsert(ReviewScheduleUpsertDto dto) {
        // Check if schedule exists for this user + category
        List<QueryDocumentSnapshot> existing = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", dto.getUser_id())
                .whereEqualTo("category", dto.getCategory())
                .get().get().getDocuments();

        String docId;
        if (!existing.isEmpty()) {
            docId = existing.get(0).getId();
        } else {
            docId = IdUtil.generateId();
        }

        ReviewSchedule schedule = ReviewSchedule.builder()
                .id(docId)
                .user_id(dto.getUser_id())
                .category(dto.getCategory())
                .easiness(dto.getEasiness())
                .interval_days(dto.getInterval_days())
                .repetitions(dto.getRepetitions())
                .next_review(parseTimestamp(dto.getNext_review()))
                .last_reviewed(parseTimestamp(dto.getLast_reviewed()))
                .last_score(dto.getLast_score())
                .updated_at(Timestamp.now())
                .build();

        firestore.collection(COLLECTION).document(docId).set(schedule).get();
        logger.info("Upserted review_schedule {} for user={} category={}", docId, dto.getUser_id(), dto.getCategory());

        return toResponse(schedule);
    }

    @SneakyThrows
    public List<ReviewScheduleResponseDto> getByUserId(String userId) {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", userId)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(ReviewSchedule.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public List<ReviewScheduleResponseDto> getAll() {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(ReviewSchedule.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public List<ReviewScheduleResponseDto> getDueByUserId(String userId) {
        Timestamp now = Timestamp.now();
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", userId)
                .whereLessThanOrEqualTo("next_review", now)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(ReviewSchedule.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public List<ReviewScheduleResponseDto> getAllDue() {
        Timestamp now = Timestamp.now();
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereLessThanOrEqualTo("next_review", now)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(ReviewSchedule.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public void delete(String id) {
        firestore.collection(COLLECTION).document(id).delete().get();
        logger.info("Deleted review_schedule {}", id);
    }

    private ReviewScheduleResponseDto toResponse(ReviewSchedule s) {
        return ReviewScheduleResponseDto.builder()
                .id(s.getId())
                .user_id(s.getUser_id())
                .category(s.getCategory())
                .easiness(s.getEasiness())
                .interval_days(s.getInterval_days())
                .repetitions(s.getRepetitions())
                .next_review(TimeUtils.toIsoString(s.getNext_review()))
                .last_reviewed(TimeUtils.toIsoString(s.getLast_reviewed()))
                .last_score(s.getLast_score())
                .updated_at(TimeUtils.toIsoString(s.getUpdated_at()))
                .build();
    }

    private Timestamp parseTimestamp(String iso) {
        if (iso == null || iso.isBlank()) return null;
        Instant instant = Instant.parse(iso);
        return Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano());
    }
}
