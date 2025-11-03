package com.myproject.quizzai.model;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Quiz {

    @DocumentId
    private String id;
    private String host_id;
    private String title;
    private String description;
    private Status status;
    private List<Category> categories;
    private Timestamp start_time;
    private Timestamp end_time;
    private Timestamp createdAt;
    private Timestamp updatedAt;

}
