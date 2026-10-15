package com.likhith.helfen.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class DeepgramService {

    private static final Logger log = LoggerFactory.getLogger(DeepgramService.class);
    private final WebClient deepgramWebClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DeepgramService(@Qualifier("deepgramWebClient") WebClient deepgramWebClient) {
        this.deepgramWebClient = deepgramWebClient;
    }

    /**
     * Transcribes raw audio bytes (WebM, WAV, OGG, MP3) using Deepgram Nova-2 STT
     */
    public Mono<String> transcribeAudio(byte[] audioBytes, String mimeType) {
        if (audioBytes == null || audioBytes.length == 0) {
            return Mono.just("");
        }

        String mediaType = (mimeType != null && !mimeType.isBlank()) ? mimeType : "audio/webm";

        return deepgramWebClient.post()
                .uri(uriBuilder -> uriBuilder
                        .queryParam("model", "nova-2")
                        .queryParam("smart_format", "true")
                        .queryParam("punctuate", "true")
                        .queryParam("paragraphs", "false")
                        .build())
                .contentType(MediaType.parseMediaType(mediaType))
                .body(BodyInserters.fromValue(audioBytes))
                .retrieve()
                .bodyToMono(String.class)
                .map(this::extractTranscript)
                .onErrorResume(err -> {
                    log.error("Deepgram STT transcription error: {}", err.getMessage());
                    return Mono.just("");
                });
    }

    private String extractTranscript(String responseJson) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode alternatives = root.path("results")
                    .path("channels")
                    .path(0)
                    .path("alternatives")
                    .path(0);

            if (alternatives.has("transcript")) {
                return alternatives.path("transcript").asText("").trim();
            }
        } catch (Exception e) {
            log.warn("Failed to parse Deepgram response: {}", e.getMessage());
        }
        return "";
    }
}
