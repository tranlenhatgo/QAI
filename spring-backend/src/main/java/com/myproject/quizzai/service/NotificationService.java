package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.myproject.quizzai.dto.NotificationCreateDto;
import com.myproject.quizzai.dto.NotificationResponseDto;
import com.myproject.quizzai.model.Notification;
import com.myproject.quizzai.utils.IdUtil;
import com.myproject.quizzai.utils.TimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    private static final String COLLECTION = "notification";

    private final Firestore firestore;

    @SneakyThrows
    public NotificationResponseDto create(NotificationCreateDto dto) {
        String docId = IdUtil.generateId();

        Notification notification = Notification.builder()
                .id(docId)
                .user_id(dto.getUser_id())
                .type(dto.getType())
                .title(dto.getTitle())
                .message(dto.getMessage())
                .read(false)
                .created_at(Timestamp.now())
                .expires_at(parseTimestamp(dto.getExpires_at()))
                .build();

        firestore.collection(COLLECTION).document(docId).set(notification).get();
        logger.info("Created notification {} type={} for user={}", docId, dto.getType(), dto.getUser_id());

        return toResponse(notification);
    }

    @SneakyThrows
    public List<NotificationResponseDto> getUnreadByUserId(String userId) {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(Notification.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public List<NotificationResponseDto> getAllByUserId(String userId) {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", userId)
                .get().get().getDocuments();

        return docs.stream()
                .map(doc -> doc.toObject(Notification.class))
                .map(this::toResponse)
                .toList();
    }

    @SneakyThrows
    public void markAsRead(String id) {
        firestore.collection(COLLECTION).document(id).update(Map.of(
                "read", true
        )).get();
        logger.info("Marked notification {} as read", id);
    }

    @SneakyThrows
    public void markAllAsRead(String userId) {
        List<QueryDocumentSnapshot> docs = firestore.collection(COLLECTION)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get().get().getDocuments();

        for (QueryDocumentSnapshot doc : docs) {
            firestore.collection(COLLECTION).document(doc.getId()).update(Map.of(
                    "read", true
            )).get();
        }
        logger.info("Marked all notifications as read for user={}", userId);
    }

    @SneakyThrows
    public void delete(String id) {
        firestore.collection(COLLECTION).document(id).delete().get();
    }

    private NotificationResponseDto toResponse(Notification n) {
        return NotificationResponseDto.builder()
                .id(n.getId())
                .user_id(n.getUser_id())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .read(n.isRead())
                .created_at(TimeUtils.toIsoString(n.getCreated_at()))
                .expires_at(TimeUtils.toIsoString(n.getExpires_at()))
                .build();
    }

    private Timestamp parseTimestamp(String iso) {
        if (iso == null || iso.isBlank()) return null;
        Instant instant = Instant.parse(iso);
        return Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano());
    }
}
