package com.likhith.helfen.ai.controller;

import com.likhith.helfen.ai.dto.TtsRequest;
import com.likhith.helfen.ai.service.CartesiaService;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1")
public class TtsController {

    private final CartesiaService cartesiaService;

    public TtsController(CartesiaService cartesiaService) {
        this.cartesiaService = cartesiaService;
    }

    @PostMapping(value = "/tts", produces = "audio/mpeg")
    public ResponseEntity<Flux<DataBuffer>> synthesizeVoice(@RequestBody TtsRequest request) {
        if (request.getText() == null || request.getText().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Flux<DataBuffer> audioStream = cartesiaService.streamAudio(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(audioStream);
    }
}
