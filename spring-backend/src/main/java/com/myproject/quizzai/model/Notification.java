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
public class Notification {

    @DocumentId
    private String id;
    private String user_id;
    private String type;
    private String title;
    private String message;
    private boolean read;
    private Timestamp created_at;
    private Timestamp expires_at;

}
