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
public class RagResponse {
    private String query;
    private int totalChunksExamined;
    private List<RagChunk> retrievedChunks;
    private String formattedContext;
}
