package com.myproject.quizzai.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
@Schema(title = "Take Quiz End Request Dto", accessMode = Schema.AccessMode.WRITE_ONLY)
public class TakeQuizEndRequestDto {

    private String takeId;

    private List<TakeQuestionSaveRequestDto> takeQuestionSaveRequestDtos; // List of questions for the quiz
}
