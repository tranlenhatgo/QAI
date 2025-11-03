package com.myproject.quizzai.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TakeQuiz {

    @DocumentId
    private String id;
    private String quiz_id;
    private String player_id;
    private String player_name;
    private String score;
    private Status status;
    private Timestamp start_time;
    private Timestamp end_time;
    private Timestamp created_at;
    private Timestamp updated_at;

}
