package com.likhith.helfen.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RagRequest {
    private String query;
    private List<RagDocumentInput> documents;
    private List<RagChunk> existingChunks;
    private int topK;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RagDocumentInput {
        private String name;
        private String content;
        private String type;
    }
}
