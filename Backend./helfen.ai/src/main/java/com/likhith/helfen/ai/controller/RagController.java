package com.likhith.helfen.ai.controller;

import com.likhith.helfen.ai.dto.RagChunk;
import com.likhith.helfen.ai.dto.RagRequest;
import com.likhith.helfen.ai.dto.RagResponse;
import com.likhith.helfen.ai.service.RagService;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/rag")
public class RagController {

    private final RagService ragService;

    public RagController(RagService ragService) {
        this.ragService = ragService;
    }

    @PostMapping("/chunk")
    public Mono<List<RagChunk>> chunkDocument(@RequestBody RagRequest.RagDocumentInput doc) {
        List<RagChunk> chunks = ragService.chunkDocument(
                doc.getName() != null ? doc.getName() : "document",
                doc.getContent(),
                600,
                100
        );
        return Mono.just(chunks);
    }

    @PostMapping("/retrieve")
    public Mono<RagResponse> retrieve(@RequestBody RagRequest request) {
        List<RagChunk> candidateChunks = new ArrayList<>();

        if (request.getExistingChunks() != null && !request.getExistingChunks().isEmpty()) {
            candidateChunks.addAll(request.getExistingChunks());
        }

        if (request.getDocuments() != null) {
            for (RagRequest.RagDocumentInput doc : request.getDocuments()) {
                candidateChunks.addAll(ragService.chunkDocument(
                        doc.getName() != null ? doc.getName() : "document",
                        doc.getContent(),
                        600,
                        100
                ));
            }
        }

        int topK = request.getTopK() > 0 ? request.getTopK() : 4;
        List<RagChunk> retrieved = ragService.retrieveRelevantChunks(request.getQuery(), candidateChunks, topK);
        String formatted = ragService.formatRagContext(retrieved);

        RagResponse response = RagResponse.builder()
                .query(request.getQuery())
                .totalChunksExamined(candidateChunks.size())
                .retrievedChunks(retrieved)
                .formattedContext(formatted)
                .build();

        return Mono.just(response);
    }
}
