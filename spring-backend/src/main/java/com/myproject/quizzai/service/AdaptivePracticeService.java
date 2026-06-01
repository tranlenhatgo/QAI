package com.myproject.quizzai.service;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.myproject.quizzai.dto.AdaptivePracticeAnswerRequestDto;
import com.myproject.quizzai.dto.AdaptivePracticeQuestionDto;
import com.myproject.quizzai.dto.AdaptivePracticeSessionStateResponseDto;
import com.myproject.quizzai.model.AdaptivePracticeAnswer;
import com.myproject.quizzai.utils.IdUtil;
import com.myproject.quizzai.utils.TimeUtils;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdaptivePracticeService {

    private static final String USERS_COLLECTION = "users";
    private static final String ADAPTIVE_COLLECTION = "adaptive_practice_answers";
    private static final Set<String> ALLOWED_SOURCES = Set.of("static_json", "adaptive_ai", "repeat");

    private final Firestore firestore;

    @SneakyThrows
    public AdaptivePracticeQuestionDto saveAnswer(String userId, AdaptivePracticeAnswerRequestDto dto) {
        validate(dto);

        Timestamp now = Timestamp.now();
        String id = IdUtil.generateId();
        AdaptivePracticeAnswer answer = AdaptivePracticeAnswer.builder()
                .id(id)
                .category(normalizeCategory(dto.getCategory()))
                .sourceQuestionId(clean(dto.getSourceQuestionId()))
                .question(dto.getQuestion().trim())
                .answers(dto.getAnswers())
                .correctAnswer(dto.getCorrectAnswer().trim())
                .selectedAnswer(clean(dto.getSelectedAnswer()))
                .correct(Boolean.TRUE.equals(dto.getCorrect()))
                .source(dto.getSource().trim())
                .repeated(Boolean.TRUE.equals(dto.getRepeated()))
                .generatedFromQuestion(clean(dto.getGeneratedFromQuestion()))
                .createdAt(now)
                .updatedAt(now)
                .build();

        answersRef(userId).document(id).set(answer).get();
        return toDto(answer);
    }

    @SneakyThrows
    public AdaptivePracticeSessionStateResponseDto getSessionState(String userId, String category) {
        String normalizedCategory = normalizeCategory(category);
        List<AdaptivePracticeAnswer> records = answersRef(userId)
                .whereEqualTo("category", normalizedCategory)
                .get()
                .get()
                .getDocuments()
                .stream()
                .map(this::toAnswer)
                .sorted(Comparator.comparing(AdaptivePracticeAnswer::getCreatedAt, Comparator.nullsLast(Timestamp::compareTo)).reversed())
                .toList();

        List<String> answeredStaticIds = records.stream()
                .filter(record -> "static_json".equals(record.getSource()))
                .map(AdaptivePracticeAnswer::getSourceQuestionId)
                .filter(value -> value != null && !value.isBlank())
                .distinct()
                .toList();

        Map<String, AdaptivePracticeAnswer> uniqueWrongs = new LinkedHashMap<>();
        for (AdaptivePracticeAnswer record : records) {
            if (!record.isCorrect()) {
                String key = record.getSourceQuestionId() != null && !record.getSourceQuestionId().isBlank()
                        ? record.getSourceQuestionId()
                        : record.getQuestion();
                uniqueWrongs.putIfAbsent(key, record);
            }
        }

        List<AdaptivePracticeQuestionDto> wrongQuestions = uniqueWrongs.values()
                .stream()
                .limit(20)
                .map(this::toDto)
                .toList();

        List<AdaptivePracticeQuestionDto> recentAnswers = records.stream()
                .limit(20)
                .map(this::toDto)
                .toList();

        return AdaptivePracticeSessionStateResponseDto.builder()
                .answeredStaticQuestionIds(answeredStaticIds)
                .hasStaticHistoryInCategory(!answeredStaticIds.isEmpty())
                .wrongQuestions(wrongQuestions)
                .recentAnswers(recentAnswers)
                .build();
    }

    private CollectionReference answersRef(String userId) {
        return firestore.collection(USERS_COLLECTION)
                .document(userId)
                .collection(ADAPTIVE_COLLECTION);
    }

    private AdaptivePracticeAnswer toAnswer(QueryDocumentSnapshot snapshot) {
        AdaptivePracticeAnswer answer = snapshot.toObject(AdaptivePracticeAnswer.class);
        answer.setId(snapshot.getId());
        return answer;
    }

    private void validate(AdaptivePracticeAnswerRequestDto dto) {
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "answer payload is required");
        }
        if (normalizeCategory(dto.getCategory()).isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "category is required");
        }
        if (dto.getQuestion() == null || dto.getQuestion().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "question is required");
        }
        if (dto.getAnswers() == null || dto.getAnswers().size() != 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "answers must contain exactly 4 options");
        }
        if (dto.getCorrectAnswer() == null || dto.getCorrectAnswer().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correctAnswer is required");
        }
        if (dto.getCorrect() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "correct is required");
        }
        if (dto.getSource() == null || !ALLOWED_SOURCES.contains(dto.getSource().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "source must be static_json, adaptive_ai, or repeat");
        }
    }

    private String normalizeCategory(String category) {
        return category == null ? "" : category.trim().toLowerCase();
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private AdaptivePracticeQuestionDto toDto(AdaptivePracticeAnswer answer) {
        return AdaptivePracticeQuestionDto.builder()
                .id(answer.getId())
                .category(answer.getCategory())
                .sourceQuestionId(answer.getSourceQuestionId())
                .question(answer.getQuestion())
                .answers(answer.getAnswers())
                .correctAnswer(answer.getCorrectAnswer())
                .selectedAnswer(answer.getSelectedAnswer())
                .correct(answer.isCorrect())
                .source(answer.getSource())
                .repeated(answer.isRepeated())
                .generatedFromQuestion(answer.getGeneratedFromQuestion())
                .createdAt(TimeUtils.toIsoString(answer.getCreatedAt()))
                .updatedAt(TimeUtils.toIsoString(answer.getUpdatedAt()))
                .build();
    }
}
