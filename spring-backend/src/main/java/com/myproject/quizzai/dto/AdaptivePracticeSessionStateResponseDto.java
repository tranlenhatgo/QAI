package com.myproject.quizzai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdaptivePracticeSessionStateResponseDto {

    private List<String> answeredStaticQuestionIds;
    private boolean hasStaticHistoryInCategory;
    private List<AdaptivePracticeQuestionDto> wrongQuestions;
    private List<AdaptivePracticeQuestionDto> recentAnswers;
}
