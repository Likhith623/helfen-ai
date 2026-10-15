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
public class RagChunk {
    private String documentName;
    private int chunkIndex;
    private String content;
    private int tokenCount;
    private double score;
    private List<Double> embedding;
}
