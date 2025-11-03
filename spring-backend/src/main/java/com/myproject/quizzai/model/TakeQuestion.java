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
public class TakeQuestion {

    @DocumentId
    private String id;
    private String take_id; //take_quiz_id
    private String question_id;
    private String answer;
    private String check_answer;
    private Timestamp created_at;
    private Timestamp updated_at;
}
