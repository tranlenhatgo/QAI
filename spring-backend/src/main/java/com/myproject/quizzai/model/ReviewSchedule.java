package com.myproject.quizzai.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewSchedule {

    @DocumentId
    private String id;
    private String user_id;
    private String category;
    private double easiness;
    private int interval_days;
    private int repetitions;
    private Timestamp next_review;
    private Timestamp last_reviewed;
    private String last_score;
    private Timestamp updated_at;

}
