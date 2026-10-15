package com.likhith.helfen.ai.controller;

import com.likhith.helfen.ai.service.DeepgramService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class SttController {

    private final DeepgramService deepgramService;

    public SttController(DeepgramService deepgramService) {
        this.deepgramService = deepgramService;
    }

    /**
     * Speech-to-Text endpoint receiving recorded audio bytes
     */
    @PostMapping(value = "/stt", consumes = { "audio/*", MediaType.APPLICATION_OCTET_STREAM_VALUE })
    public Mono<ResponseEntity<Map<String, Object>>> transcribeAudio(
            @RequestBody byte[] audioBytes,
            @RequestHeader(value = "Content-Type", defaultValue = "audio/webm") String contentType) {

        if (audioBytes == null || audioBytes.length == 0) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Audio data is empty",
                    "transcript", ""
            )));
        }

        return deepgramService.transcribeAudio(audioBytes, contentType)
                .map(transcript -> ResponseEntity.ok(Map.of(
                        "success", true,
                        "transcript", transcript
                )));
    }
}
